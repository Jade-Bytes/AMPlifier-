import { GradingTemplate } from './types';

export const DEFAULT_DEPED_TEMPLATE: GradingTemplate = {
  id: 'deped_junior_high',
  name: 'Philippine Junior High (DepEd Standard)',
  description: 'Default curriculum with Filipino, English, Science, ESP, AP, TLE, Computer, MAPEH and official DepEd weights.',
  subjects: [
    {
      name: 'Filipino',
      code: 'FIL',
      color: '#ef4444', // Red
      weights: { ww: 0.40, pt: 0.40, qa: 0.20 },
      units: 1.0,
      useTransmutation: true,
    },
    {
      name: 'English',
      code: 'ENG',
      color: '#3b82f6', // Blue
      weights: { ww: 0.40, pt: 0.40, qa: 0.20 },
      units: 1.0,
      useTransmutation: true,
    },
    {
      name: 'Science',
      code: 'SCI',
      color: '#10b981', // Emerald
      weights: { ww: 0.40, pt: 0.40, qa: 0.20 },
      units: 1.0,
      useTransmutation: true,
    },
    {
      name: 'ESP',
      code: 'ESP',
      color: '#8b5cf6', // Violet (Edukasyon sa Pagpapakatao)
      weights: { ww: 0.40, pt: 0.40, qa: 0.20 },
      units: 1.0,
      useTransmutation: true,
    },
    {
      name: 'Araling Panlipunan',
      code: 'AP',
      color: '#f59e0b', // Amber
      weights: { ww: 0.40, pt: 0.40, qa: 0.20 },
      units: 1.0,
      useTransmutation: true,
    },
    {
      name: 'TLE',
      code: 'TLE',
      color: '#14b8a6', // Teal (Technology and Livelihood Education)
      weights: { ww: 0.30, pt: 0.50, qa: 0.20 },
      units: 1.0,
      useTransmutation: true,
    },
    {
      name: 'Computer',
      code: 'CS',
      color: '#6366f1', // Indigo
      weights: { ww: 0.30, pt: 0.50, qa: 0.20 },
      units: 1.0,
      useTransmutation: true,
    },
    {
      name: 'MAPEH',
      code: 'MAPEH',
      color: '#ec4899', // Pink
      weights: { ww: 0.30, pt: 0.50, qa: 0.20 },
      units: 1.0,
      useTransmutation: true,
    },
  ],
};

export const RAW_PERCENTAGE_TEMPLATE: GradingTemplate = {
  id: 'standard_college_raw',
  name: 'Standard Raw Weighted Average',
  description: 'Uniform weighted scoring without transmutation tables (direct 0-100 percentage).',
  subjects: [
    {
      name: 'Filipino',
      code: 'FIL',
      color: '#ef4444',
      weights: { ww: 0.35, pt: 0.40, qa: 0.25 },
      units: 1.0,
      useTransmutation: false,
    },
    {
      name: 'English',
      code: 'ENG',
      color: '#3b82f6',
      weights: { ww: 0.35, pt: 0.40, qa: 0.25 },
      units: 1.0,
      useTransmutation: false,
    },
    {
      name: 'Science',
      code: 'SCI',
      color: '#10b981',
      weights: { ww: 0.35, pt: 0.40, qa: 0.25 },
      units: 1.0,
      useTransmutation: false,
    },
    {
      name: 'Mathematics',
      code: 'MATH',
      color: '#06b6d4',
      weights: { ww: 0.35, pt: 0.40, qa: 0.25 },
      units: 1.0,
      useTransmutation: false,
    },
  ],
};

export const AVAILABLE_TEMPLATES: GradingTemplate[] = [
  DEFAULT_DEPED_TEMPLATE,
  RAW_PERCENTAGE_TEMPLATE,
];
