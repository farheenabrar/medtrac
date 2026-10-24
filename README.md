# Medtrac: Cross-Border Metabolic Tracking

> **"Get ready for your 3-month review in under 5 minutes."**

Medtrac solves the international health records problem for adults managing metabolic conditions (such as prediabetes, high triglycerides, and dyslipidemia). When clinical lab reports are scattered across paper printouts, hospital portals, and PDFs from **Mumbai ($\text{mg/dL}$)** to **Dubai or London ($\text{mmol/L}$)**, Medtrac unifies them onto a single-unit metabolic trajectory with medication milestones and synthesizes a specialist Doctor Brief in under 5 minutes.

---

## ⚡ The "Aha Moment"

Upload a **2025 Mumbai report** in $\text{mg/dL}$ and a **2026 Dubai report** in $\text{mmol/L}$. Within seconds:
1. Both appear on a single **Triglycerides trend chart** in one chosen unit ($\text{mg/dL}$ or $\text{mmol/L}$).
2. A *"Started Metformin 500mg daily"* milestone event pin is marked directly on the trajectory between tests.
3. An AI-synthesized **Doctor Brief** tailored to your specialist (GP, Endocrinologist, Nutritionist) is ready to share via an expiring 24-hour QR code link.

---

## 📱 The 5 Core Mobile Screens

1. **Sign Up & Setup (`/`)**:
   - Supabase Auth: Google OAuth, Email Magic Link, or Instant Demo preview.
   - Adult qualification enforcement ($\ge 18$ years old).
   - Preferred initial unit system ($\text{mg/dL}$ vs $\text{mmol/L}$).
   - Conditions checklist with custom entry and "None / General Metabolic Health".
   - Seamless redirect to `/dashboard` for returning users with stored records.
2. **Upload & Review (`/upload`)**:
   - Ingestion: Multi-page PDFs, PNG, JPEG, and direct phone-camera capture (`capture="environment"`).
   - Parallel multi-document OCR extraction with Gemini 1.5 Flash (`/api/extract`).
   - Verification view (full table on desktop, responsive cards on mobile).
   - Amber alert highlight for low OCR confidence readings ($< 85\%$).
   - Side-by-side **Inspect Source Document** modal.
   - Built-in *"Load Mumbai & Dubai Reports"* 1-click test button.
3. **Dashboard & Trajectory (`/dashboard`)**:
   - 5 key metabolic cards: HbA1c, Fasting Glucose, Triglycerides, HDL, LDL.
   - Card stats: Latest result, absolute difference ($V_{\text{latest}} - V_{\text{prev}}$ subtraction), and normal/flagged status.
   - Recharts interactive trajectory with dynamic reference band matching current units.
   - Milestone pins marking lifestyle events and medication changes.
   - Add Medication modal with automatic *"Mark start as life event on timeline"* toggle.
   - Medical Boundary: Clear disclaimer that timing does not prove clinical causality.
4. **Doctor Brief (`/brief`)**:
   - Specialist tabs:
     - **GP**: Broad metabolic picture, cardiovascular risk, medication tolerance.
     - **Endocrinologist**: Glycemic stability, insulin resistance, HbA1c trajectory.
     - **Nutritionist**: Lipid-to-HDL ratios, dietary carbohydrate response.
   - Changes since last visit with custom last visit date picker.
   - Editable narrative & exactly 3 patient questions to ask.
   - Overwrite confirmation alert before regenerating.
   - Clean 1-page printable vector PDF export.
   - 24-hour expiring bearer link generation with QR code and instant revocation.
5. **Doctor View (`/share/[token]`)**:
   - Expiring read-only access for doctors (no account required).
   - 60-second summary layout.
   - On-the-fly unit toggle ($\text{mg/dL} \longleftrightarrow \text{mmol/L}$).
   - Source lab report verification modal.
   - Automatic 24h expiration and revoked state detection.

---

## 📐 Deterministic Unit Conversion Engine

Unit conversions are **never performed by AI**. They are executed strictly in deterministic code:

