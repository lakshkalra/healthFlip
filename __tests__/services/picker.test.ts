import { sniffImageType } from '../../src/services/media/picker';

// Base64 of real file headers (magic numbers).
const JPEG = '/9j/4AAQSkZJRg=='; // FF D8 FF E0 … JFIF
const PNG = 'iVBORw0KGgo='; // 89 PNG \r\n 1A \n
const WEBP = 'UklGRgECAwRXRUJQVlA4IA=='; // RIFF …. WEBPVP8
const HEIC = 'AAAAJGZ0eXBoZWljAAAAAG1pZjFoZWlj'; // from an iPhone-style HEIC: 0x24-byte ftyp box, brand "heic"
const HEIF = 'AAAAGGZ0eXBtaWYxAAAAAA=='; // 0x18-byte ftyp box, brand "mif1"
const GIF = 'R0lGODlhLi4uLi4u';

describe('sniffImageType', () => {
  test('reads JPEG, PNG and WebP headers', () => {
    expect(sniffImageType(JPEG)).toBe('image/jpeg');
    expect(sniffImageType(PNG)).toBe('image/png');
    expect(sniffImageType(WEBP)).toBe('image/webp');
  });

  test('reads iPhone HEIC and HEIF headers whatever the box size', () => {
    expect(sniffImageType(HEIC)).toBe('image/heic');
    expect(sniffImageType(HEIF)).toBe('image/heif');
  });

  test('returns null for unknown or empty data', () => {
    expect(sniffImageType(GIF)).toBeNull();
    expect(sniffImageType('')).toBeNull();
  });
});
