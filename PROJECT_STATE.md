# Koreni — Project State

_Last updated: 2026-09-28. This file is a snapshot for continuing development safely — re-verify anything time-sensitive (deployed bundle, DB schema) against the live system rather than trusting this blindly after a long gap._

Koreni ("Roots") is a Serbian-language family-tree web app. Serbian only — no English UI — with a Cyrillic/Latin toggle. Started as a family project; explicitly may end up used by other families too.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite 8, Tailwind CSS v4 (`@theme`, `@custom-variant dark` in `src/index.css`).
- **State**: Zustand — `src/stores/authStore.ts`, `themeStore.ts`, `toastStore.ts`.
- **Routing**: react-router-dom v7 (`src/App.tsx`).
- **i18n**: i18next / react-i18next, two locales only: `src/locales/sr-Cyrl.json` and `sr-Latn.json`. No English resource exists — every user-facing string must be added to both files.
- **Backend**: Supabase (Postgres + Auth + Storage + RLS). No custom server — all writes go through PostgREST via `supabase-js`, authorized entirely by Row Level Security policies and a few `SECURITY DEFINER` functions.
- **Hosting**: Vercel, auto-deploys on push to `main` on GitHub (`Stefmaricic/koreni`). SPA rewrite in `vercel.json` (`/(.*) → /index.html`).
- **Email**: Supabase Auth email confirmation is **on**. Custom SMTP (Gmail relay, `smtp.gmail.com:587`, sender display name "Koreni") is configured in the Supabase dashboard so the branded confirmation template actually gets used — on the free tier, custom Auth email templates are only honored once custom SMTP is set; otherwise Supabase silently sends its generic default template regardless of what's saved in the template editor. The branded template itself (subject + HTML body, Cyrillic/Latin conditional via `{{ .Data.preferred_language }}`) lives only in the Supabase dashboard (Authentication → Emails → Templates → Confirm signup), **not** in this repo — if it ever needs to change, it has to be re-pasted there directly (a copy exists in this session's history if needed).

## Database / Supabase setup

Project ref: `eormmcmhbmicvvtujllt` (SQL editor: `https://supabase.com/dashboard/project/eormmcmhbmicvvtujllt/sql/new`).

**No Supabase CLI is linked to this repo** (no `supabase/config.toml`, no `supabase link`). Migrations in `supabase/migrations/*.sql` are the source of truth for *what should be in the DB*, but nothing applies them automatically — every migration must be manually pasted into the SQL Editor and run by hand. Treat the migrations folder as documentation-of-intent, not as proof the DB is in that state — always sanity-check against the dashboard if unsure.

### Known gap: migration 0004 is missing from disk
`0004_admin_read_access.sql` (admin read-only access to all trees, via an `is_app_admin()` helper keyed on `auth.email() = 'mstefan44@gmail.com'`) was **never written to the repo** — an automated safety classifier blocked the `Write` tool call for that file's content (flagged as an "admin bypass" pattern) and it was given to the user directly in chat instead. It's presumed the user pasted and ran it manually, since the admin trees panel in Settings works in production, but **this SQL does not exist anywhere in version control**. If this ever needs to be reproduced or audited, it must be reconstructed from scratch (or recovered from an old conversation transcript) — it is not just "the next migration file to run."

The gap in numbering (0001 → 0002 → 0003 → 0005 → 0006, no 0004 file) is intentional/historical, not a mistake to fix by renumbering.

### Schema summary (by migration)

