/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../../App';

type Node = ReactTestRenderer.ReactTestRendererJSON | ReactTestRenderer.ReactTestRendererJSON[] | string | null;
const textOf = (tree: ReactTestRenderer.ReactTestRenderer) => {
  const parts: string[] = [];
  const walk = (node: Node | undefined) => {
    if (!node) return;
    if (typeof node === 'string') parts.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else {
      // Chat lines type in gradually; their accessibility label carries the full text.
      if (node.props?.accessible && typeof node.props.accessibilityLabel === 'string') parts.push(` ${node.props.accessibilityLabel} `);
      node.children?.forEach(walk);
    }
  };
  walk(tree.toJSON());
  return parts.join('');
};

function findNavItem(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const items = tree.root.findAll(node => node.props?.accessibilityRole === 'tab' && typeof node.props.onPress === 'function');
  return items.find(item => {
    try {
      return item.findAll(child => child.children.some((grandchild: unknown) => grandchild === label)).length > 0;
    } catch {
      return false;
    }
  });
}



const profile = { activityLevel: 'moderate', age: 30, heightCm: 165, name: 'Priya Sharma', sex: 'female', weightKg: 60 };

async function pressNamed(tree: ReactTestRenderer.ReactTestRenderer, name: string) {
  const button = tree.root.findAll(node => typeof node.props?.onPress === 'function' && (node.props.accessibilityRole === 'button' || node.props.accessibilityRole === 'radio' || node.props.accessibilityRole === 'checkbox'))
    .find(node => node.props.accessibilityLabel === name || node.findAll(child => child.children.some((grandchild: unknown) => grandchild === name)).length > 0);
  if (!button) throw new Error(`No button named ${name}`);
  await ReactTestRenderer.act(async () => { await button.props.onPress(); });
}

async function typeInto(tree: ReactTestRenderer.ReactTestRenderer, label: string, text: string) {
  const input = tree.root.find(node => node.props?.accessibilityLabel === label && typeof node.props.onChangeText === 'function');
  await ReactTestRenderer.act(async () => { input.props.onChangeText(text); });
}

test('shows the bootstrap screen, then the API-unavailable state with Retry', async () => {
  globalThis.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as jest.Mock;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  expect(textOf(tree)).toContain("We can't reach healthFlip");
  expect(textOf(tree)).toContain('Retry');
  await ReactTestRenderer.act(async () => tree.unmount());
});

