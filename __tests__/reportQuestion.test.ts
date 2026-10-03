import { reportQuestion } from '../src/reports';

const value = (name: string, flag: 'low' | 'normal' | 'high', reading: string, range: string) => ({ category: 'lipids', flag, name, referenceRange: range, unit: 'mg/dL', value: reading });

test('the Ask Flip question carries the report and its out-of-range values', () => {
  const question = reportQuestion({
    reportDate: '2026-09-18',
    title: 'Lipid profile',
    values: [value('LDL Cholesterol', 'high', '162', '< 130'), value('HDL Cholesterol', 'low', '38', '> 40'), value('TSH', 'normal', '2.1', '0.4 - 4.0')],
  });
  expect(question).toBe('Can you explain my Lipid profile report from 18 Sept 2026? These were outside the lab range: LDL Cholesterol 162 mg/dL (high, lab range < 130); HDL Cholesterol 38 mg/dL (low, lab range > 40). What do they mean, and what should I change in my meals?');
  expect(reportQuestion({ reportDate: null, title: 'Thyroid panel', values: [value('TSH', 'normal', '2.1', '0.4 - 4.0')] })).toBe('Can you explain my Thyroid panel report? Everything was within the lab range. Anything I should keep doing with my meals?');
});
