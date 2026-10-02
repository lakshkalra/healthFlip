/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

type Node = ReactTestRenderer.ReactTestRendererJSON | ReactTestRenderer.ReactTestRendererJSON[] | string | null;
const textOf = (tree: ReactTestRenderer.ReactTestRenderer) => {
  const parts: string[] = [];
  const walk = (node: Node | undefined) => {
    if (!node) return;
    if (typeof node === 'string') parts.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else node.children?.forEach(walk);
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

test('routes a first-run guest to goal setup', async () => {
  globalThis.fetch = jest.fn((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(url.endsWith('/v1/guests') ? { accessToken: 'token' } : { goal: null }),
    }),
  ) as unknown as jest.Mock;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  expect(textOf(tree)).toContain("Welcome! Glad you're here.");
  await ReactTestRenderer.act(() => new Promise<void>(resolve => setTimeout(resolve, 1300)));
  expect(textOf(tree)).toContain('What are you aiming for?');
  expect(textOf(tree)).toContain('Set my goal');
  await ReactTestRenderer.act(async () => tree.unmount());
});

test('shows a returning user the dashboard grouped by meal type', async () => {
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
            : { goal },
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
  expect(text).toContain('kcal left');
  expect(text).toContain('1 meal today');
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
            : { goal },
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

test('shows the Rewards coming-soon screen', async () => {
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
            : { goal },
        ),
    }),
  ) as unknown as jest.Mock;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  const rewards = findNavItem(tree, 'Rewards');
  if (!rewards) throw new Error('Rewards nav item not found');
  await ReactTestRenderer.act(async () => rewards.props.onPress());
  expect(textOf(tree)).toContain('Rewards are coming soon');
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
            : { goal },
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