test('onboards a first-run guest through a Flip chat to a personal plan on Home', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const plan = { carbsGrams: 230, dailyCalorieTarget: 1950, dailySteps: 9000, fatGrams: 59, proteinGrams: 96, rationale: 'Hi Priya! A steady plan with gentle daily walks.', source: 'ai' };
  let savedGoal: Record<string, unknown> | null = null;
  let savedProfile: Record<string, unknown> | null = null;
  globalThis.fetch = jest.fn((url: string, options?: { body?: string; method?: string }) => {
    const method = options?.method ?? 'GET';
    let body: unknown = {};
    if (url.endsWith('/v1/guests')) body = { accessToken: 'token' };
    else if (url.includes('/v1/profile')) {
      if (method === 'PUT') savedProfile = JSON.parse(options!.body!);
      body = { profile: method === 'PUT' ? savedProfile : null };
    }
    else if (url.includes('/v1/ai/plan-recommendation')) body = { recommendation: plan };
    else if (url.includes('/v1/goals/current') && method === 'PUT') {
      const input = JSON.parse(options!.body!);
      savedGoal = input;
      body = { goal: { ...input, id: 'g1', macroTargets: { carbsGrams: input.carbsTargetGrams, fatGrams: input.fatTargetGrams, proteinGrams: input.proteinTargetGrams } } };
    } else if (url.includes('/v1/goals/current')) body = { goal: null };
    else if (url.includes('/v1/dashboard')) {
      body = { dashboard: { date: today, goal: { dailyCalorieTarget: 1950, dailyStepsTarget: 9000, id: 'g1', macroTargets: { carbsGrams: 230, fatGrams: 59, proteinGrams: 96 }, planRationale: plan.rationale, type: 'maintain' }, meals: [], remainingCalories: 1950, timezone: 'UTC', totalCalories: 0 } };
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  }) as unknown as jest.Mock;

  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  expect(textOf(tree)).toContain("Welcome! Glad you're here.");
  await ReactTestRenderer.act(() => new Promise<void>(resolve => setTimeout(resolve, 1300)));
  expect(textOf(tree)).toContain('What should I call you?');

  const reply = async (text: string) => {
    await typeInto(tree, 'Your answer', text);
    await pressNamed(tree, 'Send answer');
  };
  await reply("I'm priya sharma");
  expect(textOf(tree)).toContain('Nice to meet you, Priya!');
  // Under-18s are re-asked, nothing is saved.
  await reply('16');
  expect(textOf(tree)).toContain('healthFlip plans are for adults 18 and over');
  await reply('30');
  await reply("5'5");
  await reply('60 kg');
  await pressNamed(tree, 'Female');
  await pressNamed(tree, 'Moderately active');
  // Tap an earlier answer to change it; later answers are kept.
  await pressNamed(tree, 'Change answer: 60 kg');
  await reply('62');
  expect(textOf(tree)).toContain('Last one, Priya');
  await pressNamed(tree, 'Maintain');

  expect(savedProfile).toEqual({ activityLevel: 'moderate', age: 30, heightCm: 165.1, name: 'Priya sharma', sex: 'female', weightKg: 62 });
  expect(textOf(tree)).toContain('Hi Priya! A steady plan with gentle daily walks.');
  expect(textOf(tree)).not.toContain('steps a day');

  await pressNamed(tree, 'Start with this plan');
  expect(savedGoal).toEqual(expect.objectContaining({ carbsTargetGrams: 230, dailyCalorieTarget: 1950, dailyStepsTarget: 9000, fatTargetGrams: 59, proteinTargetGrams: 96, type: 'maintain' }));
  const home = textOf(tree);
  expect(home).toContain('Hi, Priya!');
  expect(home).toContain('1,950');
  expect(home).not.toContain('steps');
  // Plan macros live behind Details on the minimal Home.
  await pressNamed(tree, 'Show details');
  expect(textOf(tree)).toContain(' / 96 g');
  await ReactTestRenderer.act(async () => tree.unmount());
});

