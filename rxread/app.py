import os, base64, json, re, sqlite3, hashlib, secrets
from datetime import datetime, timedelta
from functools import wraps
from flask import (Flask, render_template, request, jsonify,
                   redirect, url_for, session, flash, g)
import anthropic

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", secrets.token_hex(32))
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024
DATABASE = os.path.join(os.path.dirname(__file__), 'rxread.db')
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

# ─── Database ─────────────────────────────────────────────────────────────────

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        db.executescript('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                plan TEXT DEFAULT 'free',
                language TEXT DEFAULT 'en',
                plan_expiry TEXT,
                razorpay_payment_id TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                result_json TEXT,
                language TEXT DEFAULT 'en',
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
        ''')
        db.commit()

def hash_password(pw):
    salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + pw).encode()).hexdigest()
    return f"{salt}:{h}"

def check_password(stored, provided):
    parts = stored.split(':')
    if len(parts) != 2:
        return False
    salt, h = parts
    return hashlib.sha256((salt + provided).encode()).hexdigest() == h

# ─── Auth helpers ─────────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

def get_current_user():
    if 'user_id' not in session:
        return None
    return get_db().execute('SELECT * FROM users WHERE id=?', (session['user_id'],)).fetchone()

def is_pro(user):
    if not user or user['plan'] != 'pro':
        return False
    if user['plan_expiry']:
        try:
            if datetime.now() > datetime.fromisoformat(user['plan_expiry']):
                get_db().execute('UPDATE users SET plan="free" WHERE id=?', (user['id'],))
                get_db().commit()
                return False
        except Exception:
            pass
    return True

# ─── AI Prompts ───────────────────────────────────────────────────────────────

def get_system_prompt(language, mode='basic'):
    lang_instr = "Respond entirely in Tamil language (use Tamil script)." if language == 'ta' else "Respond in English."

    if mode == 'basic':
        return f"""You are RxRead, an AI prescription reader for patients in India. {lang_instr}
Extract all medicine info from the prescription image. Return ONLY valid JSON, no markdown:
{{"doctor":"name or null","hospital":"name or null","patient":"name or null","date":"date or null","diagnosis":"condition or null","summary":"1-2 sentence plain summary","medicines":[{{"name":"medicine name","dosage":"e.g. 500mg or null","frequency":"e.g. Twice daily or null","duration":"e.g. 5 days or null","instructions":"e.g. After food or null","purpose":"what this treats in simple words"}}],"notes":"any other notes or null"}}"""

    if mode == 'side_effects':
        return f"""You are RxRead, a medical AI. {lang_instr}
Given medicines, return side effects as ONLY valid JSON:
{{"side_effects":[{{"medicine":"name","common":["effect1","effect2"],"serious":["serious1"],"severity":"mild|moderate|severe"}}]}}"""

    if mode == 'interactions':
        return f"""You are RxRead, a medical AI. {lang_instr}
Check drug interactions. Return ONLY valid JSON:
{{"interactions":[{{"drug1":"name","drug2":"name","severity":"mild|moderate|severe","description":"what happens","advice":"what to do"}}],"safe_message":"message if no serious interactions"}}
If no interactions, return empty array with a reassuring safe_message."""

    if mode == 'ask':
        return f"""You are RxRead, a helpful medical AI for Indian patients. {lang_instr}
Answer questions about prescriptions in simple, clear language. Be warm and reassuring. Keep answers to 2-4 sentences. Always advise consulting the doctor for serious concerns."""

    return ""

# ─── Routes: Public ───────────────────────────────────────────────────────────

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('landing.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        language = request.form.get('language', 'en')
        if not name or not email or not password:
            flash('All fields are required.', 'error')
            return render_template('auth.html', mode='signup')
        if len(password) < 6:
            flash('Password must be at least 6 characters.', 'error')
            return render_template('auth.html', mode='signup')
        db = get_db()
        if db.execute('SELECT id FROM users WHERE email=?', (email,)).fetchone():
            flash('Email already registered. Please log in.', 'error')
            return render_template('auth.html', mode='signup')
        db.execute('INSERT INTO users (name,email,password_hash,language) VALUES (?,?,?,?)',
                   (name, email, hash_password(password), language))
        db.commit()
        user = db.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
        session['user_id'] = user['id']
        return redirect(url_for('dashboard'))
    return render_template('auth.html', mode='signup')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        db = get_db()
        user = db.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
        if not user or not check_password(user['password_hash'], password):
            flash('Invalid email or password.', 'error')
            return render_template('auth.html', mode='login')
        session['user_id'] = user['id']
        return redirect(url_for('dashboard'))
    return render_template('auth.html', mode='login')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/pricing')
def pricing():
    user = get_current_user()
    return render_template('pricing.html', user=user,
                           pro=is_pro(user) if user else False,
                           razorpay_key=os.environ.get('RAZORPAY_KEY_ID', 'rzp_test_placeholder'))

# ─── Routes: App (login required) ────────────────────────────────────────────

@app.route('/dashboard')
@login_required
def dashboard():
    user = get_current_user()
    db = get_db()
    scan_count = db.execute('SELECT COUNT(*) as c FROM scans WHERE user_id=?', (user['id'],)).fetchone()['c']
    recent = db.execute(
        'SELECT * FROM scans WHERE user_id=? ORDER BY created_at DESC LIMIT 3', (user['id'],)
    ).fetchall()
    return render_template('dashboard.html', user=user, scan_count=scan_count,
                           recent=recent, pro=is_pro(user))

@app.route('/history')
@login_required
def history():
    user = get_current_user()
    db = get_db()
    limit = 999 if is_pro(user) else 5
    scans = db.execute(
        'SELECT * FROM scans WHERE user_id=? ORDER BY created_at DESC LIMIT ?',
        (user['id'], limit)
    ).fetchall()
    return render_template('history.html', user=user, scans=scans, pro=is_pro(user))

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    user = get_current_user()
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        language = request.form.get('language', 'en')
        if name:
            db = get_db()
            db.execute('UPDATE users SET name=?, language=? WHERE id=?', (name, language, user['id']))
            db.commit()
            flash('Profile updated!', 'success')
        return redirect(url_for('profile'))
    scan_count = get_db().execute('SELECT COUNT(*) as c FROM scans WHERE user_id=?', (user['id'],)).fetchone()['c']
    return render_template('profile.html', user=user, scan_count=scan_count, pro=is_pro(user))

# ─── API Routes ───────────────────────────────────────────────────────────────

@app.route('/api/analyse', methods=['POST'])
@login_required
def api_analyse():
    user = get_current_user()
    if 'prescription' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    file = request.files['prescription']
    language = request.form.get('language', user['language'] or 'en')
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400
    ext = file.filename.rsplit('.', 1)[-1].lower()
    if ext not in ('jpg', 'jpeg', 'png', 'webp'):
        return jsonify({'error': 'Only JPG, PNG or WEBP supported'}), 400
    mime_map = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp'}
    image_b64 = base64.standard_b64encode(file.read()).decode()
    try:
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=2000,
            system=get_system_prompt(language, 'basic'),
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": mime_map[ext], "data": image_b64}},
                {"type": "text", "text": "Read this prescription and return JSON."}
            ]}]
        )
        raw = re.sub(r'```json|```', '', response.content[0].text.strip()).strip()
        result = json.loads(raw)
        db = get_db()
        db.execute('INSERT INTO scans (user_id,result_json,language) VALUES (?,?,?)',
                   (user['id'], json.dumps(result), language))
        db.commit()
        scan_id = db.execute('SELECT last_insert_rowid() as id').fetchone()['id']
        return jsonify({'success': True, 'data': result, 'scan_id': scan_id})
    except json.JSONDecodeError:
        return jsonify({'error': 'Could not parse prescription. Try a clearer image.'}), 422
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/side-effects', methods=['POST'])
@login_required
def api_side_effects():
    user = get_current_user()
    if not is_pro(user):
        return jsonify({'error': 'pro_required'}), 403
    data = request.json or {}
    medicines = data.get('medicines', [])
    language = data.get('language', user['language'] or 'en')
    if not medicines:
        return jsonify({'error': 'No medicines'}), 400
    try:
        response = client.messages.create(
            model="claude-opus-4-5", max_tokens=1500,
            system=get_system_prompt(language, 'side_effects'),
            messages=[{"role": "user", "content": f"Medicines: {', '.join(medicines)}"}]
        )
        raw = re.sub(r'```json|```', '', response.content[0].text.strip()).strip()
        return jsonify({'success': True, 'data': json.loads(raw)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/interactions', methods=['POST'])
@login_required
def api_interactions():
    user = get_current_user()
    if not is_pro(user):
        return jsonify({'error': 'pro_required'}), 403
    data = request.json or {}
    medicines = data.get('medicines', [])
    language = data.get('language', user['language'] or 'en')
    if len(medicines) < 2:
        return jsonify({'success': True, 'data': {'interactions': [], 'safe_message': 'Only one medicine — no interactions to check.'}})
    try:
        response = client.messages.create(
            model="claude-opus-4-5", max_tokens=1500,
            system=get_system_prompt(language, 'interactions'),
            messages=[{"role": "user", "content": f"Check interactions: {', '.join(medicines)}"}]
        )
        raw = re.sub(r'```json|```', '', response.content[0].text.strip()).strip()
        return jsonify({'success': True, 'data': json.loads(raw)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ask', methods=['POST'])
@login_required
def api_ask():
    user = get_current_user()
    if not is_pro(user):
        return jsonify({'error': 'pro_required'}), 403
    data = request.json or {}
    question = data.get('question', '')
    context = data.get('context', '')
    language = data.get('language', user['language'] or 'en')
    if not question:
        return jsonify({'error': 'No question provided'}), 400
    try:
        response = client.messages.create(
            model="claude-opus-4-5", max_tokens=600,
            system=get_system_prompt(language, 'ask'),
            messages=[{"role": "user", "content": f"Prescription: {context}\n\nQuestion: {question}"}]
        )
        return jsonify({'success': True, 'answer': response.content[0].text.strip()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/set-language', methods=['POST'])
@login_required
def api_set_language():
    lang = (request.json or {}).get('language', 'en')
    if lang not in ('en', 'ta'):
        return jsonify({'error': 'Invalid'}), 400
    get_db().execute('UPDATE users SET language=? WHERE id=?', (lang, session['user_id']))
    get_db().commit()
    return jsonify({'success': True})

@app.route('/api/payment-verify', methods=['POST'])
@login_required
def api_payment_verify():
    data = request.json or {}
    payment_id = data.get('razorpay_payment_id', '')
    if not payment_id:
        return jsonify({'error': 'No payment ID'}), 400
    expiry = (datetime.now() + timedelta(days=30)).isoformat()
    db = get_db()
    db.execute('UPDATE users SET plan="pro", plan_expiry=?, razorpay_payment_id=? WHERE id=?',
               (expiry, payment_id, session['user_id']))
    db.commit()
    return jsonify({'success': True})

@app.route('/api/scan/<int:scan_id>')
@login_required
def api_get_scan(scan_id):
    scan = get_db().execute('SELECT * FROM scans WHERE id=? AND user_id=?',
                             (scan_id, session['user_id'])).fetchone()
    if not scan:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'success': True, 'data': json.loads(scan['result_json']), 'language': scan['language']})

init_db()

@app.context_processor
def inject_user():
    return dict(current_user=get_current_user())

@app.template_filter('fromjson')
def fromjson_filter(s):
    try:
        return json.loads(s)
    except Exception:
        return {}

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
