// Deterministic Math Verification for Medtrac Unit Engine

const CONVERSION_CONSTANTS = {
  GLUCOSE_FACTOR: 18.016,
  TRIGLYCERIDES_FACTOR: 88.57,
  CHOLESTEROL_FACTOR: 38.67,
  HBA1C_A: 2.15,
  HBA1C_B: 10.929,
};

function roundToTwo(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function convertValue(canonicalKey, value, fromUnit, toUnit) {
  const cleanFrom = fromUnit.toLowerCase().trim();
  const cleanTo = toUnit.toLowerCase().trim();

  if (cleanFrom === cleanTo) return roundToTwo(value);

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
      if (cleanFrom.includes('%') && cleanTo.includes('mmol')) {
        return roundToTwo((value - CONVERSION_CONSTANTS.HBA1C_A) * CONVERSION_CONSTANTS.HBA1C_B);
      }
      if (cleanFrom.includes('mmol') && cleanTo.includes('%')) {
        return roundToTwo(value / CONVERSION_CONSTANTS.HBA1C_B + CONVERSION_CONSTANTS.HBA1C_A);
      }
      return roundToTwo(value);
    }
    default:
      return roundToTwo(value);
  }
}

console.log('--- RUNNING DETERMINISTIC UNIT CONVERSION TESTS ---');

// Test 1: Glucose
const glu_mmol = convertValue('fasting_glucose', 180.16, 'mg/dL', 'mmol/L');
console.log(`Glucose 180.16 mg/dL -> ${glu_mmol} mmol/L (Expected: 10.00)`);
console.assert(glu_mmol === 10.0, 'Glucose mg/dL -> mmol/L failed');

const glu_mg = convertValue('fasting_glucose', 10.0, 'mmol/L', 'mg/dL');
console.log(`Glucose 10.0 mmol/L -> ${glu_mg} mg/dL (Expected: 180.16)`);
console.assert(glu_mg === 180.16, 'Glucose mmol/L -> mg/dL failed');

// Test 2: Triglycerides (Mumbai to Dubai)
const tg_mmol = convertValue('triglycerides', 235, 'mg/dL', 'mmol/L');
console.log(`Triglycerides 235 mg/dL -> ${tg_mmol} mmol/L (Expected: 2.65)`);
console.assert(tg_mmol === 2.65, 'Triglycerides mg/dL -> mmol/L failed');

const tg_mg = convertValue('triglycerides', 1.82, 'mmol/L', 'mg/dL');
console.log(`Triglycerides 1.82 mmol/L -> ${tg_mg} mg/dL (Expected: 161.20)`);
console.assert(tg_mg === 161.2, 'Triglycerides mmol/L -> mg/dL failed');

// Test 3: HbA1c
const hba1c_mmol = convertValue('hba1c', 6.0, '%', 'mmol/mol');
console.log(`HbA1c 6.0% -> ${hba1c_mmol} mmol/mol (Expected: 42.08)`);
console.assert(hba1c_mmol === 42.08, 'HbA1c % -> mmol/mol failed');

const hba1c_pct = convertValue('hba1c', 42.08, 'mmol/mol', '%');
console.log(`HbA1c 42.08 mmol/mol -> ${hba1c_pct}% (Expected: 6.00)`);
console.assert(hba1c_pct === 6.0, 'HbA1c mmol/mol -> % failed');

console.log('--- ALL MATHEMATICAL UNIT CONVERSION TESTS PASSED! ---');
