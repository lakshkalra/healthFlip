import type { MealType } from '../features/meals/meals';

export type Tab = 'home' | 'progress' | 'plans' | 'tips';

export type Route = 'assistant' | 'boot' | 'goal' | 'detail' | 'onboarding' | 'profile' | 'reports' | Tab;

export type BootState = 'loading' | 'first' | 'returning' | 'error';

export type DashState = 'loading' | 'ready' | 'refreshing' | 'fail' | 'error';

export type MealTypes = Record<string, MealType>;
