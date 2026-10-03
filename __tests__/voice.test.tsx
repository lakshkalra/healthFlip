/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import * as audio from '@mindinventory/react-native-nitro-realtime-audio';
import { VoiceConversationScreen } from '../src/voice';
import { buildSetupMessage, decodeUtf8Fallback, parseServerMessage } from '../src/voiceProtocol';
import * as client from '../src/api/client';

jest.mock('../src/api/client', () => ({
  createLiveSession: jest.fn(),
  createMeal: jest.fn(),
  estimateMeal: jest.fn(),
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
  return parts.join(' ');
};

async function press(tree: ReactTestRenderer.ReactTestRenderer, title: string) {
  const button = tree.root.findAll(node => node.props?.accessibilityRole === 'button' && typeof node.props.onPress === 'function')
    .find(node => node.findAll(child => child.children.some((grandchild: unknown) => grandchild === title)).length > 0);
  if (!button) throw new Error(`No button titled ${title}`);
  await ReactTestRenderer.act(async () => { await button.props.onPress(); });
}

async function serverSends(socket: FakeSocket, message: unknown) {
  await ReactTestRenderer.act(async () => { socket.onmessage?.({ data: encode(message) }); });
}

async function renderAndConnect() {
  const onMealLogged = jest.fn();
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<VoiceConversationScreen mealType="lunch" onClose={jest.fn()} onMealLogged={onMealLogged} />);
  });
  await press(tree, 'Start conversation');
  const socket = FakeSocket.instances[FakeSocket.instances.length - 1];
  await ReactTestRenderer.act(async () => { socket.onopen?.(); });
  return { onMealLogged, socket, tree };
}

beforeEach(() => {
  jest.clearAllMocks();
  FakeSocket.instances = [];
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeSocket;
  api.createLiveSession.mockResolvedValue({ expiresAt: '2026-10-03T00:00:00Z', model: 'gemini-live-test', token: 'ephemeral', websocketUrl: 'wss://live.example/ws' });
  api.estimateMeal.mockResolvedValue({ assumptions: [], caloriesKcal: 410, carbsGrams: 58.5, confidence: 'medium', fatGrams: 9.2, name: 'Roti and dal', proteinGrams: 16.4, source: 'ai' });
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
});

describe('VoiceConversationScreen', () => {
  test('sends setup first and starts native audio only after setupComplete', async () => {
    const { socket, tree } = await renderAndConnect();

    expect(socket.binaryType).toBe('arraybuffer');
    expect(socket.url).toBe('wss://live.example/ws?access_token=ephemeral');
    expect(socket.sent).toEqual([buildSetupMessage('gemini-live-test')]);
    expect(nativeAudio.startRecording).not.toHaveBeenCalled();

    const sendChunk = nativeAudio.onAudioChunk.mock.calls[0][0] as (buffer: ArrayBuffer) => void;
    sendChunk(new Uint8Array([1, 2]).buffer);
    expect(socket.sent).toHaveLength(1);

    await serverSends(socket, { setupComplete: {} });
    expect(nativeAudio.initializePlayer).toHaveBeenCalledWith(expect.objectContaining({ sampleRate: 24000 }));
    expect(nativeAudio.startRecording).toHaveBeenCalledWith(expect.objectContaining({ sampleRate: 16000 }));
    expect(textOf(tree)).toContain('Listening');

    sendChunk(new Uint8Array([1, 2]).buffer);
    expect(JSON.parse(socket.sent[1])).toEqual({ realtimeInput: { audio: { data: 'AQI=', mimeType: 'audio/pcm;rate=16000' } } });
  });

  test('accumulates transcript fragments and logs a meal only after Confirm and log', async () => {
    const { onMealLogged, socket, tree } = await renderAndConnect();
    await serverSends(socket, { setupComplete: {} });

    await serverSends(socket, { serverContent: { inputTranscription: { text: 'I had two' } } });
    await serverSends(socket, { serverContent: { inputTranscription: { text: ' rotis and dal' } } });
    await serverSends(socket, { serverContent: { outputTranscription: { text: 'Sounds' } } });
    await serverSends(socket, { serverContent: { outputTranscription: { text: ' wholesome.' }, modelTurn: { parts: [{ inlineData: { data: 'AAAA' } }] } } });
    expect(textOf(tree)).toContain('I had two rotis and dal');
    expect(textOf(tree)).toContain('Sounds wholesome.');
    expect(textOf(tree)).toContain('Kimbo is speaking');
    expect(nativeAudio.playChunk).toHaveBeenCalledTimes(1);

    await serverSends(socket, { serverContent: { turnComplete: true } });
    expect(api.estimateMeal).toHaveBeenCalledWith('I had two rotis and dal', 'lunch');
    expect(textOf(tree)).toContain('Roti and dal');
    expect(api.createMeal).not.toHaveBeenCalled();

    await press(tree, 'Confirm and log');
    expect(api.createMeal).toHaveBeenCalledWith(expect.objectContaining({ caloriesKcal: 410, name: 'Roti and dal', proteinGrams: 16.4, source: 'voice' }));
    expect(onMealLogged).toHaveBeenCalledTimes(1);
  });

  test('ending the conversation with a pending estimate does not log it', async () => {
    const { socket, tree } = await renderAndConnect();
    await serverSends(socket, { setupComplete: {} });
    await serverSends(socket, { serverContent: { inputTranscription: { text: 'I ate paneer for dinner' } } });
    await serverSends(socket, { serverContent: { turnComplete: true } });

    await press(tree, 'End conversation');
    expect(socket.close).toHaveBeenCalled();
    expect(nativeAudio.stopRecording).toHaveBeenCalled();
    expect(api.createMeal).not.toHaveBeenCalled();
  });

  test('a close before setupComplete surfaces an error instead of hanging on Connecting', async () => {
    const { socket, tree } = await renderAndConnect();
    await ReactTestRenderer.act(async () => { socket.onclose?.({ code: 1007, reason: 'Invalid setup' }); });

    expect(nativeAudio.startRecording).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('Connection needs attention');
    expect(textOf(tree)).toContain('Invalid setup');
    expect(textOf(tree)).toContain('Start conversation');
  });

  test('microphone denial is recoverable and never opens a socket', async () => {
    nativeAudio.requestMicrophonePermission.mockResolvedValueOnce('denied' as never);
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<VoiceConversationScreen mealType="lunch" onClose={jest.fn()} onMealLogged={jest.fn()} />);
    });
    await press(tree, 'Start conversation');

    expect(FakeSocket.instances).toHaveLength(0);
    expect(api.createLiveSession).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('Microphone access is needed');
    expect(textOf(tree)).toContain('Start conversation');
  });
});