test('the + button opens the Flip meal chat, which estimates, logs and returns Home', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const goal = { dailyCalorieTarget: 2000, id: 'g1', startsOn: today, type: 'maintain' };
  const estimate = { assumptions: ['Two medium rotis'], caloriesKcal: 420, carbsGrams: 60, confidence: 'medium', fatGrams: 12, name: 'Roti with dal', proteinGrams: 16, source: 'ai' };
  const requests: { body?: string; method: string; url: string }[] = [];
  let meals: unknown[] = [];
  globalThis.fetch = jest.fn((url: string, options?: { body?: string; method?: string }) => {
    const method = options?.method ?? 'GET';
    requests.push({ body: options?.body, method, url });
    let body: unknown = { goal };
    if (url.includes('/v1/dashboard')) body = { dashboard: { date: today, goal, meals, remainingCalories: 2000 - meals.length * 420, timezone: 'UTC', totalCalories: meals.length * 420 } };
    else if (url.includes('/v1/profile')) body = { profile };
    else if (url.includes('/v1/ai/meal-estimate')) body = { estimate };
    else if (url.endsWith('/v1/meals') && method === 'POST') {
      const meal = { ...JSON.parse(options!.body!), id: 'm1', loggedAt: `${today}T13:00:00` };
      meals = [meal];
      body = { meal };
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  }) as unknown as jest.Mock;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });

  await pressNamed(tree, 'Log a meal');
  expect(textOf(tree)).toMatch(/Hey Priya! What did you have for/);
  await pressNamed(tree, 'Lunch');
  await typeInto(tree, 'Message Flip', '2 rotis and dal');
  await pressNamed(tree, 'Send message');
  const estimateCall = requests.find(request => request.url.includes('/v1/ai/meal-estimate'));
  expect(JSON.parse(estimateCall!.body!)).toEqual({ description: '2 rotis and dal', mealType: 'lunch' });
  expect(textOf(tree)).toContain('Roti with dal');
  expect(textOf(tree)).toContain('Does this look right?');
  // Nothing is logged until the user confirms.
  expect(requests.some(request => request.url.endsWith('/v1/meals') && request.method === 'POST')).toBe(false);

  await pressNamed(tree, 'Log it');
  const created = requests.find(request => request.url.endsWith('/v1/meals') && request.method === 'POST');
  expect(JSON.parse(created!.body!)).toEqual(expect.objectContaining({ caloriesKcal: 420, mealType: 'lunch', name: 'Roti with dal', source: 'manual' }));
  expect(textOf(tree)).toContain('Logged! 1,580 kcal left today. Anything else?');

  await pressNamed(tree, 'Done');
  await ReactTestRenderer.act(() => new Promise<void>(resolve => setTimeout(resolve, 20)));
  const home = textOf(tree);
  expect(home).toContain('Hi, Priya!');
  expect(home).toContain('Roti with dal');
  expect(home).toContain('Meal logged. Nice one!');
  await ReactTestRenderer.act(async () => tree.unmount());
});

