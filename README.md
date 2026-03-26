# 🛡️ UPI Fraud Shield

A community-driven platform to detect and report UPI fraud. Check any phone number's fraud risk score, file detailed complaints with evidence, and let admins verify reports — all powered by a credibility-weighted scoring engine.

---

## ✨ Features

### 🔍 Public Number Checker
- Instantly check if any phone number has been reported as fraudulent
- Risk score (0-100) calculated from community reports
- Anonymized complaint breakdown with fraud type distribution

### 📝 Multi-Step Fraud Reporting
- 4-step wizard: Details → How it Happened → Evidence → Review & Submit
- Supports screenshot uploads (stored in MongoDB GridFS)
- Tracks payment method, fraud type (link/call/QR/e-commerce), and transaction details

### ⚖️ Credibility Scoring Engine
- Users earn/lose credibility based on admin verdicts
- Reporters with high credibility carry more weight in fraud scoring
- Prevents spam — users who falsely report everyone get penalized

### 🛡️ Admin Dashboard
- View all complaints with stats (total, pending, confirmed, safe)
- One-click verdict system: Mark as **Fraud** or **Safe**
- See reporter credibility bars, search by phone/txn ID, paginated view
- View uploaded screenshot evidence

### 🔐 Authentication & Security
- JWT-based authentication with bcrypt password hashing
- Role-based access control (User / Admin)
- Login history tracking (IP, User-Agent, timestamp)
- Secrets stored in `.env` (never committed to git)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, Axios |
| **Backend** | Python Flask, Flask-CORS |
| **Database** | MongoDB Atlas, GridFS |
| **Auth** | JWT (PyJWT), bcrypt |
| **Styling** | Custom CSS (dark glassmorphism theme) |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)

### 1. Clone the repo
```bash
git clone https://github.com/Dhanush0254/upi-fraud-shield.git
cd upi-fraud-shield
```

### 2. Backend Setup
```bash
# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# Start backend
python app.py
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 4. Access the app
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000

### Default Admin Account
> Auto-created on first server start:
> - **Username:** `admin`
> - **Password:** `admin123`

---

## 📁 Project Structure

```
upi-fraud-shield/
├── app.py                 # Flask API server (10 endpoints)
├── auth.py                # JWT auth, bcrypt, credibility engine
├── complaints.py          # Complaint model, risk scoring, admin stats
├── database.py            # MongoDB connection, GridFS, indexes
├── requirements.txt       # Python dependencies
├── .env.example           # Environment variable template
├── .gitignore
└── frontend/
    ├── src/
    │   ├── App.jsx              # Main app with role-based routing
    │   ├── config.js            # Centralized API URL config
    │   ├── index.css            # Design system (dark glassmorphism)
    │   └── components/
    │       ├── NumberChecker.jsx    # Public hero page
    │       ├── ReportFraud.jsx     # 4-step complaint wizard
    │       ├── MyComplaints.jsx    # User's complaint history
    │       ├── AdminDashboard.jsx  # Admin panel with verdicts
    │       ├── Login.jsx           # JWT login
    │       └── SignUp.jsx          # Registration
    ├── package.json
    └── vite.config.js
```

---

## 🔌 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/signup` | — | Register new user |
| POST | `/api/login` | — | Login, get JWT token |
| GET | `/api/me` | JWT | Get current user info |
| GET | `/api/check-number/<phone>` | — | Public fraud risk check |
| POST | `/api/complaints` | JWT | Submit complaint (multipart) |
| GET | `/api/complaints/my` | JWT | Get user's complaints |
| GET | `/api/admin/complaints` | Admin | All complaints (paginated) |
| PUT | `/api/admin/complaints/<id>/verdict` | Admin | Set fraud/not_fraud verdict |
| GET | `/api/admin/stats` | Admin | Dashboard statistics |
| GET | `/api/screenshot/<file_id>` | — | Serve screenshot from GridFS |

---

## 🧮 How Fraud Scoring Works

1. **User submits complaint** → weighted by their credibility score (default 1.0)
2. **Admin reviews** → marks as fraud or not_fraud
3. **Credibility updates:**
   - Complaint confirmed as fraud → reporter credibility +0.1
   - Complaint marked not_fraud → reporter credibility -0.2
4. **Risk score** = weighted combination of:
   - Fraud ratio (confirmed / total complaints)
   - Complaint volume
   - Evidence weight (screenshots boost score)

---

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGO_URI` | MongoDB connection string | ✅ |
| `JWT_SECRET` | Secret key for JWT tokens | ✅ |
| `VITE_API_URL` | Backend API URL (frontend) | For deployment |

---

## 📄 License

MIT License — feel free to use and modify.