- **Glucose:** $\text{mmol/L} = \text{mg/dL} \div 18.016 \longleftrightarrow \text{mg/dL} = \text{mmol/L} \times 18.016$
- **Triglycerides:** $\text{mmol/L} = \text{mg/dL} \div 88.57 \longleftrightarrow \text{mg/dL} = \text{mmol/L} \times 88.57$
- **Cholesterol (HDL/LDL):** $\text{mmol/L} = \text{mg/dL} \div 38.67 \longleftrightarrow \text{mg/dL} = \text{mmol/L} \times 38.67$
- **HbA1c:** $\text{mmol/mol} = (\text{HbA1c}_{\%} - 2.15) \times 10.929 \longleftrightarrow \text{HbA1c}_{\%} = (\text{mmol/mol} \div 10.929) + 2.15$

Run unit tests anytime:
```bash
node test-units.mjs
```

---

## 🗄️ Supabase Database & Persistence Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor**, open [supabase_schema.sql](file:///Users/farheenkhan/Desktop/medtrac/supabase_schema.sql), paste and run the script. It creates:
   - `users_profile`: User profile, birth date, preferred unit, conditions.
   - `documents`: Uploaded lab PDF and photo metadata.
   - `results`: Normalized and raw lab tests with canonical mappings.
   - `events`: Life events and milestones.
   - `medications`: Active and historical medication records.
   - `shares`: 24h expiring doctor bearer tokens.
   - `storage.buckets`: Private `lab-reports` bucket with Row Level Security (RLS).
3. Copy your project credentials into `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   GEMINI_API_KEY=<your-google-gemini-key>
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

*(Note: Medtrac includes a local persistence fallback, allowing immediate testing of all screens even prior to connecting Supabase keys!)*

---

## 🚀 How to Test Medtrac Locally

1. Start the dev server:
   ```bash
   npm run dev
   ```
2. Open [http://localhost:3000](http://localhost:3000) on your desktop or mobile browser.
3. Test Journey:
   - **Step 1:** Tap **"Demo Patient"** or enter your name, date of birth ($18+$), and select conditions. Click **"Continue to Upload Reports"**.
   - **Step 2:** Click **"Load Mumbai & Dubai Reports"** (or upload your own PDF/photo). Inspect values, see the low-confidence amber badge, tap **"Inspect"** to verify source records, and click **"Confirm & View Dashboard"**.
   - **Step 3:** Notice both Mumbai ($235\text{ mg/dL}$) and Dubai ($1.82\text{ mmol/L}$) on the Triglycerides trajectory with the *"Started Metformin"* milestone between them! Toggle units between $\text{mg/dL}$ and $\text{mmol/L}$ to see the chart and reference band convert simultaneously.
   - **Step 4:** Click **"Doctor Brief"**, switch between GP, Endocrinologist, and Nutritionist tabs, edit any text or questions, and click **"Share 24h Link & QR Code"**.
   - **Step 5:** Open the generated preview link or scan the QR code to experience the unauthenticated 60-second Doctor View.

---

## 📦 Hosting on GitHub

1. Ensure Xcode command line tools are installed on your Mac:
   ```bash
   xcode-select --install
   ```
2. Initialize and push your repository:
   ```bash
   git init
   git add .
   git commit -m "feat: complete Medtrac mobile app with Supabase persistence"
   git branch -M main
   git remote add origin https://github.com/<your-username>/medtrac.git
   git push -u origin main
   ```

---

## 🌐 Deploying Live to Vercel

### Option A: Automatic Vercel GitHub Integration (Recommended)
1. Go to [vercel.com/new](https://vercel.com/new).
2. Connect your GitHub account and import the `medtrac` repository.
3. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `NEXT_PUBLIC_APP_URL` (set to your Vercel deployment URL, e.g. `https://medtrac.vercel.app`)
4. Click **Deploy**. Vercel will build and launch your mobile application live.

### Option B: Deploy via Vercel CLI
```bash
npx vercel
```
Follow the interactive prompts to link your project and deploy.

---

## 🔒 Security & Medical Disclaimer

> **"Organises your records. Not medical advice."**

Medtrac is a record-organizing tool and does not provide clinical diagnoses, prescriptive dosages, or treatment plans. All clinical changes should be evaluated with your licensed physician.
- All database tables enforce Supabase Row-Level Security (RLS).
- Doctor access links expire automatically after 24 hours and can be revoked by the patient at any time.
