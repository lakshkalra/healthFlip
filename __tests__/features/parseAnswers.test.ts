import { parseAge, parseChoice, parseHeight, parseName, parseWeight } from '../../src/features/onboarding/parseAnswers';

const value = <T,>(parsed: { ok: boolean; value?: T }) => (parsed.ok ? parsed.value : undefined);

test('names drop filler phrases and are capitalised', () => {
  expect(value(parseName("I'm priya"))).toBe('Priya');
  expect(value(parseName('call me Arjun.'))).toBe('Arjun');
  expect(parseName('   ').ok).toBe(false);
});

test('ages must be adults 18 to 100', () => {
  expect(value(parseAge('29 years'))).toBe(29);
  expect(parseAge('16').ok).toBe(false);
  expect(parseAge('120').ok).toBe(false);
  expect(parseAge('old enough').ok).toBe(false);
});

test('heights accept cm, metres, feet/inches and bare feet', () => {
  expect(value(parseHeight('170'))).toBe(170);
  expect(value(parseHeight('170 cm'))).toBe(170);
  expect(value(parseHeight('1.65 m'))).toBe(165);
  expect(value(parseHeight("5'7"))).toBe(170.2);
  expect(value(parseHeight('5 ft 7 in'))).toBe(170.2);
  expect(value(parseHeight('5’7”'))).toBe(170.2);
  expect(value(parseHeight('5.7'))).toBe(173.7);
  expect(parseHeight('90').ok).toBe(false);
});

test('weights accept kg and pounds', () => {
  expect(value(parseWeight('65'))).toBe(65);
  expect(value(parseWeight('65.5 kg'))).toBe(65.5);
  expect(value(parseWeight('143 lb'))).toBe(64.9);
  expect(parseWeight('10').ok).toBe(false);
});

test('choices match labels or keywords without false matches', () => {
  const choices = [
    { keywords: ['female', 'woman'], label: 'Female', value: 'female' },
    { keywords: ['male', 'man'], label: 'Male', value: 'male' },
  ];
  expect(value(parseChoice('Female', choices))).toBe('female');
  expect(value(parseChoice("I'm a woman", choices))).toBe('female');
  expect(value(parseChoice('male', choices))).toBe('male');
  expect(parseChoice('banana', choices).ok).toBe(false);
});
