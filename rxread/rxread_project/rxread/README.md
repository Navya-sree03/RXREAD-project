# RxRead — AI Prescription Reader
### CIP Project | 6th Semester

RxRead is a Flask web application that uses Claude AI (vision) to read doctor prescriptions (handwritten or printed) and return a clean, structured breakdown of medicines, dosages, and instructions.

---

## Project Structure

```
rxread/
├── app.py                  # Flask backend (main application)
├── requirements.txt        # Python dependencies
├── Procfile                # For Render deployment
├── render.yaml             # Render configuration
├── templates/
│   └── index.html          # Frontend HTML
└── static/
    ├── css/
    │   └── style.css       # Stylesheet
    └── js/
        └── main.js         # Frontend JavaScript
```

---

## How to Run Locally

### Step 1 — Get an Anthropic API Key
1. Go to https://console.anthropic.com
2. Sign up / log in
3. Go to API Keys → Create Key
4. Copy the key (starts with `sk-ant-...`)

### Step 2 — Set up Python environment
```bash
# Make sure Python 3.9+ is installed
python --version

# Create a virtual environment
python -m venv venv

# Activate it
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 3 — Set your API key
```bash
# On Windows (Command Prompt):
set ANTHROPIC_API_KEY=sk-ant-your-key-here

# On Mac/Linux:
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Step 4 — Run the app
```bash
python app.py
```
Open http://localhost:5000 in your browser.

---

## How to Deploy on Render (Free Hosting)

### Step 1 — Push to GitHub
1. Create a free account at https://github.com
2. Create a new repository (e.g. `rxread`)
3. Upload all project files to it

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/rxread.git
git push -u origin main
```

### Step 2 — Deploy on Render
1. Go to https://render.com and sign up (free)
2. Click **New → Web Service**
3. Connect your GitHub account and select the `rxread` repo
4. Render will auto-detect the settings from `render.yaml`
5. Under **Environment Variables**, add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your actual API key (sk-ant-...)
6. Click **Create Web Service**
7. Wait 2-3 minutes — Render will give you a live URL like `https://rxread.onrender.com`

That's it! Your app is live on the internet for free.

---

## About the Domain Question

Buying a domain is optional. Here's what you should know:

| What you buy | Cost | What it gives you |
|---|---|---|
| Domain only (.in) | ~₹100-400/yr | Just an address, no server |
| Domain only (.com) | ~₹800-1000/yr | Just an address, no server |
| Render hosting | FREE | A `.onrender.com` URL + server |
| VPS hosting (if needed later) | ₹200-500/month | Full server control |

**Recommendation for college project:** Use Render's free hosting. You'll get a live URL at no cost. You can always buy a domain later and connect it in Render's dashboard under **Custom Domains**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python + Flask |
| AI / Vision | Anthropic Claude (claude-opus-4-5) |
| Frontend | HTML, CSS, Vanilla JavaScript |
| Hosting | Render.com (free tier) |

---

## Features

- Upload JPG, PNG, or WEBP prescription images
- Drag and drop support
- Extracts: medicine name, dosage, frequency, duration, instructions, quantity
- Also extracts: doctor name, patient name, hospital, diagnosis, date
- Clean card-based results UI
- Works with handwritten and printed prescriptions
- Mobile responsive

---

## Important Note

This app is for informational purposes only. Always verify medicines and dosages with a qualified pharmacist or doctor before consumption.
