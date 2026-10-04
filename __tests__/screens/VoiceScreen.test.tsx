/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import * as audio from '@mindinventory/react-native-nitro-realtime-audio';
import { VoiceScreen, planRequestFromArgs } from '../../src/screens/voice/VoiceScreen';
import { buildSetupMessage, decodeUtf8Fallback, mealTypeFromText, parseServerMessage } from '../../src/features/voice/protocol';
import * as client from '../../src/services/api';

jest.mock('../../src/services/api', () => ({
  createLiveSession: jest.fn(),
  createMeal: jest.fn(),
  estimateMeal: jest.fn(),
  generatePlan: jest.fn(),
  saveFood: jest.fn(() => Promise.resolve({})),
  saveMemory: jest.fn(),
  savePlan: jest.fn(),
}));

const api = client as jest.Mocked<typeof client>;
const nativeAudio = audio as jest.Mocked<typeof audio>;

class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  binaryType = 'blob';
  readyState = FakeSocket.OPEN;
  sent: string[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: unknown }) => void;
  onerror?: () => void;
  onclose?: (event: { code: number; reason: string }) => void;
  close = jest.fn();
  constructor(public url: string) { FakeSocket.instances.push(this); }
  send(data: string) { this.sent.push(data); }
}

// TextEncoder exists in Jest's Node runtime but not in the React Native type definitions.
const { TextEncoder: Utf8Encoder } = globalThis as unknown as { TextEncoder: new () => { encode: (text: string) => Uint8Array } };
const encode = (value: unknown) => new Utf8Encoder().encode(JSON.stringify(value)).buffer as ArrayBuffer;

// Transcript lines type in character by character, so read their accessibility labels (the full text) too.
const textOf = (tree: ReactTestRenderer.ReactTestRenderer) => {
  const parts: string[] = [];
  tree.root.findAll(node => typeof node.type === 'string').forEach(node => {
    if (typeof node.props.accessibilityLabel === 'string') parts.push(node.props.accessibilityLabel);
    const own = node.children.filter((child): child is string => typeof child === 'string').join('');
    if (own) parts.push(own);
  });
  return parts.join(' ');
};

// Buttons are matched by accessibility label (icon controls) or by their visible title.
async function press(tree: ReactTestRenderer.ReactTestRenderer, name: string) {
  const button = tree.root.findAll(node => node.props?.accessibilityRole === 'button' && typeof node.props.onPress === 'function')
    .find(node => node.props.accessibilityLabel === name
      || node.findAll(child => child.children.some((grandchild: unknown) => grandchild === name)).length > 0);
  if (!button) throw new Error(`No button named ${name}`);
  await ReactTestRenderer.act(async () => { await button.props.onPress(); });
}

async function serverSends(socket: FakeSocket, message: unknown) {
  await ReactTestRenderer.act(async () => { socket.onmessage?.({ data: encode(message) }); });
}

// Unmounted after each test so typing and thinking timers don't outlive the Jest environment.
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

async function render(props: Partial<React.ComponentProps<typeof VoiceScreen>> = {}) {
  const onMealLogged = jest.fn();
  const onClose = jest.fn();
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<VoiceScreen mealType="lunch" remainingCalories={1000} onClose={onClose} onMealLogged={onMealLogged} {...props} />);
  });
  mounted.push(tree);
  return { onClose, onMealLogged, tree };
}

async function renderAndConnect(props: Partial<React.ComponentProps<typeof VoiceScreen>> = {}) {
  const rendered = await render(props);
  await press(rendered.tree, 'Start talking to Flip');
  const socket = FakeSocket.instances[FakeSocket.instances.length - 1];
  await ReactTestRenderer.act(async () => { socket.onopen?.(); });
  return { ...rendered, socket };
}

const sentMessages = (socket: FakeSocket) => socket.sent.map(message => JSON.parse(message));

afterEach(async () => {
  await ReactTestRenderer.act(async () => { mounted.splice(0).forEach(tree => tree.unmount()); });
});

beforeEach(() => {
  jest.clearAllMocks();
  FakeSocket.instances = [];
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeSocket;
  api.createLiveSession.mockResolvedValue({ expiresAt: '2026-10-03T00:00:00Z', model: 'gemini-live-test', token: 'ephemeral', websocketUrl: 'wss://live.example/ws' });
  api.estimateMeal.mockResolvedValue({ assumptions: ['2 rotis, 1 bowl dal'], caloriesKcal: 410, carbsGrams: 58.5, confidence: 'medium', fatGrams: 9.2, name: 'Roti and dal', proteinGrams: 16.4, source: 'ai' });
  api.createMeal.mockResolvedValue(undefined as never);
});

