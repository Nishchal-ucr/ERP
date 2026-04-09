import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    PORT = int(os.getenv("PORT", "8001"))
    DATABASE_URL = os.getenv("DATABASE_URL", "")
    JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")
    JWT_EXP_HOURS = int(os.getenv("JWT_EXP_HOURS", "24"))
