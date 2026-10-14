# WinFab Billing Frontend

Next.js + Tailwind UI for WinFab billing.

## Features

- Login page
- Purchase orders (supplier, items, qty, rate, amount)
- Sales invoices grouped by PO → Bill → line items
- Excel export

## Local setup

```bash
nvm use 20
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000

Default login: `admin@winfab.com` / `admin123`

## Deploy to Vercel

1. Import the GitHub repo [`Surendarc-ai/winfab-billing-frontend`](https://github.com/Surendarc-ai/winfab-billing-frontend) in [Vercel](https://vercel.com/new).
2. Framework Preset: **Next.js** (auto-detected).
3. Add Environment Variable:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_API_URL` | `https://nprah32ilk.execute-api.ap-south-1.amazonaws.com/prod/api` |

4. Deploy.
5. Copy the Vercel URL (e.g. `https://winfab-billing-frontend.vercel.app`) and update backend CORS:

```bash
# in winfab-billing-backend/.env
FRONTEND_URL=http://localhost:3000,https://YOUR-APP.vercel.app
npm run deploy
```

Region hint: `vercel.json` sets `bom1` (Mumbai) to stay close to the Lambda API in `ap-south-1`.