test('photo-style item checklist: untick, re-weigh, add a missing item, log, then reuse from Pick from list', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const goal = { dailyCalorieTarget: 2000, id: 'g1', startsOn: today, type: 'maintain' };
  const item = (name: string, grams: number, caloriesKcal: number, proteinGrams: number, carbsGrams: number, fatGrams: number) => ({ caloriesKcal, carbsGrams, fatGrams, grams, name, proteinGrams });
  const plate = { assumptions: ['Home-style portions'], caloriesKcal: 370, carbsGrams: 64, confidence: 'medium', fatGrams: 8, items: [item('Roti', 80, 210, 6, 42, 2.5), item('Dal', 200, 130, 7, 20, 3), item('Pickle', 20, 30, 0, 2, 2.5)], name: 'Roti with dal', proteinGrams: 13, source: 'ai' };
  const lassi = { assumptions: ['One glass'], caloriesKcal: 130, carbsGrams: 17, confidence: 'medium', fatGrams: 6, items: [item('Sweet lassi', 250, 130, 1.5, 17, 6)], name: 'Sweet lassi', proteinGrams: 1.5, source: 'ai' };
  const requests: { body?: string; method: string; url: string }[] = [];
  const foods: unknown[] = [];
  let estimates = 0;
  globalThis.fetch = jest.fn((url: string, options?: { body?: string; method?: string }) => {
    const method = options?.method ?? 'GET';
    requests.push({ body: options?.body, method, url });
    let body: unknown = { goal };
    if (url.includes('/v1/dashboard')) body = { dashboard: { date: today, goal, meals: [], remainingCalories: 2000, timezone: 'UTC', totalCalories: 0 } };
    else if (url.includes('/v1/profile')) body = { profile };
    else if (url.includes('/v1/ai/meal-estimate')) body = { estimate: estimates++ === 0 ? plate : lassi };
    else if (url.endsWith('/v1/meals') && method === 'POST') body = { meal: { ...JSON.parse(options!.body!), id: 'm1', loggedAt: `${today}T13:00:00` } };
    else if (url.endsWith('/v1/foods') && method === 'POST') {
      const food = { ...JSON.parse(options!.body!), id: 'f1', lastUsedAt: `${today}T13:00:00Z`, timesUsed: 1 };
      foods.push(food);
      body = { food };
    } else if (url.endsWith('/v1/foods')) body = { foods };
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  }) as unknown as jest.Mock;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });

  await pressNamed(tree, 'Log a meal');
  await pressNamed(tree, 'Lunch');
  await typeInto(tree, 'Message Flip', 'roti dal and pickle');
  await pressNamed(tree, 'Send message');
  expect(textOf(tree)).toContain('Untick anything that isn’t there');
  expect(textOf(tree)).toContain('370 kcal in total');
  expect(textOf(tree)).toContain('~200 g');

  await pressNamed(tree, 'Pickle');
  expect(textOf(tree)).toContain('340 kcal in total');
  await pressNamed(tree, 'More Dal');
  expect(textOf(tree)).toContain('~210 g');
  expect(textOf(tree)).toContain('347 kcal in total');

  // Typing while reviewing adds what Flip missed.
  await typeInto(tree, 'Message Flip', 'a glass of sweet lassi');
  await pressNamed(tree, 'Send message');
  expect(textOf(tree)).toContain('Added Sweet lassi');
  expect(textOf(tree)).toContain('477 kcal in total');

  await pressNamed(tree, 'Log it');
  const created = JSON.parse(requests.find(request => request.url.endsWith('/v1/meals') && request.method === 'POST')!.body!);
  expect(created).toEqual(expect.objectContaining({ caloriesKcal: 477, mealType: 'lunch', name: 'Roti, Dal, Sweet lassi', note: 'Items: Roti ~80 g, Dal ~210 g, Sweet lassi ~250 g', proteinGrams: 14.9 }));
  const savedFood = JSON.parse(requests.find(request => request.url.endsWith('/v1/foods') && request.method === 'POST')!.body!);
  expect(savedFood).toEqual(expect.objectContaining({ caloriesKcal: 477, name: 'Roti, Dal, Sweet lassi', serving: 'Roti ~80 g, Dal ~210 g, Sweet lassi ~250 g' }));

  // The confirmed meal is offered next time under "Your meals".
  await pressNamed(tree, 'Add another');
  await pressNamed(tree, 'Pick from list');
  await ReactTestRenderer.act(() => new Promise<void>(resolve => setTimeout(resolve, 20)));
  await pressNamed(tree, 'Toggle food list');
  expect(textOf(tree)).toContain('Your meals');
  await pressNamed(tree, 'Roti, Dal, Sweet lassi');
  const calories = tree.root.find(node => node.props?.accessibilityLabel === 'Calories' && typeof node.props.onChangeText === 'function');
  expect(calories.props.value).toBe('477');
  await ReactTestRenderer.act(async () => tree.unmount());
});

test('a food search with no matches hands the query to Flip, which estimates it in the chat', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const goal = { dailyCalorieTarget: 2000, id: 'g1', startsOn: today, type: 'maintain' };
  const estimate = { assumptions: ['Two pieces'], caloriesKcal: 300, carbsGrams: 45, confidence: 'medium', fatGrams: 12, items: [{ caloriesKcal: 300, carbsGrams: 45, fatGrams: 12, grams: 80, name: 'Jalebi', proteinGrams: 2 }], name: 'Jalebi', proteinGrams: 2, source: 'ai' };
  const requests: { body?: string; method: string; url: string }[] = [];
  globalThis.fetch = jest.fn((url: string, options?: { body?: string; method?: string }) => {
    const method = options?.method ?? 'GET';
    requests.push({ body: options?.body, method, url });
    let body: unknown = { goal };
    if (url.includes('/v1/dashboard')) body = { dashboard: { date: today, goal, meals: [], remainingCalories: 2000, timezone: 'UTC', totalCalories: 0 } };
    else if (url.includes('/v1/profile')) body = { profile };
    else if (url.includes('/v1/ai/meal-estimate')) body = { estimate };
    else if (url.endsWith('/v1/foods')) body = { foods: [] };
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  }) as unknown as jest.Mock;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });

  await pressNamed(tree, 'Log a meal');
  await pressNamed(tree, 'Pick from list');
  await pressNamed(tree, 'Dinner');
  await typeInto(tree, 'Food', 'jalebi');
  expect(textOf(tree)).toContain('No foods match "jalebi"');
  await pressNamed(tree, 'Ask Flip about jalebi');
  await ReactTestRenderer.act(() => new Promise<void>(resolve => setTimeout(resolve, 20)));

  const call = requests.find(request => request.url.includes('/v1/ai/meal-estimate'));
  expect(JSON.parse(call!.body!)).toEqual({ description: 'jalebi', mealType: 'dinner' });
  const chat = textOf(tree);
  expect(chat).toContain('Couldn’t find that in the list');
  expect(chat).toContain('300 kcal in total');
  await pressNamed(tree, 'Log it');
  expect(requests.some(request => request.url.endsWith('/v1/meals') && request.method === 'POST' && JSON.parse(request.body!).mealType === 'dinner')).toBe(true);
  await ReactTestRenderer.act(async () => tree.unmount());
});

