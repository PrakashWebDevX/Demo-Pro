# Roadmap
- [x] AI Phone Assistant floating card + demo call modal (creates real report, source = AI Phone Call)
- [x] Realtime notifications bell + toasts + extra triggers (type column, officer notifications, feedback)
- [x] Dev-only auth debug panel (no JWT shown)
- [x] Download Report Receipt (printable)
- [x] Theme system (light/dark/high-contrast/system)
- [x] Contact Us page + contact_messages table + seed

## Smart Assignment & Innovation Matching
- [x] Phase 1: directories, rule-based AI suggestion, officer approval, citizen live tracking (SQL: docs/sql/2026-09-25_smart_assignment.sql — user must run)
- [x] Phase 2: Innovation Challenges, partner matching, invitations, seeded Central Market challenge (SQL: docs/sql/2026-09-25_innovation_phase2.sql — user must run)

## Phase 3
- [x] Menu links, citizen pilot feedback, Hindi text on challenge pages, impact recording + Impact dashboard (SQL: docs/sql/2026-09-25_innovation_phase3.sql — user must run)

## Phase 4 (complete)
- Partner accounts (university/industry) linked to innovation challenges; invitations visible, accept/decline from the partner workspace.
- Acceptance-test demo reports A (urban pothole) and B (rural handpump) with persisted AI recommendations.
- Page controls (10 per page) on the citizen and officer report lists.
- Needs: run `docs/sql/2026-09-25_innovation_phase4.sql` in Supabase.

## Phase 5 (complete)
- Standard tracking flow with Citizen Feedback and Closed stages, latest update, officer "Close Issue".
- Needs: run `docs/sql/2026-09-25_standard_tracking_phase5.sql` in Supabase.

## Master Problem Classification (complete, untested live)
- Officer card (Simple Issue / Innovation Problem), audit, citizen-safe messages.
- Needs: run `docs/sql/2026-09-25_master_classification.sql` in Supabase.
