# RxRead — AI Prescription Reader
### CIP Project | 6th Semester | Dept. of CSE | SCSVMV

- Navya Sree — 11239A063

**Guide:** Dr. V. Geetha, Asst. Prof., Dept. of CSE, SCSVMV

---

## What This App Does

RxRead is a full-stack web application that uses Claude AI (vision) to read doctor prescriptions — handwritten or printed — and gives patients a clear, structured breakdown in English or Tamil.

**Free features:**
- Prescription reading (unlimited scans)
- Medicine info cards with purpose
- Voice readout in Tamil and English
- Language toggle (full UI + AI responses)
- Last 5 scans saved in history

**Pro features (₹9/month):**
- Side effects analysis with severity rating
- Drug interaction checker
- Ask AI about your prescription (chat)
- Unlimited scan history

---

## Project Structure

```
rxread/
├── app.py                    # Flask backend — all routes, AI, auth, DB
├── requirements.txt          # Python dependencies
├── Procfile                  # For Render deployment
├── render.yaml               # Render auto-deploy config
├── .env.example              # Template for your environment variables
├── rxread.db                 # SQLite database (auto-created on first run)
├── templates/
│   ├── base.html             # Navbar, footer, language system
│   ├── landing.html          # Public landing page
│   ├── auth.html             # Sign up and log in (shared template)
│   ├── dashboard.html        # Main app — upload, results, Pro features
│   ├── history.html          # Scan history page
│   ├── pricing.html          # Pricing + Razorpay payment
│   └── profile.html          # Profile and settings
└── static/
    ├── css/style.css         # Full stylesheet (mobile-first, responsive)
    └── js/
        ├── lang.js           # EN/Tamil language switcher
        ├── nav.js            # Navbar, mobile menu, dropdown
        └── dashboard.js      # Upload, AI calls, voice, Pro features
```

---

## How to Run Locally

### Step 1 — Get your Anthropic API key
1. Go to https://console.anthropic.com
2. Sign up or log in
3. Click **API Keys** → **Create Key**
4. Copy the key (looks like `sk-ant-api03-...`)

### Step 2 — Set up Python environment

```bash
# Make sure Python 3.9+ is installed
python --version

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 3 — Create your .env file

```bash
# Copy the example
cp .env.example .env
```

Open `.env` and fill in:
```
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
SECRET_KEY=any-random-string-like-abc123xyz
RAZORPAY_KEY_ID=rzp_test_placeholder
PORT=5000
```

> You only NEED to fill in `ANTHROPIC_API_KEY`. The rest have safe defaults.

### Step 4 — Run the app

```bash
python app.py
```

Open http://localhost:5000 in your browser.

The SQLite database (`rxread.db`) is created automatically on first run.

---

## How to Deploy on Render (Free Hosting)

### Step 1 — Push code to GitHub

1. Create a free account at https://github.com
2. Create a new repository named `rxread`
3. Upload all project files

```bash
git init
git add .
git commit -m "Initial commit - RxRead CIP Project"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/rxread.git
git push -u origin main
```

### Step 2 — Deploy on Render

1. Go to https://render.com → Sign up (free)
2. Click **New** → **Web Service**
3. Connect your GitHub → select `rxread` repo
4. Render will detect settings from `render.yaml` automatically
5. Under **Environment Variables**, add:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | Your key from console.anthropic.com |
| `RAZORPAY_KEY_ID` | `rzp_test_placeholder` (or real key) |

6. Click **Create Web Service**
7. Wait ~3 minutes → your app is live at `https://rxread.onrender.com`

### Step 3 — Test it

- Open your live URL
- Sign up with any email + password
- Upload a prescription photo
- You should see results within 10-15 seconds

---

## Setting Up Razorpay (for live payments)

For the college demo, `rzp_test_placeholder` is fine — the payment button will show but won't process real money.

For real payments:
1. Sign up at https://razorpay.com
2. Complete KYC (individual account is fine)
3. Go to **Settings** → **API Keys** → **Generate Test Key**
4. Replace `RAZORPAY_KEY_ID` in your environment with `rzp_test_XXXXXXXX`
5. For live mode, switch to `rzp_live_XXXXXXXX` after KYC approval

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Backend | Python + Flask | Simple, fast, well-documented |
| Database | SQLite (auto-created) | Zero config, works everywhere |
| AI Vision | Anthropic Claude | Best-in-class handwriting reading |
| Auth | Flask sessions + bcrypt-style | Secure, no external service needed |
| Payments | Razorpay | India-first, supports UPI |
| Voice | Web Speech API | Built into browsers, no cost |
| Frontend | HTML + CSS + Vanilla JS | Fast, no build step needed |
| Hosting | Render.com | Free tier, supports Python |

---

## Key Features Explained

### Language Toggle
The entire app — UI labels, AI responses — switches between English and Tamil. The language preference is saved per user. When Tamil is selected, Claude responds entirely in Tamil.

### Voice Readout
Uses the browser's built-in Web Speech API (no cost, no external service). Reads the full prescription result aloud. Uses `ta-IN` locale for Tamil voice and `en-IN` for English. Works on Chrome, Edge, Safari.

### Pro Feature Gating
Every Pro API route (`/api/side-effects`, `/api/interactions`, `/api/ask`) checks `is_pro(user)` on the server. Even if someone bypasses the UI, the API will return `403` with `{'error': 'pro_required'}`. The frontend then shows the upgrade prompt.

### Prescription AI
Uses Claude's vision model (`claude-opus-4-5`) with a carefully structured system prompt that returns JSON. The JSON is parsed and rendered into medicine cards with colour-coded tags for dosage, frequency, duration.

---

## Important Notes

1. **This app is for informational purposes only.** Always consult a pharmacist or doctor before taking any medicine.
2. The app works best with clear, well-lit photos of prescriptions.
3. Handwritten prescriptions may have lower accuracy depending on how unclear the writing is.
4. The SQLite database file (`rxread.db`) is stored locally. On Render's free tier, this resets when the service restarts. For a persistent database in production, use Render's PostgreSQL addon (free up to 1GB).

---

## Making the Database Persistent on Render (Optional)

If you want scan history to survive restarts:

1. In Render dashboard → **New** → **PostgreSQL** (free tier)
2. Copy the **Internal Database URL**
3. Add env var: `DATABASE_URL=postgresql://...`
4. In `app.py`, replace SQLite connection with `psycopg2` — ask your guide for help with this step if needed.

For a college demo, SQLite is perfectly fine.