test('uploads a lab report photo, reviews what Flip read, saves it and tracks the suggested water goal on Home', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const goal = { dailyCalorieTarget: 2000, id: 'g1', startsOn: today, type: 'maintain' };
  const draft = {
    hydration: { reason: 'About 3 L a day suits most adults.', suggestedLitres: 3 },
    nutritionNotes: ['LDL is above the lab range: more fibre (oats, dal) and less fried food may help.'],
    reportDate: '2026-09-18',
    summary: 'Your LDL cholesterol is above the lab range. Please discuss these results with your doctor.',
    title: 'Lipid profile',
    urgent: false,
    values: [
      { category: 'lipids', flag: 'high', name: 'LDL Cholesterol', referenceRange: '< 130', unit: 'mg/dL', value: '162' },
      { category: 'lipids', flag: 'normal', name: 'HDL Cholesterol', referenceRange: '> 40', unit: 'mg/dL', value: '48' },
      { category: 'other', flag: 'unknown', name: 'Smudged line', referenceRange: null, unit: null, value: '7' },
    ],
  };
  const requests: { body?: string; method: string; url: string }[] = [];
  let water: { consumedMl: number; source: string | null; targetMl: number | null } = { consumedMl: 0, source: null, targetMl: null };
  let latestReport: unknown = null;
  globalThis.fetch = jest.fn((url: string, options?: { body?: string; method?: string }) => {
    const method = options?.method ?? 'GET';
    requests.push({ body: options?.body, method, url });
    let body: unknown = { goal };
    if (url.includes('/v1/dashboard')) body = { dashboard: { date: today, goal, latestReport, meals: [], remainingCalories: 2000, timezone: 'UTC', totalCalories: 0, water } };
    else if (url.includes('/v1/profile')) body = { profile };
    else if (url.includes('/v1/reports/extract')) body = { draft };
    else if (url.endsWith('/v1/reports') && method === 'POST') {
      const saved = { ...JSON.parse(options!.body!), createdAt: `${today}T09:00:00Z`, id: 'r1' };
      latestReport = { createdAt: saved.createdAt, flaggedCount: 1, id: 'r1', reportDate: saved.reportDate, title: saved.title, urgent: false, valueCount: saved.values.length };
      body = { report: saved };
    } else if (url.endsWith('/v1/reports')) body = { reports: latestReport ? [latestReport] : [] };
    else if (url.endsWith('/v1/water/target')) {
      water = { ...water, source: 'report', targetMl: JSON.parse(options!.body!).targetMl };
      body = { target: { source: water.source, targetMl: water.targetMl } };
    } else if (url.endsWith('/v1/water') && method === 'POST') {
      water = { ...water, consumedMl: water.consumedMl + JSON.parse(options!.body!).amountMl };
      body = { water: { ...water, date: today } };
    } else if (url.includes('/v1/water/last')) {
      water = { ...water, consumedMl: Math.max(0, water.consumedMl - 250) };
      body = { water: { ...water, date: today } };
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  }) as unknown as jest.Mock;
  const picker = jest.requireMock('react-native-image-picker');
  picker.launchImageLibrary.mockResolvedValueOnce({ assets: [{ base64: '/9j/4AAQSkZJRgABAQ', fileName: 'page1.jpg', type: 'image/jpeg', uri: 'file:///page1.jpg' }] });
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });

  await pressNamed(tree, 'Upload a test report');
  expect(textOf(tree)).toContain('The file itself is never stored');
  await pressNamed(tree, 'Upload report: Photos');
  const extract = requests.find(request => request.url.includes('/v1/reports/extract'));
  expect(JSON.parse(extract!.body!)).toEqual({ files: [{ base64: '/9j/4AAQSkZJRgABAQ', mimeType: 'image/jpeg' }] });
  const review = textOf(tree);
  expect(review).toContain('Check what Flip read');
  expect(review).toContain('LDL Cholesterol');
  expect(review).toContain('Lab range < 130');
  expect(review).toContain('High');
  expect(review).toContain('isn’t a diagnosis');
  expect(review).toContain('Daily water goal: 3 L');

  // Drop the misread line, keep the water goal, save.
  await pressNamed(tree, 'Smudged line');
  await pressNamed(tree, 'Save 2 values');
  const saved = JSON.parse(requests.find(request => request.url.endsWith('/v1/reports') && request.method === 'POST')!.body!);
  expect(saved.values.map((value: { name: string }) => value.name)).toEqual(['LDL Cholesterol', 'HDL Cholesterol']);
  expect(JSON.parse(requests.find(request => request.url.endsWith('/v1/water/target'))!.body!)).toEqual({ source: 'report', targetMl: 3000 });
  expect(textOf(tree)).toContain('Make a meal plan from this');

  await pressNamed(tree, 'Back');
  await pressNamed(tree, 'Back');
  await ReactTestRenderer.act(() => new Promise<void>(resolve => setTimeout(resolve, 20)));
  const home = textOf(tree);
  expect(home).toContain('Water 0 of 3 litres');
  expect(home).toContain('Lipid profile');
  expect(home).toContain('1 value to watch');

  await pressNamed(tree, 'Add 250 ml of water');
  await pressNamed(tree, 'Add 250 ml of water');
  expect(textOf(tree)).toContain('Water 0.5 of 3 litres');
  await pressNamed(tree, 'Undo last water');
  expect(textOf(tree)).toContain('Water 0.25 of 3 litres');
  await ReactTestRenderer.act(async () => tree.unmount());
});

