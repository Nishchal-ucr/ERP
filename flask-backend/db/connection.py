import sqlite3
from pathlib import Path

from config import Config


def _db_path() -> Path:
    return Path(__file__).resolve().parents[1] / Config.DATABASE


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn
