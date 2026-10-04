import type { Asset } from 'react-native-image-picker';

import type { ImageMimeType } from './types';

export type MealImage = {
  base64: string;
  mimeType: ImageMimeType;
  uri: string;
};

// The API accepts about 1.5 MB of image bytes (2,000,000 base64 characters).
const MAX_BASE64_LENGTH = 1_900_000;

export async function chooseMealImage(source: 'camera' | 'library'): Promise<MealImage | null> {
  const picker = require('react-native-image-picker') as {
    launchCamera: (input: PickerOptions) => Promise<PickerResponse>;
    launchImageLibrary: (input: PickerOptions) => Promise<PickerResponse>;
  };
  const pick = (size: number, quality: 0.5 | 0.6) => {
    const options: PickerOptions = { assetRepresentationMode: 'compatible', includeBase64: true, maxHeight: size, maxWidth: size, mediaType: 'photo', quality, selectionLimit: 1 };
    return source === 'camera' ? picker.launchCamera(options) : picker.launchImageLibrary(options);
  };
  const response = await pick(1280, 0.6);
  if (response.didCancel) return null;
  if (response.errorCode) throw new Error(pickerErrorMessage(response.errorCode, source));
  const asset = response.assets?.[0];
  if (!asset) return null;
  const image = normalizeImage(asset);
  if (image.base64.length <= MAX_BASE64_LENGTH || source === 'camera') return checkSize(image);
  // Large library photos get one smaller pass before giving up.
  const retry = await pick(1024, 0.5);
  const smaller = retry.assets?.[0];
  return checkSize(smaller ? normalizeImage(smaller) : image);
}

export type ReportPage = { base64: string; mimeType: ImageMimeType | 'application/pdf'; name: string; uri: string };

// The production API runs on Vercel, which accepts request bodies up to 4.5 MB, so one upload
// stays under about 3 MB of file data (base64 is 4/3 of that).
const MAX_REPORT_TOTAL_BASE64 = 4_200_000;

/**
 * Report pages to send to Flip: up to 5 photos (sharper than meal photos so small print stays
 * readable) or one PDF. Returns [] when the user cancels.
 */
export async function chooseReportPages(source: 'camera' | 'library' | 'pdf'): Promise<ReportPage[]> {
  const pages = source === 'pdf' ? await pickPdf() : await pickReportPhotos(source);
  if (pages.reduce((total, page) => total + page.base64.length, 0) > MAX_REPORT_TOTAL_BASE64) {
    throw new Error(source === 'pdf'
      ? 'That PDF is too large to upload (about 3 MB max). Try photos of the pages instead.'
      : 'Those pages are too large together. Try fewer pages at a time.');
  }
  return pages;
}

async function pickReportPhotos(source: 'camera' | 'library'): Promise<ReportPage[]> {
  const picker = require('react-native-image-picker') as {
    launchCamera: (input: object) => Promise<PickerResponse>;
    launchImageLibrary: (input: object) => Promise<PickerResponse>;
  };
  const options = { assetRepresentationMode: 'compatible', includeBase64: true, maxHeight: 1700, maxWidth: 1700, mediaType: 'photo', quality: 0.55, selectionLimit: source === 'library' ? 5 : 1 };
  const response = source === 'camera' ? await picker.launchCamera(options) : await picker.launchImageLibrary(options);
  if (response.didCancel) return [];
  if (response.errorCode) throw new Error(pickerErrorMessage(response.errorCode, source));
  return (response.assets ?? []).slice(0, 5).map((asset, index) => {
    const image = normalizeImage(asset);
    return { ...image, name: asset.fileName ?? `Page ${index + 1}` };
  });
}

