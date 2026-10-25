import { NextRequest, NextResponse } from 'next/server';
import { generateDoctorBrief } from '@/lib/gemini';
import { DoctorBriefContent, LabResult, LifeEvent, Medication, UserProfile } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { doctorType, profile, results, medications, events } = body as {
      doctorType: string;
      profile: UserProfile;
      results: LabResult[];
      medications: Medication[];
      events: LifeEvent[];
    };

    if (!doctorType || !profile) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const actualResults = Array.isArray(results) ? results : [];
    const actualMedications = Array.isArray(medications) ? medications : [];
    const actualEvents = Array.isArray(events) ? events : [];
    const actualConditions = Array.isArray(profile.conditions) ? profile.conditions : [];

    // If GEMINI_API_KEY is configured and user has uploaded results, run live AI generation
    if (
      actualResults.length > 0 &&
      process.env.GEMINI_API_KEY &&
      !process.env.GEMINI_API_KEY.includes('your-gemini')
    ) {
      try {
        const brief = await generateDoctorBrief({
          doctorType,
          profile,
          results: actualResults,
          medications: actualMedications,
          events: actualEvents,
        });
        return NextResponse.json({ success: true, brief });
      } catch (geminiErr: any) {
        console.warn('Gemini AI synthesis warning, using dynamic data summary:', geminiErr.message);
      }
    }

    // Build brief strictly from the user's actual uploaded results, conditions, medications, and events
    const keyChanges =
      actualResults.length > 0
        ? actualResults.map(
            (r) =>
              `${r.raw_test_name}: ${r.raw_value} ${r.raw_unit} (${r.test_date}${
                r.lab_name ? `, ${r.lab_name}` : ''
              })`
          )
        : [];

    const trendsSummary =
      actualResults.length > 0
        ? `Summary generated from ${actualResults.length} uploaded laboratory test result(s) for ${
            profile.full_name || 'Patient'
          } tailored for ${doctorType} consultation.`
        : '';

    const questionsToAsk =
      actualResults.length > 0 || actualConditions.length > 0
        ? [
            `Based on my current profile${
              actualConditions.length > 0 ? ` (${actualConditions.join(', ')})` : ''
            }, what target ranges should we prioritize?`,
            `Which follow-up laboratory tests do you recommend before our next ${doctorType} review?`,
            `Are any adjustments needed to my current management plan based on these records?`,
          ]
        : [];

    const dynamicBrief: DoctorBriefContent = {
      doctor_type: doctorType,
      patient_summary: {
        name: profile.full_name || profile.first_name || 'User',
        conditions: actualConditions,
      },
      key_changes: keyChanges,
      trends_summary: trendsSummary,
      current_medications: actualMedications.map((m) => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        started: m.start_date,
      })),
      recent_events: actualEvents.map((e) => ({
        title: e.title,
        date: e.event_date,
        category: e.category,
      })),
      questions_to_ask: questionsToAsk,
      disclaimer: 'Organises your records. Not medical advice.',
    };

    return NextResponse.json({ success: true, brief: dynamicBrief });
  } catch (error: any) {
    console.error('Doctor brief error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate Doctor Brief' },
      { status: 500 }
    );
  }
}
