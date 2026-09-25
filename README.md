# Eco-Bridge

Mobile-first civic issue reporting and solution management platform for the Government of Jharkhand.

Citizens report local problems, government officers review and resolve them with AI-assisted (human-approved) triage, and universities, startups, industries and CSR partners work on approved innovation challenges.

## Features

- Six roles with separate dashboards: Citizen, Government Officer, Department Administrator, University / Student Team, Industry / Startup / CSR Partner, Super Admin
- 5-step citizen report form with photo evidence, GPS/manual location and offline draft support
- Readable public issue IDs (e.g. `JH-2026-0001`) and a full status timeline
- Officer review with deterministic AI suggestions labelled "AI suggestion — pending human approval" and a confirmation step before marking an issue Resolved
- Innovation workflow: Issue → Government Approval → Partner → Research → Prototype → Field Pilot → Deployment Approval → Impact Measurement
- In-app notifications (SMS / WhatsApp are clearly labelled integration placeholders)
- English | हिन्दी toggle, accessible forms, large tap targets, high contrast

## Tech stack

React 19 · TypeScript · Vite · TanStack Start / TanStack Router · TanStack Query · Tailwind CSS v4 · shadcn/ui · Zod · Supabase (auth, Postgres, storage, RLS)

---

## 1. Run the project locally (end to end)

### Prerequisites

- **Node.js 20+** (`node -v` to check) — npm comes with it
- *(Optional but recommended)* **Bun** (`curl -fsSL https://bun.sh/install | bash`) — this project ships a `bun.lock`, so installs are fastest and most reproducible with Bun. npm works too.

### Step 1 — Install dependencies

```bash
bun install      # or: npm install
```

### Step 2 — Create your `.env`

```bash
cp .env.example .env
```

Then fill in your Supabase values (see Step 3 for where to find them):

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-ref
```

> The URL and the key **must come from the same Supabase project**, otherwise every request returns "Invalid API key" / 401.

### Step 3 — Set up the Supabase backend

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run every SQL file in order. First the ones in `supabase/migrations/` (in filename order), then the ones in `docs/sql/` (in date order). This creates the tables (`profiles`, `user_roles`, `departments`, `issue_categories`, `reports`, `report_media`, `report_updates`, `notifications`, `feedback`, `innovation_projects`, `partner_applications` and the innovation/tracking additions), row-level security policies, triggers and demo data.
3. **Authentication → Providers**: enable **Email**. For the demo, enable auto-confirm so the demo accounts work immediately.
4. **Storage**: create a **private** bucket named `report-media` (10 MB file size limit). Media is served through signed URLs.
5. Copy the project URL and publishable key into `.env` (Project Settings → API).

### Step 4 — Start the dev server

```bash
bun run dev      # or: npm run dev
```

Open **http://localhost:8080**. The preview hot-reloads as you edit.

### Step 5 — Sign in with a demo account

Password for every demo account: `Jharkhand#Demo2026`

| Role | Email |
| --- | --- |
| Citizen | citizen@demo.jh |
| Government Officer | officer@demo.jh |
| Department Administrator | department@demo.jh |
| University / Student Team | university@demo.jh |
| Industry / Startup / CSR Partner | industry@demo.jh |
| Super Admin | admin@demo.jh |

Full end-to-end journey to try: sign in as **citizen@demo.jh** → submit a report with a photo → sign in as **officer@demo.jh** → review the report, accept the AI suggestion and mark it resolved → back as the citizen, confirm and give feedback.

### Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| "Invalid API key" or 401 on every page | `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are from different projects. Use both from the same project and restart the dev server. |
| "useLang must be used inside LanguageProvider" | Stale dev-server state — restart `bun run dev`. |
| Tables / columns missing errors | Some SQL files weren't run. Re-run every file from Step 3.2. |
| Images fail to upload | The private `report-media` storage bucket doesn't exist (Step 3.4). |

---

## 2. Deploy to Vercel

This is a **full-stack app** (server-rendered pages + server functions), so it needs Vercel's runtime — not plain static hosting. The build uses **Nitro**, which has a built-in Vercel target via the `NITRO_PRESET=vercel` environment variable.

### Option A — Vercel CLI (recommended for a first deploy)

```bash
# 1. Build with the Vercel preset
NITRO_PRESET=vercel bun run build        # npm: NITRO_PRESET=vercel npm run build
# (Windows PowerShell: $env:NITRO_PRESET='vercel'; npm run build)

# 2. Deploy the prebuilt output
npx vercel deploy --prebuilt
```

Follow the CLI prompts to link the project. The output directory is `.vercel/output/` (auto-detected from the preset — do not set one manually).

### Option B — Vercel dashboard (deploy on every Git push)

1. Push the repo to GitHub/GitLab/Bitbucket.
2. In Vercel: **Add New → Project** → import the repo.
3. Framework Preset: **Other** (no preset override).
4. Build Command: `npm run build` (or `bun run build`)
   Output Directory: leave **empty / auto**.
5. Environment Variables (Project → Settings → Environment Variables), all environments:
   - `NITRO_PRESET` = `vercel`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
6. Deploy. Every push to the production branch redeploys automatically.

### After deploying

- The Supabase values above are the *browser/publishable* pair only — no secret keys are stored in this codebase, so nothing sensitive ships to the client.
- If pages show "Invalid API key" after deploy, re-check that the URL and key come from the same Supabase project.
- Refresh / deep-link 404s mean the `NITRO_PRESET=vercel` variable wasn't picked up — verify it is set as a **build** environment variable, then redeploy.

---

## Environment variables

| Variable | Where | Description |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env` + hosting | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` + hosting | Supabase publishable (anon) key |
| `VITE_SUPABASE_PROJECT_ID` | `.env` + hosting | Supabase project ref |
| `NITRO_PRESET` | build env on Vercel | Must be `vercel` when deploying to Vercel |

No secret keys are stored in the codebase. Server-side keys (service role) are never exposed to the browser.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Dev server on http://localhost:8080 |
| `bun run build` | Production build |
| `bun run preview` | Preview the production build locally |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |
