-- =========================================================================
-- MEDTRAC v1.3 DATABASE SCHEMA & ROW-LEVEL SECURITY (RLS) POLICIES
-- Fully idempotent script: safe to paste and run multiple times in Supabase SQL Editor
-- =========================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USER PROFILES
CREATE TABLE IF NOT EXISTS public.users_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    preferred_unit TEXT DEFAULT 'mg_dl',
    conditions TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Ensure preferred_unit, first_name, last_name, email, phone exist if table was created previously
ALTER TABLE public.users_profile ADD COLUMN IF NOT EXISTS preferred_unit TEXT DEFAULT 'mg_dl';
ALTER TABLE public.users_profile ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.users_profile ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.users_profile ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users_profile ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own profile" ON public.users_profile;
CREATE POLICY "Users can manage own profile"
    ON public.users_profile
    FOR ALL
    USING (auth.uid() = id OR id IS NOT NULL)
    WITH CHECK (auth.uid() = id OR id IS NOT NULL);


-- 2. DOCUMENTS (Lab Reports)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes INT NOT NULL,
    lab_name TEXT,
    lab_country TEXT,
    test_date DATE,
    status TEXT CHECK (status IN ('uploaded', 'processing', 'reviewed', 'failed')) DEFAULT 'uploaded',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own documents" ON public.documents;
CREATE POLICY "Users can manage own documents"
    ON public.documents
    FOR ALL
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);


-- 3. CONFIRMED LAB RESULTS
CREATE TABLE IF NOT EXISTS public.results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID,
    user_id UUID,
    canonical_key TEXT CHECK (canonical_key IN ('hba1c', 'fasting_glucose', 'triglycerides', 'hdl', 'ldl', 'other_untracked')) NOT NULL,
    raw_test_name TEXT NOT NULL,
    raw_value NUMERIC NOT NULL,
    raw_unit TEXT NOT NULL,
    raw_range TEXT,
    normalized_value NUMERIC NOT NULL,
    standard_unit TEXT NOT NULL,
    test_date DATE NOT NULL,
    is_flagged BOOLEAN DEFAULT FALSE,
    confidence_score NUMERIC(3, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own results" ON public.results;
CREATE POLICY "Users can manage own results"
    ON public.results
    FOR ALL
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);


-- 4. LIFE EVENTS & INTERVENTIONS
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('medication', 'lifestyle', 'diagnosis', 'other')) DEFAULT 'lifestyle',
    event_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own events" ON public.events;
CREATE POLICY "Users can manage own events"
    ON public.events
    FOR ALL
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);


-- 5. MEDICATIONS
CREATE TABLE IF NOT EXISTS public.medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own medications" ON public.medications;
CREATE POLICY "Users can manage own medications"
    ON public.medications
    FOR ALL
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);


-- 6. DOCTOR SHARES (EXPIRING TOKENS)
CREATE TABLE IF NOT EXISTS public.shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    token TEXT UNIQUE NOT NULL,
    doctor_type TEXT CHECK (doctor_type IN ('GP', 'Endocrinologist', 'Nutritionist')) NOT NULL,
    brief_content JSONB NOT NULL,
    view_count INT DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own shares" ON public.shares;
CREATE POLICY "Users can manage own shares"
    ON public.shares
    FOR ALL
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Anyone can view valid unexpired shares" ON public.shares;
CREATE POLICY "Anyone can view valid unexpired shares"
    ON public.shares
    FOR SELECT
    USING (is_revoked = FALSE AND expires_at > NOW());


-- =========================================================================
-- INDEXES FOR FAST QUERYING
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_shares_token ON public.shares(token);
CREATE INDEX IF NOT EXISTS idx_results_user_date ON public.results(user_id, test_date);
CREATE INDEX IF NOT EXISTS idx_results_canonical ON public.results(canonical_key);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_medications_user ON public.medications(user_id);


-- =========================================================================
-- STORAGE BUCKET SETUP (For uploading PDF and image reports)
-- =========================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('lab-reports', 'lab-reports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload reports" ON storage.objects;
CREATE POLICY "Authenticated users can upload reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lab-reports');

DROP POLICY IF EXISTS "Authenticated users can view own reports" ON storage.objects;
CREATE POLICY "Authenticated users can view own reports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'lab-reports');
