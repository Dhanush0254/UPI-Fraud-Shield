# complaints.py
import datetime
from bson import ObjectId
from database import complaints_table, users_table


def submit_complaint(data, user_id):
    """
    Submit a new fraud complaint.
    data dict keys: phone_number, txn_id, amount, payment_method, fraud_type, description, screenshot_path
    """
    user = users_table.find_one({"_id": ObjectId(user_id)})
    if not user:
        return None, "User not found"

    phone_number = data.get("phone_number", "").strip()
    txn_id = data.get("txn_id", "").strip()
    amount = data.get("amount", 0)
    payment_method = data.get("payment_method", "other")
    fraud_type = data.get("fraud_type", "other")
    description = data.get("description", "").strip()
    screenshot_path = data.get("screenshot_path", "")

    if not phone_number or not txn_id:
        return None, "Phone number and Transaction ID are required"

    # Calculate weighted vote
    credibility = user.get("credibility_score", 1.0)
    base_weight = 1.0
    if screenshot_path:
        base_weight += 2.0  # Evidence bonus
    if description and len(description) > 20:
        base_weight += 0.5  # Detail bonus

    weighted_vote = round(base_weight * credibility, 2)

    complaint_doc = {
        "phone_number": phone_number,
        "txn_id": txn_id,
        "amount": float(amount) if amount else 0,
        "payment_method": payment_method,
        "fraud_type": fraud_type,
        "description": description,
        "screenshot_path": screenshot_path,
        "reporter_user_id": ObjectId(user_id),
        "weighted_vote": weighted_vote,
        "status": "pending",  # pending | fraud | not_fraud
        "created_at": datetime.datetime.utcnow()
    }

    result = complaints_table.insert_one(complaint_doc)

    # Update user's total complaints count
    users_table.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"total_complaints": 1}}
    )

    return str(result.inserted_id), None


def get_user_complaints(user_id, status_filter=None):
    """Get all complaints submitted by a specific user."""
    query = {"reporter_user_id": ObjectId(user_id)}
    if status_filter and status_filter in ("pending", "fraud", "not_fraud"):
        query["status"] = status_filter

    results = []
    for c in complaints_table.find(query).sort("created_at", -1):
        results.append(_format_complaint(c))
    return results


def get_all_complaints(status_filter=None, search=None, page=1, per_page=20):
    """Get all complaints (admin). Supports filtering and pagination."""
    query = {}
    if status_filter and status_filter in ("pending", "fraud", "not_fraud"):
        query["status"] = status_filter
    if search:
        query["$or"] = [
            {"phone_number": {"$regex": search, "$options": "i"}},
            {"txn_id": {"$regex": search, "$options": "i"}}
        ]

    total = complaints_table.count_documents(query)
    skip = (page - 1) * per_page

    results = []
    for c in complaints_table.find(query).sort("created_at", -1).skip(skip).limit(per_page):
        complaint = _format_complaint(c)
        # Add reporter info for admin
        user = users_table.find_one({"_id": c["reporter_user_id"]})
        if user:
            complaint["reporter_username"] = user["username"]
            complaint["reporter_credibility"] = user.get("credibility_score", 1.0)
            complaint["reporter_total_complaints"] = user.get("total_complaints", 0)
            complaint["reporter_verified"] = user.get("verified_complaints", 0)
            complaint["reporter_rejected"] = user.get("rejected_complaints", 0)
        else:
            complaint["reporter_username"] = "Unknown"
            complaint["reporter_credibility"] = 0
        results.append(complaint)

    return {
        "complaints": results,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page)
    }


def set_verdict(complaint_id, verdict):
    """
    Admin sets verdict on a complaint.
    verdict: 'fraud' or 'not_fraud'
    Returns True on success.
    """
    if verdict not in ("fraud", "not_fraud"):
        return False, "Invalid verdict"

    complaint = complaints_table.find_one({"_id": ObjectId(complaint_id)})
    if not complaint:
        return False, "Complaint not found"

    # Update complaint status
    complaints_table.update_one(
        {"_id": ObjectId(complaint_id)},
        {"$set": {"status": verdict}}
    )

    # Update reporter credibility
    from auth import update_credibility
    update_credibility(str(complaint["reporter_user_id"]), verdict)

    return True, None


