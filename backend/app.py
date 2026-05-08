from flask import Flask, request, jsonify, session, redirect, url_for
from functools import wraps
import os, time, base64
from dotenv import load_dotenv
import google.oauth2.credentials
import googleapiclient.discovery
from googleapiclient.errors import HttpError
from flask_cors import CORS
from mysql.connector import pooling
from authlib.integrations.flask_client import OAuth
from werkzeug.security import generate_password_hash, check_password_hash
from sentence_transformers import SentenceTransformer, util

load_dotenv()
app = Flask(__name__)
CORS(app, supports_credentials=True)


app.config.update(
    SECRET_KEY=os.environ.get('SECRET_KEY'),
    SESSION_COOKIE_SAMESITE='None',
    SESSION_COOKIE_SECURE=True
)

model = SentenceTransformer('all-MiniLM-L6-v2')

db_pool = pooling.MySQLConnectionPool(
    pool_name="smartmail_pool",
    pool_size=10,
    host=os.environ.get('DB_HOST'),
    user=os.environ.get('DB_USER'),
    password=os.environ.get('DB_PASSWORD'),
    database=os.environ.get('DB_NAME'),
    charset='utf8mb4',
    collation='utf8mb4_unicode_ci'
)

oauth = OAuth(app)

google_gmail_oauth = oauth.register(
    name='google_gmail',
    client_id=os.environ.get("GOOGLE_CLIENT_ID"),
    client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
    access_token_url='https://oauth2.googleapis.com/token',
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    api_base_url='https://www.googleapis.com/gmail/v1/',
    client_kwargs={
        'scope': 'https://www.googleapis.com/auth/gmail.readonly',
        'access_type': 'offline',
        'prompt': 'consent'
    }
)

