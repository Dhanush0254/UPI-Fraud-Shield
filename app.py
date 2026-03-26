# app.py
import io
from functools import wraps
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from bson import ObjectId
from auth import (
    add_user, check_user, get_user_by_id, generate_token, decode_token,
    log_login, get_login_history, seed_admin
)
from complaints import (
    submit_complaint, get_user_complaints, get_all_complaints,
    set_verdict, check_number, get_admin_stats
)
from database import fs

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=False)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ──────────────────────────────────────────────
# JWT Authentication Decorator
# ──────────────────────────────────────────────
def jwt_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({"error": "Authorization token required"}), 401

        token = auth_header.split(' ')[1]
        payload = decode_token(token)
        if not payload:
            return jsonify({"error": "Invalid or expired token"}), 401

        request.user = payload
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    @jwt_required
    def decorated(*args, **kwargs):
        if request.user.get("role") != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated


# ──────────────────────────────────────────────
# Auth Endpoints
# ──────────────────────────────────────────────
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400

    user, error = add_user(username, email, password)
    if error:
        return jsonify({"error": error}), 409

    token = generate_token(user["_id"], username, "user")
    return jsonify({
        "message": "Account created successfully",
        "token": token,
        "user": {
            "user_id": str(user["_id"]),
            "username": username,
            "email": email,
            "role": "user"
        }
    }), 201


@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    user = check_user(username, password)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    # Log login event
    log_login(
        user["user_id"],
        request.remote_addr or "unknown",
        request.headers.get("User-Agent", "unknown")
    )

    token = generate_token(user["user_id"], username, user["role"])
    return jsonify({
        "message": "Logged in successfully",
        "token": token,
        "user": user
    }), 200


@app.route('/api/me', methods=['GET'])
@jwt_required
def me():
    user = get_user_by_id(request.user["user_id"])
    if user:
        return jsonify(user), 200
    return jsonify({"error": "User not found"}), 404


@app.route('/api/login-history', methods=['GET'])
@jwt_required
def login_history():
    history = get_login_history(request.user["user_id"])
    return jsonify(history), 200


# ──────────────────────────────────────────────
# Public Number Check
# ──────────────────────────────────────────────
@app.route('/api/check-number/<phone>', methods=['GET'])
def check_number_route(phone):
    if not phone or len(phone) < 10:
        return jsonify({"error": "Valid phone number required"}), 400
    result = check_number(phone)
    return jsonify(result), 200


# ──────────────────────────────────────────────
# Complaint Endpoints
# ──────────────────────────────────────────────
@app.route('/api/complaints', methods=['POST'])
@jwt_required
def add_complaint():
    # Handle multipart form data (for file upload)
    if request.content_type and 'multipart/form-data' in request.content_type:
        phone_number = request.form.get('phone_number', '')
        txn_id = request.form.get('txn_id', '')
        amount = request.form.get('amount', 0)
        payment_method = request.form.get('payment_method', 'other')
        fraud_type = request.form.get('fraud_type', 'other')
        description = request.form.get('description', '')

        screenshot_path = ""
        if 'screenshot' in request.files:
            file = request.files['screenshot']
            if file and file.filename and allowed_file(file.filename):
                # Store in MongoDB GridFS
                file_id = fs.put(
                    file.read(),
                    filename=file.filename,
                    content_type=file.content_type or 'image/png'
                )
                screenshot_path = str(file_id)
    else:
        data = request.json or {}
        phone_number = data.get('phone_number', '')
        txn_id = data.get('txn_id', '')
        amount = data.get('amount', 0)
        payment_method = data.get('payment_method', 'other')
        fraud_type = data.get('fraud_type', 'other')
        description = data.get('description', '')
        screenshot_path = ''

    complaint_data = {
        "phone_number": phone_number,
        "txn_id": txn_id,
        "amount": amount,
        "payment_method": payment_method,
        "fraud_type": fraud_type,
        "description": description,
        "screenshot_path": screenshot_path
    }

    complaint_id, error = submit_complaint(complaint_data, request.user["user_id"])
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"message": "Complaint submitted successfully", "complaint_id": complaint_id}), 201


@app.route('/api/complaints/my', methods=['GET'])
@jwt_required
def my_complaints():
    status = request.args.get('status', None)
    complaints = get_user_complaints(request.user["user_id"], status)
    return jsonify(complaints), 200


# ──────────────────────────────────────────────
# Admin Endpoints
# ──────────────────────────────────────────────
@app.route('/api/admin/complaints', methods=['GET'])
@admin_required
def admin_complaints():
    status = request.args.get('status', None)
    search = request.args.get('search', None)
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    result = get_all_complaints(status, search, page, per_page)
    return jsonify(result), 200


@app.route('/api/admin/complaints/<complaint_id>/verdict', methods=['PUT'])
@admin_required
def admin_verdict(complaint_id):
    data = request.json
    verdict = data.get('verdict', '')
    if verdict not in ('fraud', 'not_fraud'):
        return jsonify({"error": "Verdict must be 'fraud' or 'not_fraud'"}), 400

    success, error = set_verdict(complaint_id, verdict)
    if not success:
        return jsonify({"error": error}), 400
    return jsonify({"message": f"Complaint marked as {verdict}"}), 200


@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def admin_stats():
    stats = get_admin_stats()
    return jsonify(stats), 200


# ──────────────────────────────────────────────
# Serve screenshots from GridFS
# ──────────────────────────────────────────────
@app.route('/api/screenshot/<file_id>')
def serve_screenshot(file_id):
    try:
        grid_file = fs.get(ObjectId(file_id))
        return Response(
            grid_file.read(),
            mimetype=grid_file.content_type or 'image/png',
            headers={'Cache-Control': 'public, max-age=86400'}
        )
    except Exception:
        return jsonify({"error": "Screenshot not found"}), 404


# ──────────────────────────────────────────────
# Start
# ──────────────────────────────────────────────
if __name__ == '__main__':
    seed_admin()  # Create admin account on first run
    app.run(debug=True, port=5000)