test('a guest token the server no longer knows is replaced by a fresh guest session', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const goal = { dailyCalorieTarget: 2000, id: 'g1', startsOn: today, type: 'maintain' };
  const storage = jest.requireMock('@react-native-async-storage/async-storage');
  await storage.setItem('@healthflip/guest-token', 'stale-token');
  const auth: string[] = [];
  globalThis.fetch = jest.fn((url: string, options?: { headers?: Record<string, string>; method?: string }) => {
    const header = options?.headers?.Authorization ?? '';
    auth.push(`${url.replace(/^https?:\/\/[^/]+/, '')} ${header}`);
    if (header === 'Bearer stale-token') return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: { message: 'A valid guest session token is required.' } }) });
    let body: unknown = { goal };
    if (url.endsWith('/v1/guests')) body = { accessToken: 'fresh-token' };
    else if (url.includes('/v1/dashboard')) body = { dashboard: { date: today, goal, meals: [], remainingCalories: 2000, timezone: 'UTC', totalCalories: 0 } };
    else if (url.includes('/v1/profile')) body = { profile };
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  }) as unknown as jest.Mock;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  expect(auth.some(line => line.startsWith('/v1/guests'))).toBe(true);
  expect(await storage.getItem('@healthflip/guest-token')).toBe('fresh-token');
  expect(textOf(tree)).toContain('Hi, Priya!');
  await ReactTestRenderer.act(async () => tree.unmount());
});

