/* global jest */

const mockValues = new Map();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(key => Promise.resolve(mockValues.get(key) ?? null)),
  setItem: jest.fn((key, value) => {
    mockValues.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn(key => {
    mockValues.delete(key);
    return Promise.resolve();
  }),
}));

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
