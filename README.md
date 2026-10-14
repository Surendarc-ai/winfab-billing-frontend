# WinFab Billing Frontend

Next.js + Tailwind UI for WinFab billing.

## Features

- Login page
- Left menu + right info panel
- **Purchase** — supplier, items, qty, rate, amount
- **Sales Invoice** — select PO, bill remaining qty (multiple invoices per PO)

## Setup

```bash
nvm use 20
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000

Default login: `admin@winfab.com` / `admin123`
