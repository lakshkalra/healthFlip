

export type Sex = 'female' | 'male' | 'unspecified';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';

export type Profile = {
  activityLevel: ActivityLevel;
  age: number;
  heightCm: number;
  name: string;
  sex: Sex;
  weightKg: number;
};

export type MemoryCategory = 'diet' | 'allergy' | 'preference' | 'routine' | 'goal' | 'other';

export type Memory = {
  category: MemoryCategory;
  createdAt: string;
  id: string;
  text: string;
};
