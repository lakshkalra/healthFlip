// Parses typed onboarding answers. Each parser returns a value or a friendly reason to re-ask.

export type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = <T>(reason: string): Parsed<T> => ({ ok: false, reason });
const round1 = (value: number) => Math.round(value * 10) / 10;

export function parseName(text: string): Parsed<string> {
  const name = text.trim().replace(/^(i am|i'm|im|my name is|call me|it's|its)\s+/i, '').replace(/[.!]+$/, '').trim();
  if (!name) return fail('What should I call you? Just your first name is fine.');
  if (name.length > 60) return fail('That’s a bit long. Could you give me a shorter name?');
  return ok(name.replace(/^\p{Ll}/u, letter => letter.toUpperCase()));
}

export function parseAge(text: string): Parsed<number> {
  const match = text.match(/\d{1,3}/);
  if (!match) return fail('Just the number is perfect, like “29”.');
  const age = Number(match[0]);
  if (age < 18) return fail('healthFlip plans are for adults 18 and over, sorry! If you typed it wrong, try again.');
  if (age > 100) return fail('Hmm, that doesn’t look right. How old are you, like “34”?');
  return ok(age);
}

/** Centimetres from "170", "170 cm", "1.7 m", "5'7", "5 ft 7 in", "5.7 ft". */
export function parseHeight(text: string): Parsed<number> {
  const t = text.toLowerCase().replace(/[’′]/g, "'").replace(/[”″]/g, '"').trim();
  let cm: number | null = null;
  const feetInches = t.match(/(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?)?/);
  if (feetInches) {
    const feet = Number(feetInches[1]);
    const inches = feetInches[2] ? Number(feetInches[2]) : 0;
    cm = (feet * 12 + inches) * 2.54;
  } else {
    const meters = t.match(/(\d(?:\.\d+)?)\s*m\b/);
    const number = t.match(/\d+(?:\.\d+)?/);
    if (meters) cm = Number(meters[1]) * 100;
    else if (number) {
      const value = Number(number[0]);
      // A bare 4–8 is almost certainly feet (e.g. "5.7").
      cm = value >= 4 && value < 8 ? value * 30.48 : value;
    }
  }
  if (cm === null) return fail(`You can say it like “170 cm” or “5'7”.`);
  if (cm < 120 || cm > 230) return fail(`That seems off. Try something like “165 cm” or “5'5”.`);
  return ok(round1(cm));
}

/** Kilograms from "65", "65 kg", "143 lb". */
export function parseWeight(text: string): Parsed<number> {
  const t = text.toLowerCase();
  const number = t.match(/\d+(?:\.\d+)?/);
  if (!number) return fail('Just the number works, like “65 kg” or “143 lb”.');
  const value = Number(number[0]);
  const kg = /\b(lb|lbs|pound|pounds)\b/.test(t) ? value * 0.453592 : value;
  if (kg < 30 || kg > 300) return fail('Hmm, that looks unusual. Could you check it? For example “65 kg”.');
  return ok(round1(kg));
}

/** Matches a typed answer to one of the offered choices by label or keywords. */
export function parseChoice<T extends string>(text: string, choices: { keywords: string[]; label: string; value: T }[]): Parsed<T> {
  const t = text.toLowerCase().trim();
  const match = choices.find(choice => choice.label.toLowerCase() === t)
    ?? choices.find(choice => choice.keywords.some(keyword => new RegExp(`\\b${keyword}`, 'i').test(t)));
  return match ? ok(match.value) : fail(`Pick one of the options: ${choices.map(choice => choice.label).join(', ')}.`);
}