async function pickPdf(): Promise<ReportPage[]> {
  const documents = require('@react-native-documents/picker') as typeof import('@react-native-documents/picker');
  const blobUtil = (require('react-native-blob-util') as { default: { fs: { readFile: (path: string, encoding: 'base64') => Promise<string>; unlink: (path: string) => Promise<void> } } }).default;
  let picked;
  try {
    [picked] = await documents.pick({ type: [documents.types.pdf] });
  } catch (error) {
    if (documents.isErrorWithCode(error) && error.code === documents.errorCodes.OPERATION_CANCELED) return [];
    throw new Error('That PDF couldn’t be opened. Try again or use photos of the report.');
  }
  const name = picked.name ?? 'report.pdf';
  // Copy the picked file into the app's cache so it can be read, then remove the copy.
  const [copy] = await documents.keepLocalCopy({ destination: 'cachesDirectory', files: [{ fileName: name, uri: picked.uri }] });
  if (copy.status !== 'success') throw new Error('That PDF couldn’t be opened. Try again or use photos of the report.');
  const path = decodeURIComponent(copy.localUri.replace(/^file:\/\//, ''));
  try {
    const base64 = await blobUtil.fs.readFile(path, 'base64');
    return [{ base64, mimeType: 'application/pdf', name, uri: copy.localUri }];
  } finally {
    blobUtil.fs.unlink(path).catch(() => undefined);
  }
}

type PickerOptions = {
  assetRepresentationMode: 'compatible';
  includeBase64: true;
  maxHeight: number;
  maxWidth: number;
  mediaType: 'photo';
  quality: 0.5 | 0.6;
  selectionLimit: 1;
};
type PickerResponse = { assets?: Asset[]; didCancel?: boolean; errorCode?: string; errorMessage?: string };

function checkSize(image: MealImage): MealImage {
  if (image.base64.length > MAX_BASE64_LENGTH) throw new Error('That photo is too large. Try a different one or describe the meal instead.');
  return image;
}

function pickerErrorMessage(code: string, source: 'camera' | 'library'): string {
  if (code === 'camera_unavailable') return 'The camera isn’t available here. Choose a photo from your library instead.';
  if (code === 'permission') {
    return source === 'camera'
      ? 'healthFlip needs camera access. You can allow it in Settings › healthFlip.'
      : 'healthFlip needs photo access. You can allow it in Settings › healthFlip.';
  }
  return 'That photo couldn’t be opened. Try another one or describe the meal instead.';
}

function normalizeImage(asset: Asset): MealImage {
  if (!asset.base64 || !asset.uri) throw new Error('That photo couldn’t be prepared. Try another one or describe the meal instead.');
  // iPhones may report HEIC, or no type at all, so trust the file's own header first.
  const mimeType = sniffImageType(asset.base64) ?? knownType(asset.type);
  if (!mimeType) throw new Error('That image format isn’t supported. Try a regular photo or screenshot.');
  return { base64: asset.base64, mimeType, uri: asset.uri };
}

function knownType(type?: string): ImageMimeType | null {
  const value = type?.toLowerCase();
  if (value === 'image/jpg') return 'image/jpeg';
  return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp' || value === 'image/heic' || value === 'image/heif' ? value : null;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Reads the format from the first bytes of a base64 image (magic numbers). */
export function sniffImageType(base64: string): ImageMimeType | null {
  const bytes: number[] = [];
  const head = base64.slice(0, 24);
  for (let index = 0; index + 3 < head.length; index += 4) {
    const digits = [...head.slice(index, index + 4)].map(char => BASE64.indexOf(char));
    if (digits.some(digit => digit < 0)) break;
    // Four base64 digits hold 24 bits, i.e. three bytes.
    const value = digits.reduce((total, digit) => total * 64 + digit, 0);
    bytes.push(Math.floor(value / 65536), Math.floor(value / 256) % 256, value % 256);
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (brand === 'heic' || brand === 'heix' || brand === 'heim' || brand === 'heis') return 'image/heic';
    if (brand === 'mif1' || brand === 'msf1' || brand === 'heif') return 'image/heif';
  }
  return null;
}
