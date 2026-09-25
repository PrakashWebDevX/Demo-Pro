# Jan Samadhan Jharkhand

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

## Local setup

```bash
npm install
cp .env.example .env    # fill in your Supabase values
npm run dev
```

The app runs on http://localhost:8080.

## Environment variables

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ref |

No secret keys are stored in the codebase. Server-side keys (service role) are never exposed to the browser.

## Supabase setup

1. Create a Supabase project.
2. Run every SQL file in `supabase/migrations/` in order (SQL editor or `supabase db push`). This creates the tables (`profiles`, `user_roles`, `departments`, `issue_categories`, `reports`, `report_media`, `report_updates`, `notifications`, `feedback`, `innovation_projects`, `partner_applications`), row-level security policies, triggers and demo data.
3. Authentication → Providers: enable **Email**. For the demo, enable auto-confirm so accounts work immediately.
4. Storage: create a **private** bucket named `report-media` (10 MB file size limit). Media is served through signed URLs.
5. Copy the project URL and publishable key into `.env`.

## Demo accounts

Password for every demo account: `Jharkhand#Demo2026`

| Role | Email |
| --- | --- |
| Citizen | citizen@demo.jh |
| Government Officer | officer@demo.jh |
| Department Administrator | department@demo.jh |
| University / Student Team | university@demo.jh |
| Industry / Startup / CSR Partner | industry@demo.jh |
| Super Admin | admin@demo.jh |

The login page has one-click buttons for each demo role; the first click creates the account against your own Supabase project and links the seeded demo data.

### Demo journey

Sign in as the Demo Citizen → open `JH-2026-0001` (waste issue in Ranchi) to see the full timeline: Submitted → Under Review → Assigned (Municipal Administration) → In Progress → Resolved → 5-star feedback. Sign in as the Demo Government Officer to review new reports, see the AI suggestion and act on it.

## Build

```bash
npm run build
```

## Deploy to Vercel or Netlify

1. Push the project to GitHub.
2. **Vercel** — import the repository, framework preset "Vite" (build command `npm run build`), and add the three `VITE_SUPABASE_*` environment variables.
3. **Netlify** — "Add new site → Import from Git", build command `npm run build`, and add the same environment variables. `netlify.toml` is included with the SPA redirect so deep links such as `/reports/123` work after a refresh.
4. Redeploy after adding environment variables.

## GitHub export checklist

- [ ] `.env` is git-ignored; `.env.example` is committed
- [ ] `supabase/migrations/` committed and applied to the target project
- [ ] `report-media` storage bucket created (private)
- [ ] Email auth enabled in Supabase
- [ ] Environment variables set on the hosting provider

## AI suggestions

The AI layer (`src/lib/ai-demo.ts`) is deterministic keyword logic, so the prototype needs no AI provider or API key. It returns a structured suggestion (category, priority, department, duplicate count, next action) so a real model can later be called from a server function and return the same shape. Every suggestion is labelled and requires human approval before action.
