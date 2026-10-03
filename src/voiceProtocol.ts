// Gemini Live wire protocol helpers. Kept free of React/native imports so they stay unit-testable.

export type LiveServerMessage = {
  goAway?: { timeLeft?: string };
  setupComplete?: Record<string, never>;
  serverContent?: {
    generationComplete?: boolean;
    inputTranscription?: { text?: string };
    interrupted?: boolean;
    modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
    outputTranscription?: { text?: string };
    turnComplete?: boolean;
  };
};

export const inputAudioMimeType = 'audio/pcm;rate=16000';
export const outputSampleRate = 24000;

// The ephemeral token already locks generation config, voice, transcription and the system
// instruction. Gemini rejects unknown top-level setup fields (e.g. responseModalities) with 1007.
export function buildSetupMessage(model: string): string {
  return JSON.stringify({ setup: { model: `models/${model}` } });
}

export function buildAudioMessage(base64Pcm: string): string {
  return JSON.stringify({ realtimeInput: { audio: { data: base64Pcm, mimeType: inputAudioMimeType } } });
}

// Gemini sends every server message as a binary frame containing UTF-8 JSON.
export function parseServerMessage(data: unknown): LiveServerMessage | null {
  let text: string;
  if (typeof data === 'string') text = data;
  else if (data instanceof ArrayBuffer) text = decodeUtf8(new Uint8Array(data));
  else if (ArrayBuffer.isView(data)) text = decodeUtf8(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  else return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed as LiveServerMessage : null;
  } catch {
    return null;
  }
}

type Utf8Decoder = new (label: string) => { decode: (bytes: Uint8Array) => string };

export function decodeUtf8(bytes: Uint8Array): string {
  const Decoder = (globalThis as { TextDecoder?: Utf8Decoder }).TextDecoder;
  return Decoder ? new Decoder('utf-8').decode(bytes) : decodeUtf8Fallback(bytes);
}

// Used when the JS engine lacks TextDecoder; transcripts may contain Devanagari, so ASCII-only is not enough.
/* eslint-disable no-bitwise */
export function decodeUtf8Fallback(bytes: Uint8Array): string {
  const chunks: string[] = [];
  let units: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    let cp: number;
    if (b < 0x80) cp = b;
    else if (b >= 0xf0) cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    else if (b >= 0xe0) cp = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    else if (b >= 0xc0) cp = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
    else cp = 0xfffd;
    if (cp > 0xffff) {
      cp -= 0x10000;
      units.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      units.push(cp);
    }
    if (units.length >= 8192) {
      chunks.push(String.fromCharCode(...units));
      units = [];
    }
  }
  chunks.push(String.fromCharCode(...units));
  return chunks.join('');
}
/* eslint-enable no-bitwise */

export function looksLikeMeal(text: string): boolean {
  return /\b(ate|had|eat|meal|breakfast|lunch|dinner|snack|khaya|khayi|khana|roti|rice|dal|paneer|chicken|egg|omelet|omelette)\b/i.test(text);
}