test('shows a returning user the minimal meal-first Home', async () => {
  // Details starts collapsed unless the user opened it before.
  await jest.requireMock('@react-native-async-storage/async-storage').removeItem('healthflip.homeDetails');
  const today = new Date().toISOString().slice(0, 10);
  const meal = { id: 'm1', name: 'Poha with peanuts', caloriesKcal: 320, proteinGrams: 8, carbsGrams: 52, fatGrams: 9, note: null, source: 'manual', loggedAt: `${today}T08:15:00` };
  const goal = { id: 'g1', type: 'maintain', dailyCalorieTarget: 2000, startsOn: today };
  globalThis.fetch = jest.fn((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve(
          url.includes('/v1/dashboard')
            ? { dashboard: { date: today, goal, meals: [meal], remainingCalories: 1680, totalCalories: 320, timezone: 'UTC' } }
            : url.includes('/v1/profile') ? { profile } : { goal },
        ),
    }),
  ) as unknown as jest.Mock;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  const text = textOf(tree);
  expect(text).toContain('Poha with peanuts');
  expect(text).toContain('Breakfast');
  expect(text).toContain('Eaten');
  expect(text).toContain('1,680');
  expect(text).toContain('1 meal');
  // The calendar strip and meal-type groups are gone; extras sit behind Details.
  expect(text).not.toContain('Lunch');
  expect(text).not.toContain("Flip's nudge");
  await pressNamed(tree, 'Show details');
  expect(textOf(tree)).toContain("Flip's nudge");
  expect(textOf(tree)).toContain('8 / 150 g');
  await ReactTestRenderer.act(async () => tree.unmount());
});

test('loads the Progress tab when tapped from the dashboard', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const goal = { id: 'g1', type: 'maintain', dailyCalorieTarget: 2000, startsOn: today };
  globalThis.fetch = jest.fn((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve(
          url.includes('/v1/dashboard')
            ? { dashboard: { date: today, goal, meals: [], remainingCalories: 2000, totalCalories: 0, timezone: 'UTC' } }
            : url.includes('/v1/profile') ? { profile } : { goal },
        ),
    }),
  ) as unknown as jest.Mock;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  // Press the Progress nav item.
  const progress = findNavItem(tree, 'Progress');
  if (!progress) throw new Error('Progress nav item not found');
  await ReactTestRenderer.act(async () => progress.props.onPress());
  await ReactTestRenderer.act(() => new Promise<void>(resolve => setTimeout(resolve, 50)));
  expect(textOf(tree)).toContain('Your progress');
  await ReactTestRenderer.act(async () => tree.unmount());
});

