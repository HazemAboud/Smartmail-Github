from flask import Flask, request, jsonify, session, redirect, url_for
import os
from dotenv import load_dotenv
import google.auth.transport.requests
import google.oauth2.credentials
import googleapiclient.discovery
from flask_cors import CORS
from mysql.connector import pooling
from authlib.integrations.flask_client import OAuth
from werkzeug.security import generate_password_hash, check_password_hash
from sentence_transformers import SentenceTransformer, util


load_dotenv()
app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"], supports_credentials=True)

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True

DB_CONFIG = {
    'host': os.environ.get('DB_HOST', '103.82.231.117'),
    'user': os.environ.get('DB_USER', 'izhadnwk_hazem'),
    'password': os.environ.get('DB_PASSWORD', 'vUBUW0#@cp~p'),
    'database': os.environ.get('DB_NAME', 'izhadnwk_smartmail_hazem'),
    'raise_on_warnings': True
}

db_pool = pooling.MySQLConnectionPool(pool_name="smartmail_pool", pool_size=5, **DB_CONFIG)

oauth = OAuth(app)

# Initialize the local embedding model
# 'all-MiniLM-L6-v2' is a small, fast model (approx 80MB) perfect for this task.
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")


# Register Google OAuth for Gmail API access
google_gmail_oauth = oauth.register(
    name='google_gmail',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    access_token_url='https://oauth2.googleapis.com/token',
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    api_base_url='https://www.googleapis.com/gmail/v1/',
    client_kwargs={
        'scope': 'https://www.googleapis.com/auth/gmail.readonly'
    }
)

def get_db_connection():
    return db_pool.get_connection()

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    password = data.get('pass')
    hashed_password = generate_password_hash(password)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # check if user exists
        user_query = "SELECT user_id FROM users WHERE email = %s OR name = %s"
        cursor.execute(user_query, (email, name))
        result = cursor.fetchone()
        if result:
            return jsonify({'message': 'User already exists'}), 409
        # insert user into the database
        insert_query = "INSERT INTO users (name, email, password) VALUES (%s, %s, %s)"
        cursor.execute(insert_query, (name, email, hashed_password))
        conn.commit()

        # Auto login after registration
        session['user_id'] = cursor.lastrowid
        session['logged_in'] = True

        return jsonify({'message': 'User registered successfully'}), 201
    finally:
        cursor.close()
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    name = data.get('name')
    password = data.get('pass')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        login_query = "SELECT user_id, password FROM users WHERE email = %s OR name = %s"
        cursor.execute(login_query, (name, name))
        result = cursor.fetchone()
        if result and check_password_hash(result[1], password):
            session['user_id'] = result[0]
            session['logged_in'] = True
            return jsonify({'message': 'Login Successful!'}), 200
        return jsonify({'message': 'Wrong Email or Password'}), 401
    finally:
        cursor.close()
        conn.close()

@app.route('/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    session.pop('logged_in', None)
    return jsonify({'message': 'Logout Successful!'}), 200

@app.route('/check_session', methods=['GET'])
def check_session():
    if session.get('logged_in'):
        return jsonify({'logged_in': True, 'user_id': session.get('user_id')}), 200
    return jsonify({'logged_in': False}), 200

@app.route('/profile', methods=['GET'])
def profile():
    if not session.get('logged_in'):
        print("not logged in")
        return jsonify({'message': 'Unauthorized'}), 401

    user_id = session.get('user_id')
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        profile_query = "SELECT user_id, name, email FROM users WHERE user_id = %s"
        cursor.execute(profile_query, (user_id,))
        user = cursor.fetchone()
        if user:
            return jsonify(user), 200
        return jsonify({'message': 'User not found'}), 404
    finally:
        cursor.close()
        conn.close()

@app.route('/gmail-connect')
def gmail_connect():
    if not session.get('logged_in'):
        print("not logged in")
        return jsonify({'message': 'Unauthorized'}), 401 
    
    redirect_uri = url_for('google_auth', _external=True)
    return google_gmail_oauth.authorize_redirect(redirect_uri)

@app.route('/google-auth')
def google_auth():
    if not session.get('logged_in'):
        print("not logged in")
        return jsonify({'message': 'Unauthorized'}), 401

    try:
        token = google_gmail_oauth.authorize_access_token()

        session['google_gmail_token'] = token
        
        FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
        return redirect(f'{FRONTEND_URL}/home?gmail_connected=true')
    except Exception as e:
        return jsonify({'message': f'Gmail connection failed: {str(e)}'}), 500

@app.route('/get_emails')
def get_emails():
    if not session.get('logged_in'):
        print("not logged in")
        return jsonify({'message': 'Unauthorized'}), 401

    token = session.get('google_gmail_token')
    if not token:
        return jsonify({'message': 'Gmail not connected'}), 400

    try:
        # Use the token to access the Gmail API
        # Create a Credentials object from the token
        credentials = google.oauth2.credentials.Credentials(
            token['access_token'],
            refresh_token=token.get('refresh_token'),
            token_uri=google_gmail_oauth.access_token_url,
            client_id=google_gmail_oauth.client_id,
            client_secret=google_gmail_oauth.client_secret,
            scopes=[google_gmail_oauth.client_kwargs['scope']]
        )
        gmail = googleapiclient.discovery.build('gmail', 'v1', credentials=credentials)

        messages = []
        request = gmail.users().messages().list(userId='me', q='category:primary')
        while request:
            response = request.execute()
            messages.extend(response.get('messages', []))
            request = gmail.users().messages().list_next(previous_request=request, previous_response=response)

        final_results = []
        for msg in messages:
            txt = gmail.users().messages().get(userId='me', id=msg['id']).execute()
            payload = txt.get('payload', {})
            headers = payload.get('headers', [])
            subject = next((header['value'] for header in headers if header['name'] == 'Subject'), 'No Subject')
            sender = next((header['value'] for header in headers if header['name'] == 'From'), 'Unknown Sender')
            final_results.append({
                'id': msg['id'],
                'snippet': txt.get('snippet'),
                'subject': subject,
                'sender': sender
            })

        # --- Classification Logic ---
        if final_results:
            # 1. Define Categories (You could also fetch these from your DB)
            categories = ["Work", "Personal", "Finance", "Promotions", "Travel"]
            
            # 2. Encode Categories (Convert text to vector numbers)
            category_embeddings = embedding_model.encode(categories, convert_to_tensor=True)
            
            # 3. Encode Emails (Subject + Snippet provides the best context)
            email_texts = [f"{email['subject']} {email['snippet']}" for email in final_results]
            email_embeddings = embedding_model.encode(email_texts, convert_to_tensor=True)

            # 4. Calculate Cosine Similarity
            # This creates a matrix comparing every email against every category
            cosine_scores = util.cos_sim(email_embeddings, category_embeddings)

            # 5. Assign the highest scoring category to the email object
            for i, email in enumerate(final_results):
                best_score_index = cosine_scores[i].argmax().item()
                email['category'] = categories[best_score_index]
                email['confidence_score'] = float(cosine_scores[i][best_score_index])

        return jsonify(final_results), 200
    except Exception as e:
        return jsonify({'message': f'Failed to retrieve emails: {str(e)}'}), 500

     
if __name__ == "__main__":
    app.run(debug=True, port=5000, use_reloader=False)