- **0001_init.sql** — core schema: `profiles` (1:1 with `auth.users`), `family_trees`, `tree_memberships` (role: `owner`/`editor`/`viewer`, unique on `(tree_id, user_id)`), `family_members`, `relationships` (`type`: `parent`/`partner`; for `parent`, `person_a_id` = parent, `person_b_id` = child). Siblings are **not stored** — derived client-side from shared parent rows (`src/utils/familyGraph.ts`). RLS keyed off a `SECURITY DEFINER` helper `is_tree_member(tree_id, min_role)` to avoid recursive-policy issues. A trigger (`handle_new_tree`) auto-inserts an `owner` membership row whenever a `family_trees` row is created — this is also why the dashboard's "list my trees" query works uniformly for owners and invited collaborators alike (both are just rows in `tree_memberships`).
- **0002_storage.sql** — Supabase Storage bucket + policies for person photos, gated by `is_tree_member(tree_id, 'editor')` parsed out of the storage path.
- **0003_feedback.sql** — `feedback` table (bug reports / suggestions from the in-app widget). Anyone signed in can insert their own; only the app owner (`auth.email() = 'mstefan44@gmail.com'`, hardcoded by email so it survives account recreation) can read.
- **(0004 — missing from disk, see above)** — admin (`mstefan44@gmail.com`) read-only `select` policies on `profiles`, `family_trees`, `tree_memberships`, `family_members`, `relationships`, `feedback`, via an `is_app_admin()` helper.
- **0005_invites.sql** — `tree_invites` table: owner-generated single-use tokens granting `editor`/`viewer` role. Two `SECURITY DEFINER` RPCs: `get_invite_info(token)` (public preview, no auth required) and `redeem_invite(token)` (creates the `tree_memberships` row, marks the invite used; `on conflict (tree_id, user_id) do nothing` so re-accepting doesn't downgrade an existing role).
- **0006_members_and_activity_log.sql** — (a) `tree_memberships_delete_owner` policy: tree owner can remove a collaborator's membership row (but never a row with `role = 'owner'`, i.e. never themselves this way). (b) `activity_log` table + `SECURITY DEFINER` triggers on `family_members` (insert/update/delete) and `relationships` (insert/delete) that record who did what — added/edited/removed a person, connected/disconnected two people — with a field-level diff for edits. Regular clients have no `insert` policy on `activity_log`; only the triggers (running as table owner) can write to it, so the log can't be forged by an editor/viewer. **This migration was applied manually via the SQL Editor on 2026-09-28** (confirmed working).

### RLS role model
`viewer` < `editor` < `owner`, checked via `is_tree_member(tree_id, min_role)`. Viewers can read; editors can read/write `family_members`/`relationships`; only owners can rename/delete the tree, manage invites, and remove members. `family_trees_select_member` policy checks `owner_id = auth.uid()` directly (not just `is_tree_member`) to sidestep a RETURNING-visibility race right after insert (see comment in 0001).

### supabase-js typing gotchas (already solved, don't reintroduce)
- `src/types/database.ts` Row/Insert/Update types **must** be `type` aliases, not `interface` — an `interface` has no implicit index signature and silently collapses supabase-js's generic constraint to `never`.
- Every embedded-resource foreign key used anywhere in a `.select('...')` string **must** have real FK metadata in the `Relationships` tuple (via the local `FkTo<>` helper), not `Relationships: []` — an empty array doesn't just skip typing, it turns the specific embed into `SelectQueryError` and collapses the *whole* query's result type to `never`.

## Implemented features

- Auth: register/login/logout, forgot/reset password, email confirmation (branded template via Gmail SMTP, see above).
- i18n: Serbian Cyrillic (default) / Latin toggle, no English anywhere.
- Dark mode: sun/moon toggle, system-preference default, persists explicit choice (`src/stores/themeStore.ts`).
- Family trees: create/rename/delete, add/edit/delete people, connect as parent/partner, `family_members`/`relationships` CRUD via `src/services/personService.ts` / `relationshipService.ts`.
- Tree canvas (`src/components/tree/TreeCanvas.tsx`, layout in `src/utils/treeLayout.ts`): pan/zoom (`src/hooks/usePanZoom.ts`), two visual styles — `classic` and `rooted` (default; rooted is a pure vertical mirror of classic's computed coordinates, not a separate layout algorithm). Generation assignment via delta-propagation + barycenter crossing-reduction + bottom-up centering.
- Export: SVG / PNG / PDF (`src/utils/exportTree.ts`), initials-only avatars (no photos) for CORS/portability, SVG recommended above ~40 people.
- Dashboard "Новине"/"Novosti" (What's New) panel: compact scrollable sidebar box (`src/components/dashboard/WhatsNewPanel.tsx`), sourced from `src/data/changelog.ts`. **Update this file's `CHANGELOG` array whenever something user-visible ships** — short bullet phrases in both `cyrl` and `latn` arrays, newest entry first. This does not auto-update from git history; it's manually maintained and has been out of sync with actual shipped work before (remember to commit+push it, not just edit locally — it's easy to forget the deploy step).
- Trello board link on the dashboard, below the changelog panel.
- Feedback widget (`src/components/feedback/FeedbackWidget.tsx`): floating button site-wide except `/tree/:id` pages (where it's integrated into the tree canvas's own control stack instead, via `onOpenFeedback` prop threaded through `TreePage.tsx`). Stored in `feedback` table, viewable only by the admin (Settings page, gated by `ADMIN_EMAIL` constant in `SettingsPage.tsx`).
- Admin (`mstefan44@gmail.com`) can browse **all** trees read-only from Settings (`AdminTreesPanel.tsx`) — relies on the missing-from-disk 0004 migration (see gap above). `getMyRole` returns `null` (not an error) when the viewer has no membership row, which `TreePage.tsx` renders as an "adminPreview" badge instead of erroring.
- Collaboration / invites: tree owner generates a single-use, role-scoped (`editor`/`viewer`) link from the Share modal (`src/components/tree/ShareTreeModal.tsx`); invitee opens `/invite/:token` (`InvitePage.tsx`, route is outside `ProtectedRoute`), previews via `get_invite_info`, and accepts (must be logged in — register/login carry `state: { from: '/invite/:token' }` so the post-auth redirect lands back on the invite) via `redeem_invite`.
- Member management: owner can remove a collaborator from the Share modal (added 2026-09-28; needs migration 0006 applied).
- Activity/history log: "History" button (clock icon) in the tree header, visible to any real member (not admin-preview). Shows a chronological feed — person added/edited/removed, relationship connected/disconnected — with actor name and relative timestamp (`src/components/tree/ActivityLogModal.tsx`, `src/services/activityService.ts`). Backed entirely by DB triggers (see 0006); nothing on the client writes to `activity_log` directly.

## Important decisions (the "why", not just the "what")

- **No English, ever, by design.** This is a deliberate product decision, not an oversight — don't add an English locale without being asked.
- **Rooted tree style is the default**, oldest generation at the bottom — changed from an initial "classic" default per explicit user request.
- **SVG export recommended over PNG/PDF for large trees** — stays sharp at any zoom and file size doesn't balloon with person count; PNG/PDF are for casual sharing/printing.
- **Export omits real photos** (initials-only avatars) — avoids canvas-tainting/CORS issues with Supabase Storage URLs and keeps exported files small and portable.
- **Feedback owner check is by email, not a hardcoded user id** — so it survives the admin account being deleted/recreated.
- **Invite redemption is idempotent by design** (`on conflict do nothing`) — someone who already has access (e.g. the owner opening their own invite link by mistake) keeps their existing role rather than being silently downgraded.
- **Activity log writes only happen via `SECURITY DEFINER` triggers**, with no client-facing insert policy — a deliberate integrity choice so the audit trail can't be forged by a collaborator with editor access.
- **A member can only be removed if their role isn't `owner`** — ownership is a property of `family_trees.owner_id`, not something that should ever be strippable via the membership-removal path.
- **The "direct descendants stay centered, spouses/children branch left/right" tree layout redesign is explicitly deferred.** The user raised it, then said to leave it aside until the actual end user (not the developer) supplies a reference picture of what they want, specifically because an existing 110-person tree's structure shouldn't be broken by a redesign without knowing the real target shape first. **Do not pick this back up unprompted** — wait for the user to bring the reference picture.
- **Permission model idea (not implemented, explicitly "just a thought" for later):** letting an invited collaborator "claim" which person they are on the tree, then scoping their edit rights to whoever is *graph-reachable* from that person via any chain of relationship lines (not degree-limited) — i.e. connectivity, not distance. In a single well-connected tree this would grant near-full access to everyone; it mainly protects against accidentally-unlinked branches. Bigger lift than the current owner/editor/viewer model (would need a recursive/graph-reachability check, likely a `SECURITY DEFINER` recursive SQL function for RLS). Not started.

## Known bugs / gotchas to watch for

- **Migration 0004 doesn't exist in the repo** (see above) — anyone reconstructing the schema from scratch will be missing admin read-access policies and won't know it from `supabase/migrations/` alone.
- **No CI/auto-deploy for DB migrations.** Pushing to `main` deploys the frontend via Vercel automatically, but SQL migrations are always a manual copy-paste into the Supabase SQL Editor as a separate step — easy to forget, and there's no automated check that the deployed frontend's expectations match the actual live schema. After adding a migration file, always explicitly tell the user to run it and roughly what it should say afterward.
- **`git commit` from this environment needs an explicit identity override** — the global git config has no user configured, so commits use `git -c user.name="mstefan44" -c user.email="mstefan44@gmail.com" commit ...` rather than touching global config.
- **CRLF/LF warnings on every commit** are expected/harmless on this Windows checkout (`warning: ... LF will be replaced by CRLF ...`) — not a real problem, don't "fix" it by changing line endings or `.gitattributes` unless asked.
- **Vercel deploys are not instant** — after pushing, the previous JS bundle hash can still be live for ~30–60s; when verifying a deploy, poll the served bundle's script hash (or just wait ~40s) before concluding a change didn't ship. Don't assume "still shows old content" means the push failed.
- **Supabase's free-tier auth mailer has a low rate limit** without custom SMTP, and even *with* the Gmail relay configured, sending many test signups in a short window (as happened during testing) can cause confirmation emails to be delayed well past a minute — don't assume delivery is broken just because a test email hasn't arrived within ~60–90 seconds during heavy testing.
- **Deleting a person cascades to delete their `relationships` rows**, which fires the `relationships_activity_log` trigger too — expect a `person_removed` entry plus one or more `relationship_removed` entries for the same action, with the removed person's name possibly showing as unavailable in the relationship-removed entry (their `family_members` row is already gone by the time that trigger runs). This is expected noise, not a bug to fix reflexively.
- **TreeCard's overflow menu (rename/delete) doesn't check role** — it's always rendered regardless of whether the current user is `editor`/`viewer`/admin-preview. Actual mutation is still blocked server-side by RLS (`family_trees_update_editor`/`_delete_owner` require `editor`/`owner`), so it's not a security hole, but a viewer/editor can see rename/delete options that will fail — worth a UI polish pass at some point, not yet done.

## Current TODOs / open threads

- Nothing is actively in-progress right now (last shipped: member removal + activity/history log, 2026-09-28, confirmed working after the 0006 migration ran successfully).
- **Changelog**: the 2026-09-28 member-removal/activity-log feature has **not yet been added to `src/data/changelog.ts`** — do this (short bullets, both scripts) and push before considering that feature "fully shipped" per this project's established practice of keeping "Новине" in sync with real releases.
- Waiting on the user for a reference picture before touching the trunk/spine tree layout redesign (see Important Decisions above) — do not start this speculatively.
- Optional future extension mentioned by the user, not requested yet: extend the "who can edit what" permission model per the connectivity-based idea above.
- Consider whether `activity_log` should eventually be paginated/limited more aggressively in the UI — currently fetches up to 100 most-recent entries per open, fine for now but will need attention on very active/large trees.
- The `TreeCard` role-blind rename/delete menu (see Known Bugs) could use a `canEdit`/`isOwner` prop gate — not done, not blocking, low priority.

## Files/components most important for continuing development

| Concern | File(s) |
|---|---|
| DB schema source-of-truth (incomplete, see 0004 gap) | `supabase/migrations/*.sql` |
| Supabase client + generated-by-hand types | `src/lib/supabase.ts`, `src/types/database.ts` |
| Tree data fetching / role resolution | `src/hooks/useTreeData.ts`, `src/services/treeService.ts` |
| Tree canvas + layout algorithm | `src/components/tree/TreeCanvas.tsx`, `src/utils/treeLayout.ts`, `src/hooks/usePanZoom.ts` |
| Person/relationship CRUD | `src/services/personService.ts`, `src/services/relationshipService.ts` |
| Invites / collaboration | `src/services/inviteService.ts`, `src/components/tree/ShareTreeModal.tsx`, `src/pages/InvitePage.tsx` |
| Activity/history log | `src/services/activityService.ts`, `src/components/tree/ActivityLogModal.tsx` |
| Admin views | `src/components/admin/AdminTreesPanel.tsx`, `src/components/feedback/FeedbackAdminPanel.tsx`, `src/pages/SettingsPage.tsx` (`ADMIN_EMAIL` constant) |
| i18n resources (edit **both** on every new string) | `src/locales/sr-Cyrl.json`, `src/locales/sr-Latn.json` |
| Changelog shown on dashboard | `src/data/changelog.ts` |
| Export | `src/utils/exportTree.ts`, `src/components/tree/ExportTreeModal.tsx` |

## Environment / deployment reference

- Local dev: `npm run dev` (Vite, port 5173). Env vars in `.env.local` (see `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Never put the service-role key in frontend env.
- Build: `npm run build` (`tsc -b && vite build`). Type-check alone: `npx tsc -b`. Test: `npm run test` (Vitest — currently covers `familyGraph` and `treeLayout` utils only).
- Deploy: push to `main` → Vercel auto-builds and deploys to `https://koreni-app.vercel.app`. No manual deploy step needed for frontend changes; DB migrations always need the manual SQL Editor step described above.
- Admin/owner account: `mstefan44@gmail.com` — hardcoded in multiple places (`feedback` RLS, `SettingsPage.tsx` `ADMIN_EMAIL`, the missing 0004 migration's `is_app_admin()`). If this account is ever recreated or the email changes, all of these need updating together.
