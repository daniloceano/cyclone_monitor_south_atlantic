# Deployment Guide (Vercel)

## Prerequisites

- A [Vercel](https://vercel.com) account (free tier works)
- The processed data files already generated (see README § Setup)
- The repository pushed to GitHub / GitLab / Bitbucket

## Step 1 — Commit the processed data

The JSON artefacts in `public/data/` must be committed to the repository so Vercel's
build can serve them as static files:

```bash
git add public/data/
git commit -m "feat: add preprocessed cyclone track JSON artefacts"
git push
```

> If `public/data/` is large (>1 GB), consider using Git LFS or hosting the files in
> Vercel Blob Storage and fetching them at build time.  For this dataset (~90 MB total),
> standard git works fine.

## Step 2 — Import project in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Select **Import Git Repository**
3. Choose the `cyclone_monitor_south_atlantic` repository
4. Vercel will auto-detect Next.js — no framework override needed

## Step 3 — Set environment variables

In **Project Settings → Environment Variables**, add:

| Name | Value | Environments |
|------|-------|-------------|
| `SITE_PASSWORD` | `tc_petrobras` (or your chosen password) | Production, Preview |

> Never commit `.env` or `.env.local` to git.

## Step 4 — Deploy

Click **Deploy**. Vercel will:
1. Run `npm install`
2. Run `next build`
3. Deploy the static assets and serverless functions

The app will be available at `https://your-project.vercel.app`.

## Redeploying after data updates

If you re-run the preprocessing script with new data:

```bash
python3 scripts/preprocess_data.py
git add public/data/
git commit -m "chore: regenerate processed data artefacts"
git push
```

Vercel will automatically redeploy on push.

## Environment variables reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SITE_PASSWORD` | Yes | Password shown on the login screen. If unset, the login API returns HTTP 500. |
| `NODE_ENV` | Auto | Set by Vercel to `production`; controls cookie `secure` flag. |

## Vercel configuration notes

- **Build command**: `next build` (default, no override needed)
- **Output directory**: `.next` (default)
- **Install command**: `npm install` (default)
- The `public/data/` directory is served as static files from Vercel's global CDN
  with automatic gzip/brotli compression
- Serverless functions: `POST /api/auth` and `POST /api/auth/logout` (tiny, ~0 B bundle)

## Local production build test

Before deploying, verify the production build works locally:

```bash
npm run build
npm start
# Open http://localhost:3000
```
