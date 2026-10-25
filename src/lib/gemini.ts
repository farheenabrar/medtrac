import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { CanonicalKey, DoctorBriefContent, LabResult, LifeEvent, Medication, UserProfile } from './types';
import { matchCanonicalKey } from './units';

const apiKey = process.env.GEMINI_API_KEY || '';

export interface ExtractedLabData {
  lab_name?: string;
  lab_country?: string;
  test_date?: string;
  results: {
    raw_test_name: string;
    canonical_key: CanonicalKey;
    raw_value: number;
    raw_unit: string;
    raw_range?: string;
    confidence_score: number;
  }[];
}

/**
 * Call 1: Multimodal Vision Extraction of Lab Reports (PDF or Image)
 */
export async function extractLabReport(
  fileBase64: string,
  mimeType: string
): Promise<ExtractedLabData> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          lab_name: { type: SchemaType.STRING, description: 'Name of the lab or hospital' },
          lab_country: { type: SchemaType.STRING, description: 'City or country of the lab' },
          test_date: { type: SchemaType.STRING, description: 'Sample collection date in YYYY-MM-DD format' },
          results: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                raw_test_name: { type: SchemaType.STRING, description: 'Exact test name printed on report' },
                raw_value: { type: SchemaType.NUMBER, description: 'Numeric result value' },
                raw_unit: { type: SchemaType.STRING, description: 'Unit of measurement as printed (e.g. mg/dL, mmol/L, %)' },
                raw_range: { type: SchemaType.STRING, description: 'Reference range string as printed by lab' },
                confidence_score: { type: SchemaType.NUMBER, description: 'Confidence between 0.0 and 1.0' },
              },
              required: ['raw_test_name', 'raw_value', 'raw_unit', 'confidence_score'],
            },
          },
        },
        required: ['results'],
      },
    },
  });

  const prompt = `You are a medical lab report data extractor.
Analyze the provided document (PDF pages or photo).
Rules:
1. Extract the laboratory or hospital name, city/country, and collection date (YYYY-MM-DD). If no exact year is printed, make a best conservative estimate.
2. Extract all metabolic tests: HbA1c, Fasting Glucose / Blood Sugar, Triglycerides, HDL Cholesterol, LDL Cholesterol, and other lipid or metabolic tests.
3. Extract the exact numerical value, unit of measurement, and printed reference range.
4. Do NOT convert units or perform calculations. Return the numbers and units exactly as printed.
5. Provide a confidence score (0.0 to 1.0) for each test reading.`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: fileBase64,
        mimeType: mimeType,
      },
    },
  ]);

  const rawJson = result.response.text();
  const parsed = JSON.parse(rawJson);

  // Map each extracted result to canonical keys
  const mappedResults = (parsed.results || []).map((item: {
    raw_test_name: string;
    raw_value: number;
    raw_unit: string;
    raw_range?: string;
    confidence_score: number;
  }) => ({
    ...item,
    canonical_key: matchCanonicalKey(item.raw_test_name),
  }));

  return {
    lab_name: parsed.lab_name,
    lab_country: parsed.lab_country,
    test_date: parsed.test_date,
    results: mappedResults,
  };
}

/**
 * Call 2: Doctor Brief Synthesizer
 */
export async function generateDoctorBrief(params: {
  doctorType: string;
  profile: UserProfile;
  results: LabResult[];
  medications: Medication[];
  events: LifeEvent[];
}): Promise<DoctorBriefContent> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          doctor_type: { type: SchemaType.STRING },
          patient_summary: {
            type: SchemaType.OBJECT,
            properties: {
              name: { type: SchemaType.STRING },
              age: { type: SchemaType.NUMBER },
              conditions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            },
            required: ['name', 'conditions'],
          },
          key_changes: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: 'Bullet points highlighting numerical changes between visits',
          },
          trends_summary: {
            type: SchemaType.STRING,
            description: '1-2 concise paragraphs summarizing the trajectory tailored to the doctor specialty',
          },
          questions_to_ask: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: 'Exactly 3 focused clarifying questions for the patient to ask this doctor',
          },
        },
        required: ['doctor_type', 'patient_summary', 'key_changes', 'trends_summary', 'questions_to_ask'],
      },
    },
  });

  const prompt = `You are a medical record summarizer for Medtrac.
Your task is to prepare a concise, high-yield Doctor Brief for a patient's upcoming consultation with a ${params.doctorType}.

STRICT SAFETY GUARDRAILS:
1. You are NOT a doctor. You must NEVER diagnose, prescribe medications, or suggest dose alterations.
2. Rely strictly on the confirmed lab records, medications, and life events provided.
3. Never invent or hallucinate lab values.
4. Provide exactly 3 patient questions to ask the physician, tailored to their specialty:
   - GP: Focus on overall metabolic trajectory, medication tolerance, cardiovascular prevention.
   - Endocrinologist: Focus on glycemic stability, insulin resistance, HbA1c trajectory.
   - Nutritionist: Focus on dietary correlations with triglycerides/lipids and lifestyle factors.

Patient Data:
- Name: ${params.profile.full_name}
- Conditions: ${params.profile.conditions.join(', ') || 'Metabolic tracking'}
- Active Medications: ${JSON.stringify(params.medications.map(m => `${m.name} ${m.dosage} (${m.frequency})`))}
- Recent Life Events: ${JSON.stringify(params.events.map(e => `${e.event_date}: ${e.title} (${e.category})`))}
- Historical Lab Results: ${JSON.stringify(params.results.map(r => ({
  date: r.test_date,
  test: r.raw_test_name,
  canonical: r.canonical_key,
  value: `${r.raw_value} ${r.raw_unit}`,
})))}
`;

  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text());

  return {
    doctor_type: params.doctorType,
    patient_summary: {
      name: params.profile.full_name,
      conditions: params.profile.conditions,
    },
    key_changes: parsed.key_changes || [],
    trends_summary: parsed.trends_summary || '',
    current_medications: params.medications.map((m) => ({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      started: m.start_date,
    })),
    recent_events: params.events.map((e) => ({
      title: e.title,
      date: e.event_date,
      category: e.category,
    })),
    questions_to_ask: parsed.questions_to_ask || [],
    disclaimer: 'Organises your records. Not medical advice.',
  };
}