def check_number(phone_number):
    """
    Public number lookup — returns fraud stats for a phone number.
    Like a product review summary.
    """
    phone_number = phone_number.strip()
    complaints = list(complaints_table.find({"phone_number": phone_number}))

    if not complaints:
        return {
            "phone_number": phone_number,
            "total_complaints": 0,
            "fraud_count": 0,
            "not_fraud_count": 0,
            "pending_count": 0,
            "risk_score": 0,
            "risk_level": "safe",
            "recent_complaints": []
        }

    total = len(complaints)
    fraud_count = sum(1 for c in complaints if c["status"] == "fraud")
    not_fraud_count = sum(1 for c in complaints if c["status"] == "not_fraud")
    pending_count = sum(1 for c in complaints if c["status"] == "pending")

    # Calculate risk score (0-100)
    # Based on: total weighted votes, fraud ratio, total complaints
    total_weight = sum(c.get("weighted_vote", 1) for c in complaints)
    fraud_weight = sum(c.get("weighted_vote", 1) for c in complaints if c["status"] == "fraud")

    if total_weight > 0:
        weight_ratio = fraud_weight / total_weight
    else:
        weight_ratio = 0

    # Risk score formula
    base_risk = (fraud_count / max(1, total)) * 60  # Up to 60 from fraud ratio
    weight_risk = weight_ratio * 25  # Up to 25 from weighted votes
    volume_risk = min(15, total * 3)  # Up to 15 from complaint volume

    risk_score = min(100, int(base_risk + weight_risk + volume_risk))

    # Determine risk level
    if risk_score >= 70:
        risk_level = "high"
    elif risk_score >= 40:
        risk_level = "medium"
    elif risk_score > 0:
        risk_level = "low"
    else:
        risk_level = "safe"

    # Recent complaints (anonymized)
    recent = []
    for c in sorted(complaints, key=lambda x: x.get("created_at", datetime.datetime.min), reverse=True)[:5]:
        recent.append({
            "fraud_type": c.get("fraud_type", "other"),
            "payment_method": c.get("payment_method", "other"),
            "amount": c.get("amount", 0),
            "status": c.get("status", "pending"),
            "has_evidence": bool(c.get("screenshot_path")),
            "date": c.get("created_at", "").isoformat() if isinstance(c.get("created_at"), datetime.datetime) else ""
        })

    return {
        "phone_number": phone_number,
        "total_complaints": total,
        "fraud_count": fraud_count,
        "not_fraud_count": not_fraud_count,
        "pending_count": pending_count,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "recent_complaints": recent
    }


def get_admin_stats():
    """Get dashboard statistics for admin."""
    total = complaints_table.count_documents({})
    pending = complaints_table.count_documents({"status": "pending"})
    fraud = complaints_table.count_documents({"status": "fraud"})
    not_fraud = complaints_table.count_documents({"status": "not_fraud"})
    total_users = users_table.count_documents({})

    # Unique phone numbers reported
    unique_numbers = len(complaints_table.distinct("phone_number"))

    return {
        "total_complaints": total,
        "pending": pending,
        "fraud_confirmed": fraud,
        "not_fraud": not_fraud,
        "total_users": total_users,
        "unique_numbers_reported": unique_numbers
    }


def _format_complaint(c):
    """Format a complaint document for API response."""
    return {
        "complaint_id": str(c["_id"]),
        "phone_number": c.get("phone_number", ""),
        "txn_id": c.get("txn_id", ""),
        "amount": c.get("amount", 0),
        "payment_method": c.get("payment_method", "other"),
        "fraud_type": c.get("fraud_type", "other"),
        "description": c.get("description", ""),
        "has_screenshot": bool(c.get("screenshot_path")),
        "screenshot_path": c.get("screenshot_path", ""),
        "weighted_vote": c.get("weighted_vote", 0),
        "status": c.get("status", "pending"),
        "created_at": c.get("created_at", "").isoformat() if isinstance(c.get("created_at"), datetime.datetime) else ""
    }