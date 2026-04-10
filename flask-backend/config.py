import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

_BACKEND_ROOT = Path(__file__).resolve().parent


class Config:
    PORT = int(os.getenv("PORT", "8001"))
    DATABASE_URL = os.getenv("DATABASE_URL", "")
    JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")
    JWT_EXP_HOURS = int(os.getenv("JWT_EXP_HOURS", "24"))

    CSV_SELLERS_PATH = os.getenv("CSV_SELLERS_PATH") or str(
        _BACKEND_ROOT / "csvs" / "seller_parties.csv"
    )
    CSV_FEED_CLOSING_PATH = os.getenv("CSV_FEED_CLOSING_PATH") or str(
        _BACKEND_ROOT / "csvs" / "feed_closing_stock.csv"
    )
    CSV_FEED_FORMULATIONS_PATH = os.getenv("CSV_FEED_FORMULATIONS_PATH") or str(
        _BACKEND_ROOT / "csvs" / "feed_formulations.csv"
    )
