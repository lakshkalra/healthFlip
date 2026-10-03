import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { OnboardingChat } from '../src/onboardingChat';

jest.mock('../src/api/client', () => ({ recommendPlan: jest.fn(), saveGoal: jest.fn(), saveProfile: jest.fn() }));

test('a returning user (recalculate) starts at the goal question with their name', async () => {
  const profile = { activityLevel: 'light', age: 30, heightCm: 165, name: 'Priya Sharma', sex: 'female', weightKg: 60 } as const;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<OnboardingChat initialProfile={profile} startAt="goal" onCancel={jest.fn()} onComplete={jest.fn()} />);
  });
  const labels = tree.root.findAll(node => typeof node.props?.accessibilityLabel === 'string').map(node => node.props.accessibilityLabel);
  expect(labels).toContain('Welcome back, Priya! What’s your goal right now?');
  expect(tree.root.findAll(node => node.props?.accessibilityLabel === 'Back').length).toBeGreaterThan(0);
  await ReactTestRenderer.act(async () => tree.unmount());
});