describe('voice protocol helpers', () => {
  test('setup message carries only the model; the token locks the rest', () => {
    expect(JSON.parse(buildSetupMessage('gemini-live-test'))).toEqual({ setup: { model: 'models/gemini-live-test' } });
  });

  test('parses string, ArrayBuffer and typed-array frames and ignores malformed JSON', () => {
    expect(parseServerMessage('{"setupComplete":{}}')).toEqual({ setupComplete: {} });
    expect(parseServerMessage(encode({ setupComplete: {} }))).toEqual({ setupComplete: {} });
    expect(parseServerMessage(new Uint8Array(encode({ goAway: { timeLeft: '5s' } })))).toEqual({ goAway: { timeLeft: '5s' } });
    expect(parseServerMessage('{not json')).toBeNull();
    expect(parseServerMessage(42)).toBeNull();
  });

  test('UTF-8 fallback matches TextDecoder for Devanagari and emoji', () => {
    const text = 'Maine दाल चावल khaya 🍛';
    expect(decodeUtf8Fallback(new Utf8Encoder().encode(text))).toBe(text);
  });

  test('maps create_plan arguments onto valid plan options', () => {
    expect(planRequestFromArgs({ days: 5, dietType: 'vegetarian', kind: 'diet' })).toEqual({ kind: 'diet', options: { cuisine: undefined, days: 7, dietType: 'vegetarian', notes: undefined } });
    expect(planRequestFromArgs({ days: 2, dietType: 'paleo', kind: 'diet' })?.options).toEqual(expect.objectContaining({ days: 3, dietType: undefined }));
    // Workout plans are paused while healthFlip focuses on meals.
    expect(planRequestFromArgs({ daysPerWeek: 3, kind: 'exercise' })).toBeNull();
    expect(planRequestFromArgs({ kind: 'yoga' })).toBeNull();
  });

  test('an explicitly named meal overrides the time-of-day default', () => {
    expect(mealTypeFromText('Poha and chai for breakfast')).toBe('breakfast');
    expect(mealTypeFromText('A paneer tikka wrap as a snack')).toBe('snacks');
    expect(mealTypeFromText('I had two rotis')).toBeNull();
  });
});

