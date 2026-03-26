# database.py
import os
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING
import gridfs

load_dotenv()

# MongoDB Atlas URI (from .env)
MONGO_URI = os.environ.get("MONGO_URI")
if not MONGO_URI:
    raise ValueError("MONGO_URI not set. Create a .env file with MONGO_URI=your_connection_string")

JWT_SECRET = os.environ.get("JWT_SECRET", "change_me_in_production")

client = MongoClient(MONGO_URI)

# Database and collections
db = client['upi_fraud_db']
users_table = db['users']
complaints_table = db['complaints']
login_history_table = db['login_history']

# GridFS for storing screenshots in MongoDB
fs = gridfs.GridFS(db)

# Create indexes for performance
users_table.create_index([("username", ASCENDING)], unique=True)
users_table.create_index([("email", ASCENDING)], unique=True, sparse=True)
complaints_table.create_index([("phone_number", ASCENDING)])
complaints_table.create_index([("reporter_user_id", ASCENDING)])
complaints_table.create_index([("status", ASCENDING)])
login_history_table.create_index([("user_id", ASCENDING)])

print("Connected to MongoDB Atlas successfully!")
