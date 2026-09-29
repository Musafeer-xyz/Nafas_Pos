# NAFAS POS

A lightweight Inventory & Point-of-Sale system for the NAFAS brand — built for small perfume/attar shops that sell by the milliliter. Mobile-first, works great on a phone.

## Features

- 🔐 **PIN login** — one admin PIN from `.env`, plus per-user accounts with fine-grained permissions
- 🛒 **Fast sale entry** — cart with ml/piece units, custom price overrides, per-sale extra costs, live net-profit preview, and a review step before saving
- 📦 **Stock by store** — main warehouse + branches, stock transfers, branch sales, low-stock alerts
- 🎁 **Combo packs** — sell bundles that auto-deduct stock from every product inside
- 🧾 **Costs tracker** — operational costs with Paid/Due/Partial status
- 📥 **Bulk import** — paste products, past sales, and costs as plain text
- 📤 **Reports** — one-click CSV/Excel export and print-ready PDF report
- 📶 **Offline awareness** — banner warns when the connection drops so sales are never silently lost
- 🛡️ **Safe selling** — unfinished carts survive refreshes and ask before being discarded

## Tech Stack

- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT auth
- **Frontend:** single-file mobile-first UI (`public/index.html`), no build step

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file (copy the example, then edit it)
cp .env.example .env

# 3. Start the server
npm start          # production
npm run dev        # development (auto-restart with nodemon)

# 4. Open http://localhost:3000 and log in with your ADMIN_PIN
```

> Full deployment guide (MongoDB Atlas + Render free hosting): see [SETUP_GUIDE.md](SETUP_GUIDE.md)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB connection string (local or Atlas) |
| `JWT_SECRET` | Long random string used to sign login tokens |
| `ADMIN_PIN` | The 4-digit admin PIN (full access) |
| `PORT` | Optional — defaults to 3000 |

## Roles & Permissions

The admin PIN has full access. Additional users are created in the **Users** tab, each with their own 4-digit PIN and any combination of: view dashboard, view stock, view history, sell from main store, sell from branch, add/edit products, manage costs, transfer stock, and delete sales. Quick presets make setup one tap.

## Project Structure

```
├── server.js               ← Express entry point
├── models/                 ← Product, Combo, Sale, ExtraCost, Branch, User
├── controllers/            ← product, combo, sale logic (stock + pricing)
├── routes/                 ← REST API endpoints
├── middleware/auth.js      ← JWT verify + permission guards
└── public/index.html       ← complete frontend (single file)
```

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with PIN |
| GET/POST/PUT/DELETE | `/api/products` | Product CRUD |
| PATCH | `/api/products/:id/stock` | Adjust stock |
| GET/POST | `/api/combos` | Combo packs |
| POST | `/api/sales` | Record a sale (auto stock deduction) |
| DELETE | `/api/sales/:id` | Delete sale + restore stock |
| GET/POST/DELETE | `/api/costs` | Cost entries |
| GET | `/api/dashboard/stats` | Admin analytics |
| GET | `/api/dashboard/assistant` | Stock-only view |

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for the complete API reference.

---

*Built for the NAFAS Brand*
