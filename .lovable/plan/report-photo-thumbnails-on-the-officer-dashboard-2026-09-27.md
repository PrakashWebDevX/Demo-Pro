# Report photo thumbnails on the Officer dashboard

Small UI change only — no rebuild, no redesign, no schema/RLS/auth changes.

## Goal

Each report card on the Officer dashboard (`/officer`) shows the report's first photo as a small thumbnail on the **left side** of the card, so officers can recognise the issue at a glance.

## Changes

1. **`src/lib/reports.ts`** — add one helper `fetchReportThumbnails(reportIds)`:
   - Single query on `report_media` for the visible report IDs (images only).
   - One batch signed-URL call (same pattern as the existing `fetchReportMedia`).
   - Returns a map: report ID → first image URL.

2. **`src/routes/_authenticated/officer/index.tsx`** — card layout:
   - Fetch thumbnails for the currently visible page of reports (one query, cached like the existing report queries).
   - Card becomes a horizontal row: thumbnail (fixed ~96px square, rounded, cropped to fill) on the left, existing ID/badges/title/details/"Review report" button on the right.
   - If a report has no photo, show a small neutral placeholder (camera icon in a grey box) so all cards stay aligned.
   - On small phone screens the thumbnail shrinks (64px) and the card stays readable; nothing scrolls sideways.

## Technical details

- Reuses the existing `report-media` storage bucket and signed-URL flow — no new permissions or tables.
- No new dependencies; uses existing Tailwind classes and components.
- Verification: `bunx tsgo --noEmit`, then Playwright at 360px and 1366px signed in as the Officer demo to confirm thumbnails render, placeholder shows for photo-less reports, and no horizontal scroll.
