# Deploying Koreni

Koreni's frontend is a static site (Vite build output) that can be hosted
anywhere that serves static files. Supabase stays your backend (database,
auth, storage) no matter where the frontend is hosted. This guide uses
**Vercel** because it has the simplest GitHub integration and a generous free
tier; Netlify and Cloudflare Pages work almost identically (notes for both are
included at the end).

This assumes you've never deployed a full-stack app before — follow it in
order.

## Before you start

- Your code is pushed to a GitHub repository (see the end of
  [README.md](README.md) if you haven't done this yet).
- You have a working Supabase project with the migrations applied (README.md,
  steps 3–4).

## 1. Create the hosting project (Vercel)

1. Go to https://vercel.com and sign up/log in with your GitHub account.
2. Click **Add New → Project**.
3. Select your `koreni` GitHub repository and click **Import**.
4. Vercel auto-detects Vite. Confirm these build settings (they should be
   filled in automatically):
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
   - **Install command**: `npm install`

## 2. Environment variables

Before clicking **Deploy**, expand **Environment Variables** and add:

| Name                      | Value                                          |
| -------------------------- | ----------------------------------------------- |
| `VITE_SUPABASE_URL`        | Your Supabase project URL                       |
| `VITE_SUPABASE_ANON_KEY`   | Your Supabase anon/public key                   |

(Same values as your local `.env.local` — find them again under Supabase
**Project Settings → API** if needed.)

Click **Deploy**. After ~1 minute you'll get a live URL like
`https://koreni.vercel.app`.

## 3. Configure Supabase auth redirect URLs

Supabase needs to know your deployed URL is allowed to receive auth redirects
(used for password reset emails and email confirmation links):

1. In Supabase: **Authentication → URL Configuration**.
2. Set **Site URL** to your deployed URL, e.g. `https://koreni.vercel.app`.
3. Under **Redirect URLs**, add:
   - `https://koreni.vercel.app/**`
   - `http://localhost:5173/**` (keep this so local dev still works)

Without this step, password reset links will redirect to the wrong place.

## 4. Future deploys

Every `git push` to your `main` branch now automatically triggers a new
Vercel deployment — no manual steps needed. Vercel also builds a preview
deployment for every pull request.

## 5. Custom domain (e.g. koreni.rs or koreni.app)

Supabase never hosts your frontend's public domain — only the hosting
provider (Vercel/Netlify/Cloudflare Pages) does. To connect a domain you've
purchased:

1. In Vercel: your project → **Settings → Domains → Add**.
2. Enter your domain (e.g. `koreni.rs`).
3. Vercel shows you either an **A record** + **CNAME**, or nameserver values,
   to add at your domain registrar (wherever you bought the domain — GoDaddy,
   Namecheap, etc.).
4. Add those records in your registrar's DNS settings. Propagation usually
   takes a few minutes, sometimes up to 24 hours.
5. Vercel automatically issues a free HTTPS certificate once DNS is verified.

After connecting the domain, repeat step 3 above (add
`https://koreni.rs/**` — and your `www` subdomain if you use one — to
Supabase's Redirect URLs, and update **Site URL** to your custom domain).

No application code changes are required to switch domains — the frontend
talks to Supabase via the API URL in your environment variables, which is
unrelated to what domain the frontend itself is served from.

## Alternative hosts

<details>
<summary>Netlify</summary>

1. https://app.netlify.com → **Add new site → Import an existing project** →
   pick your GitHub repo.
2. Build command: `npm run build`. Publish directory: `dist`.
3. **Site settings → Environment variables**: add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Custom domains: **Domain settings → Add a domain**.
</details>

<details>
<summary>Cloudflare Pages</summary>

1. https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect
   to Git** → pick your GitHub repo.
2. Framework preset: **Vite**. Build command: `npm run build`. Output
   directory: `dist`.
3. **Settings → Environment variables**: add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (for both Production and Preview).
4. Deploy. Custom domains: **Custom domains** tab on your Pages project.
</details>

## Single-page app routing note

Koreni uses client-side routing (React Router), so the host must serve
`index.html` for unknown paths instead of a 404 (e.g. loading
`/tree/abc123` directly, or refreshing on any page other than `/`). None of
the three hosts do this automatically for a plain Vite build, so the repo
includes both config files needed:

- **Vercel**: [`vercel.json`](vercel.json) at the project root, with a
  rewrite sending every path to `/index.html`.
- **Netlify and Cloudflare Pages**: [`public/_redirects`](public/_redirects),
  which both platforms read the same way and ends up published at the site
  root automatically as part of the Vite build.

If you ever see a 404 on a direct link into the app (not just on `/`),
this is almost always the cause — confirm the relevant file above exists
and was actually deployed.
