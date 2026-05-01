# NAFAS POS System — Setup & Deployment Guide

## Project Structure
```
nafas/
├── server.js               ← Main entry point
├── package.json
├── .env.example            ← Copy to .env and fill in your values
├── .gitignore
├── models/
│   ├── Product.js          ← Attar, Apparel, Gadget
│   ├── Combo.js            ← Combo packs (auto deducts per-product stock)
│   ├── Sale.js             ← Sale records with net profit calc
│   └── ExtraCost.js        ← Operational costs tracker
├── controllers/
│   ├── productController.js
│   ├── comboController.js
│   └── saleController.js   ← Core logic: stock deduction + price override
├── routes/
│   ├── auth.js             ← PIN-based login → JWT
│   ├── products.js
│   ├── combos.js
│   ├── sales.js
│   ├── costs.js
│   └── dashboard.js        ← Admin stats + Assistant stock view
├── middleware/
│   └── auth.js             ← JWT verify + adminOnly guard
└── public/
    └── index.html          ← Complete mobile-first UI (single file)
```

---

## Step 1: MongoDB Atlas (Free Database)

1. Go to https://cloud.mongodb.com → Sign up free
2. Create a new **Project** → Create a **Free Cluster (M0)**
3. Under **Database Access** → Add a user (e.g. `nafas_user`, create a password)
4. Under **Network Access** → Add IP Address → **Allow access from anywhere** (0.0.0.0/0)
5. Click **Connect** on your cluster → **Connect your application** → Copy the URI:
   ```
   mongodb+srv://nafas_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/nafas
   ```

---

## Step 2: Local Development

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file
cp .env.example .env

# 3. Edit .env with your values:
#    MONGO_URI=mongodb+srv://...
#    JWT_SECRET=any_long_random_string
#    ADMIN_PIN=your4digitpin    (you — full access)
#    ASSISTANT_PIN=your4digitpin (your assistant — sale entry + stock view)

# 4. Start development server
npm run dev

# 5. Open http://localhost:3000 in browser
```

---

## Step 3: Deploy to Render (Free Hosting)

### A. Push to GitHub
```bash
git init
git add .
git commit -m "Initial NAFAS POS system"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/nafas-pos.git
git push -u origin main
```

### B. Deploy on Render
1. Go to https://render.com → Sign up with GitHub
2. Click **New** → **Web Service**
3. Connect your GitHub repo
4. Fill in:
   - **Name**: nafas-pos
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free
5. Under **Environment Variables**, add:
   - `MONGO_URI` → your Atlas connection string
   - `JWT_SECRET` → any long random string
   - `ADMIN_PIN` → your 4-digit admin PIN
   - `ASSISTANT_PIN` → your assistant's 4-digit PIN
6. Click **Create Web Service**
7. Wait ~2 minutes → Your live URL will appear (e.g. `https://nafas-pos.onrender.com`)

**Share that URL with your assistant — they log in with their PIN!**

---

## Step 4: First-Time Data Entry

After deployment, log in as Admin and:

1. **Add Products** (from your 1st LOT and 2nd LOT data in the screenshots):
   - Go to Products tab → click "+ Product"
   - Add each attar with name, grade (A/B), stock (ml), purchase rate, selling price, lot name

2. **Create Combos** (like "Dunhill Desire + Dior Sauvage + Cool W Blue"):
   - Go to Products tab → click "+ Combo"
   - Name it, set the combo price (e.g. ৳500)
   - Select the 3 products and their quantities (3.5ml each)

3. **Record Costs** (from your existing expense log):
   - Go to Costs tab → "+ Record Cost"
   - Add: Printer ৳6000, Raw ৳5777, Sticker Paper ৳50, etc.

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | Public | Login with PIN |
| GET | /api/products | Any | List all products |
| POST | /api/products | Admin | Add product |
| PUT | /api/products/:id | Admin | Update product |
| PATCH | /api/products/:id/stock | Admin | Adjust stock |
| DELETE | /api/products/:id | Admin | Remove product |
| GET | /api/combos | Any | List combos |
| POST | /api/combos | Admin | Create combo |
| POST | /api/sales | Any | Record a sale |
| GET | /api/sales | Admin | View all sales |
| DELETE | /api/sales/:id | Admin | Delete + restore stock |
| GET | /api/costs | Admin | View all costs |
| POST | /api/costs | Admin | Add a cost |
| GET | /api/dashboard/stats | Admin | Dashboard analytics |
| GET | /api/dashboard/assistant | Any | Stock-only view |

---

## Key Business Logic

### Combo Stock Deduction
When a combo sale is recorded, the system:
1. Checks stock of **all** products in the combo first
2. Only proceeds if **all** have sufficient stock
3. Uses MongoDB transactions — either all deductions succeed or none do

### Price Override
- When adding items to a sale, click the ✏️ icon on any cart item
- Enter a custom price (for friends/discounts)
- Original price is saved alongside for reference
- Marked as "CUSTOM PRICE" in records

### Net Profit Calculation
```
Net Profit = Total Revenue - (Packaging + Delivery + Others per sale)
```
Operational costs (Raw, Printer, etc.) are tracked separately in the Costs tab.

---

## Upgrading Later

### Future Features to Add:
- **Customer database** with purchase history
- **WhatsApp receipt** generation via WhatsApp API
- **Monthly P&L report** export to PDF
- **Tanjim/Siam stock assignment** tracking (from your sheets)
- **Lot cost calculator** (auto per-ML cost from purchase data)

---

*Built for NAFAS Brand | Sheikh Mohammad Tanjim Hassan*
