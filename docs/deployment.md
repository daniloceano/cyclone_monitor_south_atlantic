# Deployment Guide (Vercel)

## Prerequisites

- A [Vercel](https://vercel.com) account (free tier works)
- The processed data files already generated (see README § Setup)
- The repository pushed to GitHub / GitLab / Bitbucket

## Step 1 — Commit the processed data

The JSON artefacts in `site/public/data/` must be committed to the repository so Vercel's
build can serve them as static files:

```bash
git add site/public/data/
git commit -m "chore: add preprocessed cyclone track JSON artefacts"
git push
```

> If `site/public/data/` is large (>1 GB), consider using Git LFS.
> For this dataset (~583 MB total), standard git works fine.

## Step 2 — Import project in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Select **Import Git Repository**
3. Choose the `cyclone_monitor_south_atlantic` repository

## Step 3 — Set the root directory

Because the Next.js application lives in `site/`, you must tell Vercel where to find it:

- In **Configure Project**, set **Root Directory** to `site`

Vercel will then auto-detect Next.js. Build settings should be left as defaults:
- Build command: `next build`
- Output directory: `.next`
- Install command: `npm install`

## Step 4 — Set environment variables

In **Project Settings → Environment Variables**, add:

| Name | Value | Environments |
|------|-------|-------------|
| `SITE_PASSWORD` | `tc_petrobras` (or your chosen password) | Production, Preview |

> Never commit `.env` or `.env.local` to git.

## Step 5 — Deploy

Click **Deploy**. The app will be available at `https://your-project.vercel.app`.

## Redeploying after data updates

```bash
python3 scripts/preprocess_data.py   # run from project root
git add site/public/data/
git commit -m "chore: regenerate processed data artefacts"
git push
```

Vercel redeploys automatically on push.

## Environment variables reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SITE_PASSWORD` | Yes | Password shown on the login screen. If unset, the login API returns HTTP 500. |
| `NODE_ENV` | Auto | Set by Vercel to `production`; controls cookie `secure` flag. |

## Local production build test

```bash
cd site
cp .env.example .env.local   # set SITE_PASSWORD
npm run build
npm start
# Open http://localhost:3000
```