def get_db():
    return db_pool.get_connection()

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('logged_in'):
            return jsonify({'message': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

def call_with_backoff(api_method, *args, **kwargs):
    base_delay = 1
    for attempt in range(5):
        try:
            return api_method(*args, **kwargs).execute()
        except HttpError as e:
            if e.resp.status in [429, 500, 503]:
                time.sleep(base_delay * (2 ** attempt))
            else:
                raise
    raise Exception("Max retries exceeded for Gmail API call")

def get_credentials(token_data, update_session=True):
    creds = google.oauth2.credentials.Credentials(
        token_data['access_token'],
        refresh_token=token_data.get('refresh_token'),
        token_uri='https://oauth2.googleapis.com/token',
        client_id=os.environ.get("GOOGLE_CLIENT_ID"),
        client_secret=os.environ.get("GOOGLE_CLIENT_SECRET")
    )
    if creds.expired and creds.refresh_token:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
        if update_session:
            session['google_gmail_token'] = {
                'access_token': creds.token,
                'refresh_token': creds.refresh_token,
                'expires_at': creds.expiry.timestamp() if creds.expiry else time.time() + 3600
            }
    return creds

def get_message_body(payload):
    if 'parts' in payload:
        for part in payload['parts']:
            body = get_message_body(part)
            if body:
                return body
    if payload.get('mimeType') == 'text/plain':
        data = payload.get('body', {}).get('data')
        if data:
            return base64.urlsafe_b64decode(data).decode('utf-8', errors='replace')
    return ""

def get_gmail_service(token_data, update_session=True):
    return googleapiclient.discovery.build(
        'gmail', 'v1', credentials=get_credentials(token_data, update_session)
    )

def fetch_email_details(service, gmail_ids):
    emails = []
    for msg_id in gmail_ids:
        message = call_with_backoff(service.users().messages().get, userId='me', id=msg_id, format='full')
        payload = message.get('payload', {})
        headers = payload.get('headers', [])
        header = lambda name: next((h['value'] for h in headers if h['name'].lower() == name), '')
        emails.append({
            'id': msg_id,
            'subject': header('subject') or 'No Subject',
            'sender': header('from') or 'Unknown',
            'body': get_message_body(payload) or message.get('snippet', ''),
            'snippet': message.get('snippet', ''),
            'date': time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(int(message.get('internalDate', 0)) / 1000))
        })
    return emails

def get_categories(user_id, cursor):
    cursor.execute("SELECT name FROM categories WHERE user_id = %s", (user_id,))
    names = [r['name'] for r in cursor.fetchall()]
    return names

def calculate_embeddings(cat_names, emails):
    classifications = []
    if cat_names and emails:
        cat_embeddings = model.encode(cat_names, convert_to_tensor=True)
        email_texts = [f"{e['subject']} {e['body']}" for e in emails]
        email_embeddings = model.encode(email_texts, convert_to_tensor=True)
        cosine_scores = util.cos_sim(email_embeddings, cat_embeddings)
        
        for i in range(len(emails)):
            best_idx = cosine_scores[i].argmax().item()
            classifications.append({
                'category': cat_names[best_idx],
                'score': float(cosine_scores[i][best_idx])
            })
    else:
        classifications = [{'category': 'NA', 'score': 0.0}] * len(emails)
    return classifications
def save_emails_to_db(user_id, emails):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cat_names = get_categories(user_id, cursor)
        classifications = calculate_embeddings(cat_names, emails)
        
        insert_data = []
        for i, email in enumerate(emails):
            cls = classifications[i]
            insert_data.append((
                user_id, email['id'], email['sender'], email['subject'], 
                email['body'], cls['category'], cls['score'], email['date']
            ))

        query = """
            INSERT IGNORE INTO stored_emails 
            (user_id, gmail_id, sender, subject, email_text, category, confidence_score, date) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.executemany(query, insert_data)
        conn.commit()
    except Exception as e:
        app.logger.error(f"Sync error: {e}")
    finally:
        cursor.close()
        conn.close()

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT user_id FROM users WHERE email = %s", (data['email'],))
        if cursor.fetchone():
            return jsonify({'message': 'User already exists'}), 409
        cursor.execute("INSERT INTO users (name, email, password) VALUES (%s, %s, %s)",
                       (data['name'], data['email'], generate_password_hash(data['pass'])))
        conn.commit()
        session['user_id'] = cursor.lastrowid
        session['logged_in'] = True
        return jsonify({'message': 'Success'}), 201
    finally:
        cursor.close()
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT user_id, password FROM users WHERE name = %s OR email = %s", (data['name'], data['name']))
        res = cursor.fetchone()
        if res and check_password_hash(res[1], data['pass']):
            session['user_id'] = res[0]
            session['logged_in'] = True
            return jsonify({'message': 'Login Successful!'})
        return jsonify({'message': 'Invalid credentials'}), 401
    finally:
        cursor.close()
        conn.close()

@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'})

@app.route('/gmail/status')
@login_required
def gmail_status():
    return jsonify({'connected': 'google_gmail_token' in session})

@app.route('/gmail-connect')
@login_required
def gmail_connect():
    return google_gmail_oauth.authorize_redirect(url_for('google_auth', _external=True))

@app.route('/google-auth')
@login_required
def google_auth():
    try:
        session['google_gmail_token'] = google_gmail_oauth.authorize_access_token()
        return redirect(f"{os.environ.get('FRONTEND_URL', 'http://localhost:5173')}/home?gmail_connected=true")
    except Exception as e:
        return jsonify({'message': f'Gmail connection failed: {str(e)}'}), 500

@app.route('/categories', methods=['GET', 'POST'])
@app.route('/categories/<int:categoryId>', methods=['DELETE'])
@login_required
def categories(categoryId=None):
    uid = session['user_id']
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        if request.method == 'GET':
            cursor.execute("SELECT id, name FROM categories WHERE user_id = %s", (uid,))
            return jsonify(cursor.fetchall())
        if request.method == 'DELETE':
            cursor.execute("DELETE FROM categories WHERE id = %s AND user_id = %s", (categoryId, uid))
            conn.commit()
            return jsonify({'message': 'Category deleted'})
        name = request.json.get('name')
        cursor.execute("INSERT INTO categories (user_id, name) VALUES (%s, %s)", (uid, name))
        conn.commit()
        return jsonify({'id': cursor.lastrowid, 'name': name}), 201
    finally:
        cursor.close()
        conn.close()

@app.route('/get_emails')
@login_required
def get_emails():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT gmail_id, sender, subject, email_text, date, category 
            FROM stored_emails 
            WHERE user_id = %s 
            ORDER BY date DESC
        """, (session['user_id'],))
        return jsonify(cursor.fetchall())
    except Exception as e:
        return jsonify({'message': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/init_emails')
@login_required
def init_emails():

    """
    Initialize emails by fetching from Gmail API and storing in database.
    This function handles the complete process of retrieving user's emails,
    from checking existing emails to fetching new ones from Gmail.
    """
    user_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM stored_emails WHERE user_id = %s ORDER BY date DESC", (user_id,))
        existing = cursor.fetchall()
        if existing:
            return jsonify(existing)

        token_data = session.get('google_gmail_token')
        if not token_data:
            return jsonify({'message': 'Gmail not connected'}), 400

        service = get_gmail_service(token_data)
        all_ids, page_token = [], None
        for _ in range(2):
            results = call_with_backoff(service.users().messages().list, userId='me', q='category:primary', maxResults=500, pageToken=page_token)
            all_ids.extend(m['id'] for m in results.get('messages', []))
            page_token = results.get('nextPageToken')
            if not page_token:
                break

        if not all_ids:
            return jsonify({'message': 'No emails found'}), 400

        try:
            print(f"Starting fetch for user {user_id}...")
            service_fetch = get_gmail_service(token_data, update_session=False)
            chunk_size = 50
            for i in range(0, len(all_ids), chunk_size):
                batch_ids_chunk = all_ids[i:i + chunk_size]
                emails = fetch_email_details(service_fetch, batch_ids_chunk)
                if emails:
                    save_emails_to_db(user_id, emails)
                print(f"Processed batch {i//chunk_size + 1}")
            print(f"Finished fetch for user {user_id}.")
        except Exception as e:
            print(f"CRITICAL ERROR: {e}")

        return jsonify({'message': 'Initialization complete'}), 200
    finally:
        cursor.close()
        conn.close()

@app.route('/sync_emails', methods=['POST'])
@login_required
def sync_emails():
    user_id = session['user_id']
    token_data = session.get('google_gmail_token')
    if not token_data:
        return jsonify({'message': 'Gmail not connected'}), 400

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        service = get_gmail_service(token_data)
        page_token = None
        while True:
            results = call_with_backoff(service.users().messages().list, userId='me', q='category:primary', maxResults=50, pageToken=page_token)
            messages = results.get('messages', [])
            if not messages:
                break

            batch_ids = [m['id'] for m in messages]
            placeholders = ','.join(['%s'] * len(batch_ids))
            cursor.execute(f"SELECT gmail_id FROM stored_emails WHERE user_id = %s AND gmail_id IN ({placeholders})", (user_id, *batch_ids))
            existing_ids = {r['gmail_id'] for r in cursor.fetchall()}
            new_ids = [mid for mid in batch_ids if mid not in existing_ids]

            if new_ids:
                try:
                    app.logger.info(f"Starting sync fetch for user {user_id}...")
                    service_fetch = get_gmail_service(token_data, update_session=False)
                    chunk_size = 50
                    for i in range(0, len(new_ids), chunk_size):
                        batch_ids_chunk = new_ids[i:i + chunk_size]
                        emails = fetch_email_details(service_fetch, batch_ids_chunk)
                        if emails:
                            save_emails_to_db(user_id, emails)
                        app.logger.debug(f"Processed batch {i//chunk_size + 1}")
                    app.logger.info(f"Finished sync fetch for user {user_id}.")
                except Exception as e:
                    app.logger.error(f"CRITICAL ERROR during sync: {e}")

            if len(new_ids) < len(batch_ids):
                break

            page_token = results.get('nextPageToken')
            if not page_token:
                break

        cursor.execute("UPDATE users SET last_sync_date = NOW() WHERE user_id = %s", (user_id,))
        conn.commit()
        return jsonify({'message': 'Email sync complete.'}), 200
    except Exception as e:
        return jsonify({'message': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/update_class', methods=['POST'])
@login_required
def update_class():
    user_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
        
    try:
        # Fetch existing emails from DB instead of requiring them in the request body
        cursor.execute("""
            SELECT gmail_id as id, subject, email_text as body 
            FROM stored_emails 
            WHERE user_id = %s
        """, (user_id,))
        emails = cursor.fetchall()
        
        cat_names = get_categories(user_id, cursor)
        classifications = calculate_embeddings(cat_names, emails)
        
        update_data = []
        for i, email in enumerate(emails):
            cls = classifications[i]
            update_data.append((cls['category'], cls['score'], user_id, email['id']))

        if update_data:
            cursor.executemany(
                "UPDATE stored_emails SET category = %s, confidence_score = %s WHERE user_id = %s AND gmail_id = %s",
                update_data
            )
            
        conn.commit()
        return jsonify({'message': 'Email classification updated.'})
    except Exception as e:
        return jsonify({'message': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/update_email_category', methods=['POST'])
@login_required
def update_email_category():
    user_id = session['user_id']
    data = request.json
    gmail_id = data.get('gmail_id')
    new_category = data.get('new_category')

    if not gmail_id or not new_category:
        return jsonify({'message': 'Missing gmail_id or new_category'}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE stored_emails SET category = %s, confidence_score = %s WHERE user_id = %s AND gmail_id = %s",
            (new_category, 1.0, user_id, gmail_id)
        )
        conn.commit()
        return jsonify({'message': f'Email {gmail_id} moved to category {new_category}'}), 200
    except Exception as e:
        app.logger.error(f"Error updating email category: {e}")
        return jsonify({'message': 'Failed to update email category'}), 500
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    app.run(debug=True, port=5000, use_reloader=False)