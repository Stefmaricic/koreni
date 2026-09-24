# Koreni 🌳

Koreni ("roots" in Serbian) is a warm, mobile-first family tree app. Create an
account, build one or more family trees, add relatives and photos, and watch
the tree redraw itself automatically as you add parents, partners, children
and siblings.

Built with React + TypeScript + Vite + Tailwind CSS on the frontend, and
Supabase (PostgreSQL, Auth, Storage, Row Level Security) on the backend.

This guide assumes no prior experience deploying a full-stack app — follow it
top to bottom and you'll have Koreni running locally.

## 1. Required software

Install these first:

- **Node.js 20 or newer** — https://nodejs.org (installing Node also installs `npm`)
- **A free Supabase account** — https://supabase.com
- **Git** — https://git-scm.com (only needed if you'll push this to GitHub)

Check Node is installed:

```bash
node --version
```

## 2. Install dependencies

From the project folder:

```bash
npm install
```

## 3. Create a Supabase project

1. Go to https://supabase.com/dashboard and click **New project**.
2. Pick any name (e.g. "koreni") and a strong database password (save it
   somewhere safe — you won't need it for this app, but Supabase asks for it).
3. Wait ~2 minutes for the project to finish provisioning.

## 4. Set up the database

Koreni's tables, security policies and storage bucket live in
`supabase/migrations/`. The simplest way to apply them (no CLI required):

1. In your Supabase project, open the **SQL Editor** (left sidebar).
2. Click **New query**, paste the entire contents of
   `supabase/migrations/0001_init.sql`, and click **Run**.
3. Repeat for `supabase/migrations/0002_storage.sql`.

That creates all tables (`profiles`, `family_trees`, `tree_memberships`,
`family_members`, `relationships`), Row Level Security policies, and a
`person-photos` storage bucket.

<details>
<summary>Alternative: using the Supabase CLI</summary>

If you have the [Supabase CLI](https://supabase.com/docs/guides/cli) installed
and linked to your project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

This applies every file in `supabase/migrations/` in order.
</details>

### Enable email confirmations (optional but recommended)

By default Supabase requires email confirmation before a new user can log in.
For local development you can turn this off under **Authentication → Providers
→ Email → Confirm email** so you can register and log in immediately without
checking an inbox. Leave it on for a real deployment.

## 5. Configure environment variables

1. In the Supabase dashboard, go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon / public** key (not the
   `service_role` key — that one must never be used in frontend code).
3. In the Koreni folder, copy the example env file:

   ```bash
   cp .env.example .env.local
   ```

4. Open `.env.local` and fill in the two values:

   ```
   VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

`.env.local` is already in `.gitignore` and will never be committed.

## 6. Run the app locally

```bash
npm run dev
```

Open http://localhost:5173. You should see the Koreni landing page. From
there: **Get started** → register an account → you'll land on the dashboard.

Click **Try a demo family tree** on an empty dashboard to instantly load an
~18-person, 4-generation sample tree — handy for trying out the tree view
without entering people by hand.

## 7. Building for production

```bash
npm run build
```

This runs a TypeScript check and outputs a static site to `dist/`. Preview
the production build locally with:

```bash
npm run preview
```

## 8. Other useful commands

```bash
npm run lint    # oxlint static analysis
npm run test    # vitest unit tests (tree layout + family graph logic)
```

## Project structure

```
src/
  components/    UI building blocks (ui/, layout/, auth/, tree/, person/, dashboard/)
  pages/         Route-level pages
  hooks/         Data-fetching and interaction hooks (usePanZoom, useTreeData, ...)
  services/      Supabase queries, grouped by domain (auth, tree, person, relationship, storage)
  stores/        Small zustand stores (auth session, toasts)
  utils/         Pure logic: the tree layout algorithm, the family relationship graph, mappers
  locales/       en.json / sr.json translation files
  demo/          Demo family tree data (seeded on request, flagged is_demo = true)
  types/         TypeScript types mirroring the database schema + app domain models
supabase/
  migrations/    SQL migrations (schema, RLS policies, storage bucket)
```

## How the family tree layout works

The SVG tree is never hand-positioned. `src/utils/treeLayout.ts` takes the
raw list of people + relationships and:

1. Groups partners into "units" that must stay side by side.
2. Assigns each person a generation by walking parent/partner edges.
3. Orders each generation left-to-right using a barycenter heuristic (to
   reduce crossing lines) and centers parents above their children.
4. Produces absolute pixel positions plus the connector-line geometry.

Editing a person or relationship just re-fetches the data and re-runs this
function — you never touch SVG coordinates directly.

## Generating types from your live database (optional)

`src/types/database.ts` is hand-written to mirror the migrations. If you'd
rather generate it from your actual Supabase project:

```bash
npx supabase gen types typescript --project-id <your-project-ref> --schema public > src/types/database.generated.ts
```

The generated file works out of the box and can replace `src/types/database.ts`
directly — update the imports in `src/lib/supabase.ts` if you rename it. The
hand-written version in this repo is kept as-is (no CLI login required) so the
project runs without any extra setup.

## Troubleshooting

**"Supabase is not configured" warning in the browser console** — you haven't
created `.env.local` yet, or the dev server needs restarting after you added
it. Stop `npm run dev` (Ctrl+C) and start it again.

**Registering/logging in does nothing, or a network error appears** — double
check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` exactly
match the Supabase dashboard (Project Settings → API), and that you ran both
migration files.

**"new row violates row-level security policy"** — this means you tried to
insert/update something without the right `tree_memberships` role, or a
migration didn't fully apply. Re-run `0001_init.sql` in the SQL Editor and
check the **Logs → Postgres Logs** panel in Supabase for the exact error.

**Photo upload fails** — confirm `0002_storage.sql` ran successfully (check
**Storage** in the Supabase dashboard for a `person-photos` bucket).

**Port 5173 already in use** — another `npm run dev` is already running
somewhere; stop it, or run `npm run dev -- --port 5174`.

## Pushing this project to GitHub

From inside the project folder:

```bash
git init
git add .
git commit -m "Initial commit: Koreni"
```

Then create an empty repository on GitHub (no README/license — you already
have one): go to https://github.com/new, name it `koreni`, and click **Create
repository**. GitHub will show you a remote URL; connect and push:

```bash
git remote add origin https://github.com/<your-username>/koreni.git
git branch -M main
git push -u origin main
```

`.env.local` and `node_modules/` are already excluded via `.gitignore`, so no
secrets or build artifacts get committed.

## Deploying Koreni publicly

See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step hosting instructions
(Vercel/Netlify/Cloudflare Pages), environment variables, auth redirect URLs,
and connecting a custom domain.
