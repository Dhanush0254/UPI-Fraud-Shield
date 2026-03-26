# auth.py
import bcrypt
import jwt
import datetime
from bson import ObjectId
from database import users_table, login_history_table, JWT_SECRET


def hash_password(password):
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password, hashed):
    """Verify a password against its hash."""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def generate_token(user_id, username, role):
    """Generate a JWT token."""
    payload = {
        "user_id": str(user_id),
        "username": username,
        "role": role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token):
    """Decode and verify a JWT token."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def add_user(username, email, password):
    """Register a new user. Returns the user doc or None if username/email exists."""
    # Check if username already exists
    if users_table.find_one({"username": username}):
        return None, "Username already exists"
    
    # Check if email already exists
    if email and users_table.find_one({"email": email}):
        return None, "Email already registered"
    
    # Store None instead of empty string so sparse unique index works
    user_doc = {
        "username": username,
        "email": email if email else None,
        "password": hash_password(password),
        "role": "user",  # "user" or "admin"
        "credibility_score": 1.0,
        "verified_complaints": 0,
        "rejected_complaints": 0,
        "total_complaints": 0,
        "created_at": datetime.datetime.utcnow()
    }
    result = users_table.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    return user_doc, None


def check_user(username, password):
    """Authenticate a user. Returns user dict or None."""
    user = users_table.find_one({"username": username})
    if not user:
        return None
    
    if not verify_password(password, user["password"]):
        return None
    
    return {
        "user_id": str(user["_id"]),
        "username": user["username"],
        "email": user.get("email", ""),
        "role": user.get("role", "user"),
        "credibility_score": user.get("credibility_score", 1.0),
        "total_complaints": user.get("total_complaints", 0),
        "verified_complaints": user.get("verified_complaints", 0),
    }


def get_user_by_id(user_id):
    """Get user by ObjectId string."""
    try:
        user = users_table.find_one({"_id": ObjectId(user_id)})
        if user:
            return {
                "user_id": str(user["_id"]),
                "username": user["username"],
                "email": user.get("email", ""),
                "role": user.get("role", "user"),
                "credibility_score": user.get("credibility_score", 1.0),
                "total_complaints": user.get("total_complaints", 0),
                "verified_complaints": user.get("verified_complaints", 0),
                "rejected_complaints": user.get("rejected_complaints", 0),
                "created_at": user.get("created_at", "")
            }
    except Exception:
        pass
    return None


def log_login(user_id, ip_address, user_agent):
    """Record a login event in the login_history collection."""
    login_history_table.insert_one({
        "user_id": ObjectId(user_id),
        "ip_address": ip_address,
        "user_agent": user_agent,
        "timestamp": datetime.datetime.utcnow()
    })


def get_login_history(user_id, limit=20):
    """Get recent login history for a user."""
    history = login_history_table.find(
        {"user_id": ObjectId(user_id)}
    ).sort("timestamp", -1).limit(limit)
    
    results = []
    for h in history:
        results.append({
            "ip_address": h.get("ip_address", "Unknown"),
            "user_agent": h.get("user_agent", "Unknown"),
            "timestamp": h["timestamp"].isoformat() if h.get("timestamp") else ""
        })
    return results


def update_credibility(user_id, verdict):
    """
    Update user credibility based on admin verdict on their complaint.
    verdict: 'fraud' or 'not_fraud'
    """
    user = users_table.find_one({"_id": ObjectId(user_id)})
    if not user:
        return
    
    credibility = user.get("credibility_score", 1.0)
    verified = user.get("verified_complaints", 0)
    rejected = user.get("rejected_complaints", 0)
    total = user.get("total_complaints", 0)
    
    if verdict == "fraud":
        # Complaint confirmed — reward the user
        verified += 1
        credibility = min(2.0, credibility + 0.05)
    elif verdict == "not_fraud":
        # Complaint rejected — penalize
        rejected += 1
        credibility = max(0.1, credibility - 0.1)
    
    # Extra penalty if > 70% of complaints are rejected
    if total > 3 and rejected / total > 0.7:
        credibility = max(0.1, credibility - 0.2)
    
    users_table.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "credibility_score": round(credibility, 2),
            "verified_complaints": verified,
            "rejected_complaints": rejected
        }}
    )


def seed_admin(username="admin", email="admin@fraudshield.com", password="admin123"):
    """Create an admin account if it doesn't exist."""
    existing = users_table.find_one({"username": username})
    if existing:
        # Make sure they have admin role
        users_table.update_one({"_id": existing["_id"]}, {"$set": {"role": "admin"}})
        return
    
    users_table.insert_one({
        "username": username,
        "email": email,
        "password": hash_password(password),
        "role": "admin",
        "credibility_score": 1.0,
        "verified_complaints": 0,
        "rejected_complaints": 0,
        "total_complaints": 0,
        "created_at": datetime.datetime.utcnow()
    })
    print(f"Admin account created: username='{username}', password='{password}'")