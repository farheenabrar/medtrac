import { CanonicalKey, UnitSystem } from './types';

// Constants for deterministic conversions
export const CONVERSION_CONSTANTS = {
  GLUCOSE_FACTOR: 18.016,
  TRIGLYCERIDES_FACTOR: 88.57,
  CHOLESTEROL_FACTOR: 38.67,
  HBA1C_A: 2.15,
  HBA1C_B: 10.929,
};

// Test configurations with standard base units and normal reference ranges
export interface TestConfig {
  name: string;
  key: CanonicalKey;
  defaultMgUnit: string;
  defaultMmolUnit: string;
  normalRangeMg: { min: number; max: number };
  normalRangeMmol: { min: number; max: number };
  aliases: string[];
}

export const CANONICAL_TESTS: Record<CanonicalKey, TestConfig> = {
  hba1c: {
    name: 'HbA1c',
    key: 'hba1c',
    defaultMgUnit: '%',
    defaultMmolUnit: 'mmol/mol',
    normalRangeMg: { min: 4.0, max: 5.6 }, // Pre-diabetes is 5.7 - 6.4
    normalRangeMmol: { min: 20, max: 38 },
    aliases: [
      'glycated hemoglobin',
      'hemoglobin a1c',
      'hba1c',
      'a1c',
      'glycohemoglobin',
      'hba1c (ngsp)',
      'hba1c (ifcc)',
    ],
  },
  fasting_glucose: {
    name: 'Fasting Glucose',
    key: 'fasting_glucose',
    defaultMgUnit: 'mg/dL',
    defaultMmolUnit: 'mmol/L',
    normalRangeMg: { min: 70, max: 99 },
    normalRangeMmol: { min: 3.9, max: 5.5 },
    aliases: [
      'fasting blood sugar',
      'fbs',
      'fasting plasma glucose',
      'fpg',
      'blood glucose (fasting)',
      'fasting blood glucose',
      'glucose fasting',
      'fasting glucose',
    ],
  },
  triglycerides: {
    name: 'Triglycerides',
    key: 'triglycerides',
    defaultMgUnit: 'mg/dL',
    defaultMmolUnit: 'mmol/L',
    normalRangeMg: { min: 50, max: 149 },
    normalRangeMmol: { min: 0.56, max: 1.69 },
    aliases: [
      'triglycerides',
      'tg',
      'serum triglycerides',
      'total triglycerides',
      'triglyceride',
    ],
  },
  hdl: {
    name: 'HDL Cholesterol',
    key: 'hdl',
    defaultMgUnit: 'mg/dL',
    defaultMmolUnit: 'mmol/L',
    normalRangeMg: { min: 40, max: 90 }, // > 40 desirable for men, > 50 for women
    normalRangeMmol: { min: 1.0, max: 2.3 },
    aliases: [
      'hdl cholesterol',
      'high-density lipoprotein',
      'hdl-c',
      'hdl',
      'cholesterol hdl',
    ],
  },
  ldl: {
    name: 'LDL Cholesterol',
    key: 'ldl',
    defaultMgUnit: 'mg/dL',
    defaultMmolUnit: 'mmol/L',
    normalRangeMg: { min: 50, max: 99 }, // < 100 optimal
    normalRangeMmol: { min: 1.3, max: 2.6 },
    aliases: [
      'ldl cholesterol',
      'low-density lipoprotein',
      'ldl-c',
      'ldl',
      'cholesterol ldl',
      'calculated ldl',
    ],
  },
  other_untracked: {
    name: 'Other / Untracked',
    key: 'other_untracked',
    defaultMgUnit: '',
    defaultMmolUnit: '',
    normalRangeMg: { min: 0, max: 9999 },
    normalRangeMmol: { min: 0, max: 9999 },
    aliases: [],
  },
};

/**
 * Match a raw lab test name string to a canonical key
 */
