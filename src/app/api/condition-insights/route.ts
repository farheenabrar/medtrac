import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const { conditions, firstName, age } = await req.json();

    const conditionList: string[] = Array.isArray(conditions) && conditions.length > 0 
      ? conditions 
      : ['General Metabolic Health'];

    const apiKey = process.env.GEMINI_API_KEY;

    // If Gemini API Key is available and valid, call Gemini Flash
    if (apiKey && !apiKey.includes('your-gemini')) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `You are a clinical metabolic health educator for Medtrac.
Generate a concise, 2 to 3 sentence educational overview for a patient${firstName ? ` named ${firstName}` : ''}${age ? ` (age ${age})` : ''} who is currently managing: ${conditionList.join(', ')}.
Focus on:
1. How these conditions interrelate metabolically (e.g., insulin sensitivity, cardiovascular health, lipid clearance, or inflammation).
2. Key general lifestyle or tracking milestones to discuss with their physician.
Keep the tone encouraging, clear, and reassuring.
Do NOT prescribe dosages, medications, or diagnose. Include no markdown headers.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        if (text && text.trim().length > 20) {
          return NextResponse.json({
            success: true,
            insight: text.trim(),
            source: 'gemini',
          });
        }
      } catch (geminiError: any) {
        console.warn('Gemini API call failed, falling back to clinical deterministic insight:', geminiError.message);
      }
    }

    // High-yield evidence-based clinical fallback synthesis
    let insight = '';
    const hasCondition = (c: string) => conditionList.some((item) => item.toLowerCase().includes(c.toLowerCase()));

    if (hasCondition('prediabetes') && hasCondition('cholesterol')) {
      insight = 'Insulin sensitivity and lipid particle metabolism frequently interact. Prioritizing postprandial glycemic regulation and dietary fiber helps stabilize both fasting glucose and triglyceride-to-HDL ratios.';
    } else if (hasCondition('hypertension') && (hasCondition('diabetes') || hasCondition('prediabetes'))) {
      insight = 'Vascular elasticity and glycemic regulation provide mutual protection for microvascular health. Regular morning blood pressure tracking alongside quarterly HbA1c reviews gives your clinical team an accurate baseline.';
    } else if (hasCondition('thyroid')) {
      insight = 'Thyroid hormones directly influence basal metabolic rate, energy metabolism, and lipid clearance. Tracking TSH levels alongside standard metabolic panels ensures comprehensive oversight during routine checkups.';
    } else if (hasCondition('arthritis')) {
      insight = 'Managing systemic inflammation supports joint comfort while benefiting metabolic biomarkers. Emphasizing anti-inflammatory dietary choices and gentle low-impact movement promotes sustainable vitality.';
    } else if (hasCondition('diabetes')) {
      insight = 'Consistent glycemic management is anchored in balanced carbohydrate distribution, physical activity, and monitoring HbA1c trends across lab visits. Sharing unified records with your physician helps fine-tune lifestyle protocols.';
    } else if (hasCondition('cholesterol')) {
      insight = 'Lipid profiles reflect both dietary fat balance and hepatic clearance. Tracking non-HDL cholesterol and triglycerides across time provides clear feedback on dietary and lifestyle adaptations.';
    } else {
      insight = `Managing ${conditionList.join(' and ')} benefits from steady tracking and regular physician reviews. Correlating lab markers across checkups helps uncover meaningful metabolic trajectories early.`;
    }

    return NextResponse.json({
      success: true,
      insight,
      source: 'clinical-fallback',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to generate condition insight' },
      { status: 500 }
    );
  }
}