test('creates, saves and downloads a meal plan from the Plans tab', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const goal = { id: 'g1', type: 'maintain', dailyCalorieTarget: 2000, startsOn: today };
  const content = {
    dailyCalories: 1800,
    days: [{ label: 'Monday', meals: [{ calories: 400, name: 'Moong dal chilla', portion: '2 chillas', proteinGrams: 18, type: 'breakfast' }, { calories: 600, name: 'Rajma chawal', portion: '1 bowl', proteinGrams: 20, type: 'lunch' }] }],
    macros: { carbsGrams: 220, fatGrams: 55, proteinGrams: 100 },
    summary: 'A simple vegetarian week.',
    tips: ['Drink water.'],
    title: "Priya's 7-day Indian meal plan",
  };
  const draft = { content, kind: 'diet', options: { cuisine: 'Indian', days: 7, dietType: 'any' }, source: 'ai' };
  const requests: { body?: string; method: string; url: string }[] = [];
  globalThis.fetch = jest.fn((url: string, options?: { body?: string; method?: string }) => {
    const method = options?.method ?? 'GET';
    requests.push({ body: options?.body, method, url });
    let body: unknown = { goal };
    if (url.includes('/v1/dashboard')) body = { dashboard: { date: today, goal, meals: [], remainingCalories: 2000, totalCalories: 0, timezone: 'UTC' } };
    else if (url.includes('/v1/profile')) body = { profile };
    else if (url.includes('/v1/plans/generate')) body = { plan: draft };
    else if (url.endsWith('/v1/plans') && method === 'POST') body = { plan: { ...draft, createdAt: `${today}T09:00:00Z`, id: 'p1', title: content.title } };
    else if (url.endsWith('/v1/plans')) body = { plans: [] };
    return Promise.resolve({ ok: true, status: method === 'POST' && url.endsWith('/v1/plans') ? 201 : 200, json: () => Promise.resolve(body) });
  }) as unknown as jest.Mock;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  const plansTab = findNavItem(tree, 'Plans');
  if (!plansTab) throw new Error('Plans nav item not found');
  await ReactTestRenderer.act(async () => plansTab.props.onPress());
  expect(textOf(tree)).toContain('Your plans');
  expect(textOf(tree)).toContain('No saved plans yet');
  // Workout plans are paused while healthFlip focuses on meals.
  expect(textOf(tree)).not.toContain('New workout plan');

  await pressNamed(tree, 'New meal plan');
  await pressNamed(tree, 'Veg');
  await pressNamed(tree, 'Create my plan');
  const generate = requests.find(request => request.url.includes('/v1/plans/generate'));
  expect(JSON.parse(generate!.body!)).toEqual({ kind: 'diet', options: { cuisine: 'Indian', days: 7, dietType: 'vegetarian' } });
  expect(textOf(tree)).toContain("Priya's 7-day Indian meal plan");
  expect(textOf(tree)).toContain('Moong dal chilla');
  // Nothing is saved until the user taps Save.
  expect(requests.some(request => request.url.endsWith('/v1/plans') && request.method === 'POST')).toBe(false);

  await pressNamed(tree, 'Save plan');
  expect(requests.some(request => request.url.endsWith('/v1/plans') && request.method === 'POST')).toBe(true);
  expect(textOf(tree)).toContain('Download PDF');

  const blobUtil = jest.requireMock('react-native-blob-util').default;
  await pressNamed(tree, 'Download PDF');
  expect(blobUtil.config).toHaveBeenCalledWith({ path: "/docs/priya-s-7-day-indian-meal-plan.pdf" });
  const fetchPdf = blobUtil.config.mock.results[0].value.fetch;
  expect(fetchPdf).toHaveBeenCalledWith('GET', expect.stringMatching(/\/v1\/plans\/p1\/pdf$/), { Authorization: expect.stringMatching(/^Bearer /) });
  expect(blobUtil.ios.openDocument).toHaveBeenCalledWith('/docs/priya-s-7-day-indian-meal-plan.pdf');
  await ReactTestRenderer.act(async () => tree.unmount());
});

test('loads the Tips tab and curated content', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const goal = { id: 'g1', type: 'maintain', dailyCalorieTarget: 2000, startsOn: today };
  globalThis.fetch = jest.fn((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve(
          url.includes('/v1/dashboard')
            ? { dashboard: { date: today, goal, meals: [], remainingCalories: 2000, totalCalories: 0, timezone: 'UTC' } }
            : url.includes('/v1/profile') ? { profile } : { goal },
        ),
    }),
  ) as unknown as jest.Mock;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  const tips = findNavItem(tree, 'Tips');
  if (!tips) throw new Error('Tips nav item not found');
  await ReactTestRenderer.act(async () => tips.props.onPress());
  expect(textOf(tree)).toContain('Tips for you');
  expect(textOf(tree)).toContain('Build meals around protein and fiber');
  await ReactTestRenderer.act(async () => tree.unmount());
});