export function matchCanonicalKey(rawTestName: string): CanonicalKey {
  const normalized = rawTestName.toLowerCase().trim();
  for (const [key, config] of Object.entries(CANONICAL_TESTS)) {
    if (key === 'other_untracked') continue;
    if (config.aliases.some((alias) => normalized.includes(alias))) {
      return key as CanonicalKey;
    }
  }
  return 'other_untracked';
}

/**
 * Deterministic unit conversion logic
 */
export function convertValue(
  canonicalKey: CanonicalKey,
  value: number,
  fromUnit: string,
  toUnit: string
): number {
  const cleanFrom = fromUnit.toLowerCase().trim();
  const cleanTo = toUnit.toLowerCase().trim();

  if (cleanFrom === cleanTo || canonicalKey === 'other_untracked') {
    return roundToTwo(value);
  }

  switch (canonicalKey) {
    case 'fasting_glucose': {
      if (cleanFrom.includes('mg') && cleanTo.includes('mmol')) {
        return roundToTwo(value / CONVERSION_CONSTANTS.GLUCOSE_FACTOR);
      }
      if (cleanFrom.includes('mmol') && cleanTo.includes('mg')) {
        return roundToTwo(value * CONVERSION_CONSTANTS.GLUCOSE_FACTOR);
      }
      return roundToTwo(value);
    }
    case 'triglycerides': {
      if (cleanFrom.includes('mg') && cleanTo.includes('mmol')) {
        return roundToTwo(value / CONVERSION_CONSTANTS.TRIGLYCERIDES_FACTOR);
      }
      if (cleanFrom.includes('mmol') && cleanTo.includes('mg')) {
        return roundToTwo(value * CONVERSION_CONSTANTS.TRIGLYCERIDES_FACTOR);
      }
      return roundToTwo(value);
    }
    case 'hdl':
    case 'ldl': {
      if (cleanFrom.includes('mg') && cleanTo.includes('mmol')) {
        return roundToTwo(value / CONVERSION_CONSTANTS.CHOLESTEROL_FACTOR);
      }
      if (cleanFrom.includes('mmol') && cleanTo.includes('mg')) {
        return roundToTwo(value * CONVERSION_CONSTANTS.CHOLESTEROL_FACTOR);
      }
      return roundToTwo(value);
    }
    case 'hba1c': {
      // NGSP (%) to IFCC (mmol/mol)
      if (cleanFrom.includes('%') && cleanTo.includes('mmol')) {
        return roundToTwo((value - CONVERSION_CONSTANTS.HBA1C_A) * CONVERSION_CONSTANTS.HBA1C_B);
      }
      // IFCC (mmol/mol) to NGSP (%)
      if (cleanFrom.includes('mmol') && cleanTo.includes('%')) {
        return roundToTwo(value / CONVERSION_CONSTANTS.HBA1C_B + CONVERSION_CONSTANTS.HBA1C_A);
      }
      return roundToTwo(value);
    }
    default:
      return roundToTwo(value);
  }
}

/**
 * Display helper: Format a test value into a target unit system ('mg_dl' or 'mmol_l')
 */
export function formatValueForSystem(
  canonicalKey: CanonicalKey,
  rawValue: number,
  rawUnit: string,
  targetSystem: UnitSystem
): { value: number; unit: string } {
  const config = CANONICAL_TESTS[canonicalKey];
  if (!config || canonicalKey === 'other_untracked') {
    return { value: rawValue, unit: rawUnit };
  }

  const targetUnit = targetSystem === 'mg_dl' ? config.defaultMgUnit : config.defaultMmolUnit;
  const converted = convertValue(canonicalKey, rawValue, rawUnit, targetUnit);

  return {
    value: converted,
    unit: targetUnit,
  };
}

/**
 * Check if a value is abnormal / flagged based on canonical ranges
 */
export function isAbnormal(
  canonicalKey: CanonicalKey,
  value: number,
  unitSystem: UnitSystem
): boolean {
  const config = CANONICAL_TESTS[canonicalKey];
  if (!config || canonicalKey === 'other_untracked') return false;

  const range = unitSystem === 'mg_dl' ? config.normalRangeMg : config.normalRangeMmol;
  return value < range.min || value > range.max;
}

function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
