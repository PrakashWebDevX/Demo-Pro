# Small UI improvements (no rebuild)

No schema, RLS, auth, routing, AI assistant logic or theme changes. No new dependencies or migrations.

## 1. Officer Dashboard: Master Case review cards
- Two large cards at the top of the Officer Dashboard: "Simple Issue Master Cases" and "Innovation Master Cases". Each shows a count from the reports already loaded (split by the existing innovation flag) and a review button.
- The buttons filter the existing report list on the same page (new `type=simple|innovation` search option). Reports waiting for officer approval sort to the top.
- Innovation rows show the existing AI category, duplicate count and suggested department. The "View Challenge" link uses the existing challenge link.
- Label on both cards: "AI recommends. Government approves."
- Existing detail pages and actions stay as they are.

## 2. Home page: Recently Resolved Issues
- Replace the current resolved list with at most 3 cards, each showing: category icon, the before photo if the viewer is allowed to see it, title, district/ward, a "Resolved" badge, a short summary from the latest update remark, and a "View Outcome" button.
- There's no separate "after" photo in the current data, so every card shows "Resolution photo will be added after field verification."
- No names, phone numbers, coordinates or private notes.

## 3. Evidence photos
- Reuse the existing media gallery on the report, officer and challenge detail pages. Section titles: "Citizen Evidence", plus "Challenge Evidence" on challenge pages.
- Add click-to-enlarge using the existing Dialog. The current permission checks stay in place.
- The data doesn't mark any photo as a resolution photo, so "Resolution Evidence" only shows an empty-state message.

## 4. Report page: voice report option
- Add a small "Prefer to speak?" card near the form with "Start Voice Report". It opens the existing AI Phone Assistant modal and carries a "Demo voice assistant" label.

## Technical details
- Files: officer/index.tsx, routes/index.tsx, components/app/MediaGallery.tsx, reports/$id.tsx, officer/$id.tsx, challenges/$id.tsx, report.tsx, PhoneAssistant.tsx (only an `open` prop, if it doesn't already accept one).
- The home page reads media and updates through existing RLS. When the public can't see them, the cards fall back to the icon and text only.