describe('Flip voice agent', () => {
  test('sends setup first and starts native audio only after setupComplete', async () => {
    const { socket, tree } = await renderAndConnect();

    expect(socket.binaryType).toBe('arraybuffer');
    expect(socket.url).toBe('wss://live.example/ws?access_token=ephemeral');
    expect(socket.sent).toEqual([buildSetupMessage('gemini-live-test')]);
    expect(nativeAudio.startRecording).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('Connecting…');

    const sendChunk = nativeAudio.onAudioChunk.mock.calls[0][0] as (buffer: ArrayBuffer) => void;
    sendChunk(new Uint8Array([1, 2]).buffer);
    expect(socket.sent).toHaveLength(1);

    await serverSends(socket, { setupComplete: {} });
    expect(nativeAudio.initializePlayer).toHaveBeenCalledWith(expect.objectContaining({ sampleRate: 24000 }));
    expect(nativeAudio.startRecording).toHaveBeenCalledWith(expect.objectContaining({ sampleRate: 16000 }));
    expect(textOf(tree)).toContain('Listening…');

    sendChunk(new Uint8Array([1, 2]).buffer);
    expect(JSON.parse(socket.sent[1])).toEqual({ realtimeInput: { audio: { data: 'AQI=', mimeType: 'audio/pcm;rate=16000' } } });
  });

  test('accumulates transcript fragments and logs a meal only after Add to Lunch', async () => {
    const { onMealLogged, socket, tree } = await renderAndConnect();
    await serverSends(socket, { setupComplete: {} });

    await serverSends(socket, { serverContent: { inputTranscription: { text: 'I had two' } } });
    await serverSends(socket, { serverContent: { inputTranscription: { text: ' rotis and dal' } } });
    await serverSends(socket, { serverContent: { outputTranscription: { text: 'Sounds' } } });
    await serverSends(socket, { serverContent: { outputTranscription: { text: ' wholesome.' }, modelTurn: { parts: [{ inlineData: { data: 'AAAA' } }] } } });
    expect(textOf(tree)).toContain('I had two rotis and dal');
    expect(textOf(tree)).toContain('Sounds wholesome.');
    expect(textOf(tree)).toContain('Flip is speaking');
    expect(nativeAudio.playChunk).toHaveBeenCalledTimes(1);

    await serverSends(socket, { serverContent: { turnComplete: true } });
    expect(api.estimateMeal).toHaveBeenCalledWith('I had two rotis and dal', 'lunch');
    expect(textOf(tree)).toContain('Got it. That’s about 410 kcal with 16.4g protein. Should I add it to lunch?');
    expect(textOf(tree)).toContain('Roti and dal');
    expect(textOf(tree)).toContain('2 rotis, 1 bowl dal');
    expect(api.createMeal).not.toHaveBeenCalled();

    await press(tree, 'Add to Lunch');
    expect(api.createMeal).toHaveBeenCalledWith(expect.objectContaining({ caloriesKcal: 410, mealType: 'lunch', name: 'Roti and dal', proteinGrams: 16.4, source: 'voice' }));
    // The confirmed meal is also offered later in "Pick from list".
    expect(api.saveFood).toHaveBeenCalledWith(expect.objectContaining({ caloriesKcal: 410, name: 'Roti and dal', serving: '1 serving' }));
    expect(onMealLogged).toHaveBeenCalledTimes(1);
    expect(textOf(tree)).toContain('Logged to Lunch');
    expect(textOf(tree)).toContain('Done. Lunch is logged. You have 590 kcal left today.');
  });

  test('a show_meal_card tool call (e.g. Hindi speech) shows the card and answers Gemini with the estimate', async () => {
    const { socket, tree } = await renderAndConnect();
    await serverSends(socket, { setupComplete: {} });
    await serverSends(socket, { serverContent: { inputTranscription: { text: 'मैंने लंच में दो रोटी और दाल खाई' } } });
    await serverSends(socket, { toolCall: { functionCalls: [{ args: { description: 'two rotis and dal', mealType: 'lunch' }, id: 'call-1', name: 'show_meal_card' }] } });

    expect(api.estimateMeal).toHaveBeenCalledWith('two rotis and dal', 'lunch');
    expect(textOf(tree)).toContain('Roti and dal');
    expect(textOf(tree)).not.toContain('Got it.');
    expect(sentMessages(socket).at(-1)).toEqual({
      toolResponse: { functionResponses: [{ id: 'call-1', name: 'show_meal_card', response: expect.objectContaining({ caloriesKcal: 410, mealType: 'lunch', name: 'Roti and dal' }) }] },
    });

    // The keyword fallback stays off once the tool is in use, so the turn end adds no second card.
    await serverSends(socket, { serverContent: { inputTranscription: { text: ' I had dal' } } });
    await serverSends(socket, { serverContent: { turnComplete: true } });
    expect(api.estimateMeal).toHaveBeenCalledTimes(1);
    expect(api.createMeal).not.toHaveBeenCalled();
  });

  test('an unknown or failed tool call is answered with an error so Gemini can recover', async () => {
    api.estimateMeal.mockRejectedValueOnce(new Error('offline'));
    const { socket } = await renderAndConnect();
    await serverSends(socket, { setupComplete: {} });

    await serverSends(socket, { toolCall: { functionCalls: [{ args: {}, id: 'call-x', name: 'delete_everything' }] } });
    expect(sentMessages(socket).at(-1).toolResponse.functionResponses[0]).toEqual(expect.objectContaining({ id: 'call-x', response: { error: 'Unknown tool delete_everything' } }));

    await serverSends(socket, { toolCall: { functionCalls: [{ args: { description: 'poha' }, id: 'call-2', name: 'show_meal_card' }] } });
    expect(sentMessages(socket).at(-1).toolResponse.functionResponses[0]).toEqual(expect.objectContaining({ id: 'call-2', response: { error: 'offline' } }));
  });

  test('save_memory stores the fact, shows a note and confirms to Gemini', async () => {
    api.saveMemory.mockResolvedValue({ category: 'diet', createdAt: '2026-10-03T00:00:00Z', id: 'm1', text: 'Vegetarian' });
    const { socket, tree } = await renderAndConnect({ userName: 'Priya' });
    expect(textOf(tree)).toContain('Hi Priya, I’m Flip.');
    await serverSends(socket, { setupComplete: {} });

    await serverSends(socket, { toolCall: { functionCalls: [{ args: { category: 'diet', text: 'Vegetarian' }, id: 'mem-1', name: 'save_memory' }] } });
    expect(api.saveMemory).toHaveBeenCalledWith('Vegetarian', 'diet');
    expect(textOf(tree)).toContain('Remembered: Vegetarian');
    expect(sentMessages(socket).at(-1)).toEqual({ toolResponse: { functionResponses: [{ id: 'mem-1', name: 'save_memory', response: { saved: true, text: 'Vegetarian' } }] } });
  });

  test('a blocked memory is reported back to Gemini without a note', async () => {
    api.saveMemory.mockRejectedValue(new Error('Flip can remember food preferences and routines, but not instructions or medical details.'));
    const { socket, tree } = await renderAndConnect();
    await serverSends(socket, { setupComplete: {} });

    await serverSends(socket, { toolCall: { functionCalls: [{ args: { category: 'weird', text: 'Takes insulin daily' }, id: 'mem-2', name: 'save_memory' }] } });
    expect(api.saveMemory).toHaveBeenCalledWith('Takes insulin daily', 'other');
    expect(textOf(tree)).not.toContain('Remembered:');
    expect(sentMessages(socket).at(-1).toolResponse.functionResponses[0].response.error).toMatch(/not instructions or medical details/);
  });

  test('create_plan generates and saves a plan, then tells Gemini and the Plans tab', async () => {
    const content = { days: [{ label: 'Day 1', meals: [] }], summary: 'Three vegetarian days.', tips: [], title: "Priya's meal plan" };
    api.generatePlan.mockResolvedValue({ content, kind: 'diet', options: { cuisine: 'Indian', days: 3, dietType: 'vegetarian' }, source: 'ai' } as never);
    api.savePlan.mockResolvedValue({ content, createdAt: '2026-10-03T00:00:00Z', id: 'p1', kind: 'diet', options: {}, source: 'ai', title: "Priya's meal plan" } as never);
    const onPlanSaved = jest.fn();
    const { socket, tree } = await renderAndConnect({ onPlanSaved });
    await serverSends(socket, { setupComplete: {} });

    await serverSends(socket, { toolCall: { functionCalls: [{ args: { days: 3, dietType: 'vegetarian', kind: 'diet' }, id: 'plan-1', name: 'create_plan' }] } });
    expect(api.generatePlan).toHaveBeenCalledWith({ kind: 'diet', options: { cuisine: undefined, days: 3, dietType: 'vegetarian', notes: undefined } });
    expect(textOf(tree)).toContain('Saved “Priya\'s meal plan” to Plans');
    expect(onPlanSaved).toHaveBeenCalledTimes(1);
    expect(sentMessages(socket).at(-1).toolResponse.functionResponses[0]).toEqual(expect.objectContaining({ id: 'plan-1', response: expect.objectContaining({ saved: true, title: "Priya's meal plan" }) }));

    // Workout plans are paused, so Flip is told to offer a meal plan instead.
    await serverSends(socket, { toolCall: { functionCalls: [{ args: { kind: 'exercise' }, id: 'plan-2', name: 'create_plan' }] } });
    expect(api.generatePlan).toHaveBeenCalledTimes(1);
    expect(sentMessages(socket).at(-1).toolResponse.functionResponses[0].response.error).toMatch(/Only meal plans/);
  });

  test('tapping the mic while a card is pending confirms it', async () => {
    const { socket, tree } = await renderAndConnect({ remainingCalories: 300 });
    await serverSends(socket, { setupComplete: {} });
    await serverSends(socket, { serverContent: { inputTranscription: { text: 'I ate paneer for dinner' } } });
    await serverSends(socket, { serverContent: { turnComplete: true } });
    expect(api.estimateMeal).toHaveBeenCalledWith('I ate paneer for dinner', 'dinner');

    await press(tree, 'Add this meal');
    expect(api.createMeal).toHaveBeenCalledWith(expect.objectContaining({ mealType: 'dinner' }));
    expect(textOf(tree)).toContain('You’re 110 kcal over today, so keep the rest of today light.');
  });

  test('closing with a pending card does not log it', async () => {
    const { onClose, socket, tree } = await renderAndConnect();
    await serverSends(socket, { setupComplete: {} });
    await serverSends(socket, { serverContent: { inputTranscription: { text: 'I ate paneer for dinner' } } });
    await serverSends(socket, { serverContent: { turnComplete: true } });

    await press(tree, 'Close Flip');
    expect(onClose).toHaveBeenCalled();
    expect(socket.close).toHaveBeenCalled();
    expect(nativeAudio.stopRecording).toHaveBeenCalled();
    expect(api.createMeal).not.toHaveBeenCalled();
  });

  test('a suggestion chip before connecting is sent as text once setup completes', async () => {
    const { tree } = await render();
    await press(tree, 'Poha and chai for breakfast');
    const socket = FakeSocket.instances[0];
    await ReactTestRenderer.act(async () => { socket.onopen?.(); });
    expect(sentMessages(socket)).toHaveLength(1);

    await serverSends(socket, { setupComplete: {} });
    expect(sentMessages(socket)[1]).toEqual({ realtimeInput: { text: 'Poha and chai for breakfast' } });
    expect(textOf(tree)).toContain('Thinking…');

    await serverSends(socket, { serverContent: { turnComplete: true } });
    expect(api.estimateMeal).toHaveBeenCalledWith('Poha and chai for breakfast', 'breakfast');
  });

  test('a handed-over question (Ask Flip about this report) starts the session and is sent on its own', async () => {
    const question = 'Can you explain my Lipid profile report? These were outside the lab range: LDL Cholesterol 162 mg/dL (high, lab range < 130).';
    const { tree } = await render({ initialQuestion: question });
    const socket = FakeSocket.instances[0];
    expect(socket).toBeDefined();
    await ReactTestRenderer.act(async () => { socket.onopen?.(); });
    await serverSends(socket, { setupComplete: {} });
    expect(sentMessages(socket)[1]).toEqual({ realtimeInput: { text: question } });
    expect(textOf(tree)).toContain('Can you explain my Lipid profile report?');
    // Sent once only, even if the screen re-renders.
    await serverSends(socket, { serverContent: { turnComplete: true } });
    expect(sentMessages(socket).filter(message => message.realtimeInput?.text === question)).toHaveLength(1);
  });

  test('mute streams silence instead of mic audio so Gemini can still close the turn', async () => {
    const { socket, tree } = await renderAndConnect();
    await serverSends(socket, { setupComplete: {} });
    const sendChunk = nativeAudio.onAudioChunk.mock.calls[0][0] as (buffer: ArrayBuffer) => void;

    await press(tree, 'Mute microphone');
    expect(textOf(tree)).toContain('Muted');
    sendChunk(new Uint8Array([1, 2, 3]).buffer);
    expect(sentMessages(socket).at(-1)).toEqual({ realtimeInput: { audio: { data: 'AAAA', mimeType: 'audio/pcm;rate=16000' } } });

    await press(tree, 'Unmute microphone');
    sendChunk(new Uint8Array([1, 2, 3]).buffer);
    expect(sentMessages(socket).at(-1)).toEqual({ realtimeInput: { audio: { data: 'AQID', mimeType: 'audio/pcm;rate=16000' } } });
  });

  test('local VAD moves from listening to thinking when the user stops speaking', async () => {
    const { socket, tree } = await renderAndConnect();
    await serverSends(socket, { setupComplete: {} });
    const vad = nativeAudio.onVoiceActivity.mock.calls[0][0] as (event: { isSpeaking: boolean; rms: number }) => void;

    await ReactTestRenderer.act(async () => { vad({ isSpeaking: true, rms: 0.1 }); });
    expect(textOf(tree)).toContain('Listening…');
    await ReactTestRenderer.act(async () => { vad({ isSpeaking: false, rms: 0.01 }); });
    expect(textOf(tree)).toContain('Thinking…');
    await serverSends(socket, { serverContent: { modelTurn: { parts: [{ inlineData: { data: 'AAAA' } }] } } });
    expect(textOf(tree)).toContain('Flip is speaking');
  });

  test('a close before setupComplete surfaces an error instead of hanging on Connecting', async () => {
    const { socket, tree } = await renderAndConnect();
    await ReactTestRenderer.act(async () => { socket.onclose?.({ code: 1007, reason: 'Invalid setup' }); });

    expect(nativeAudio.startRecording).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('Tap the mic to try again');
    expect(textOf(tree)).toContain('Invalid setup');
  });

  test('microphone denial is recoverable and never opens a socket', async () => {
    nativeAudio.requestMicrophonePermission.mockResolvedValueOnce('denied' as never);
    const { tree } = await render();
    await press(tree, 'Start talking to Flip');

    expect(FakeSocket.instances).toHaveLength(0);
    expect(api.createLiveSession).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('I need microphone access');
    expect(textOf(tree)).toContain('Tap the mic to try again');
  });

  test('the keyboard button ends the session and hands off to text chat', async () => {
    const onOpenText = jest.fn();
    const { socket, tree } = await renderAndConnect({ onOpenText });
    await serverSends(socket, { setupComplete: {} });

    await press(tree, 'Type to Flip instead');
    expect(onOpenText).toHaveBeenCalled();
    expect(socket.close).toHaveBeenCalled();
  });
});
