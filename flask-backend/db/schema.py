from db.connection import get_connection


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('OWNER', 'SUPERVISOR')),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('SUPPLIER', 'CUSTOMER', 'BOTH')),
  phone TEXT,
  address TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sheds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  capacity INTEGER,
  flockNumber TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shed_flock_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shedId INTEGER NOT NULL UNIQUE,
  flockNumber TEXT NOT NULL,
  birthDate TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(shedId) REFERENCES sheds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feed_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('INGREDIENT', 'MEDICINE')),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feed_formulations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shedId INTEGER NOT NULL,
  feedItemId INTEGER NOT NULL,
  ratioPer1000Kg REAL NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(shedId, feedItemId),
  FOREIGN KEY(shedId) REFERENCES sheds(id) ON DELETE CASCADE,
  FOREIGN KEY(feedItemId) REFERENCES feed_items(id)
);

CREATE TABLE IF NOT EXISTS feed_item_daily_stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reportDate INTEGER NOT NULL,
  feedItemId INTEGER NOT NULL,
  openingKg REAL NOT NULL DEFAULT 0,
  receiptsKg REAL NOT NULL DEFAULT 0,
  usedKg REAL NOT NULL DEFAULT 0,
  closingKg REAL NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(reportDate, feedItemId),
  FOREIGN KEY(feedItemId) REFERENCES feed_items(id)
);

CREATE TABLE IF NOT EXISTS production_standards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week INTEGER NOT NULL UNIQUE,
  standardProductionPct REAL NOT NULL DEFAULT 0,
  standardFeedConsumption REAL NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS smtp_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  senderEmail TEXT NOT NULL,
  appPassword TEXT NOT NULL,
  smtpHost TEXT NOT NULL DEFAULT 'smtp.gmail.com',
  smtpPort INTEGER NOT NULL DEFAULT 587,
  useTls INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reportDate INTEGER NOT NULL UNIQUE,
  createdByUserId INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'SUBMITTED', 'LOCKED')),
  submittedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(createdByUserId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dailyReportId INTEGER NOT NULL,
  partyId INTEGER NOT NULL,
  vehicleNumber TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(dailyReportId) REFERENCES daily_reports(id) ON DELETE CASCADE,
  FOREIGN KEY(partyId) REFERENCES parties(id)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  saleId INTEGER NOT NULL,
  shedId INTEGER NOT NULL,
  standardEggs INTEGER NOT NULL DEFAULT 0,
  smallEggs INTEGER NOT NULL DEFAULT 0,
  bigEggs INTEGER NOT NULL DEFAULT 0,
  loadingDamage INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(saleId) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY(shedId) REFERENCES sheds(id)
);

CREATE TABLE IF NOT EXISTS feed_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dailyReportId INTEGER NOT NULL,
  partyId INTEGER NOT NULL,
  feedItemId INTEGER NOT NULL,
  vehicleNumber TEXT,
  quantityKg REAL NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(dailyReportId) REFERENCES daily_reports(id) ON DELETE CASCADE,
  FOREIGN KEY(partyId) REFERENCES parties(id),
  FOREIGN KEY(feedItemId) REFERENCES feed_items(id)
);

CREATE TABLE IF NOT EXISTS shed_daily_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dailyReportId INTEGER NOT NULL,
  shedId INTEGER NOT NULL,
  openingBirds INTEGER,
  birdsMortality INTEGER,
  closingBirds INTEGER,
  openingEggs INTEGER,
  damagedEggs INTEGER,
  standardEggsClosing INTEGER,
  smallEggsClosing INTEGER,
  bigEggsClosing INTEGER,
  feedOpening REAL,
  feedIssued REAL,
  feedClosing REAL,
  feedConsumed REAL,
  totalEggsClosing INTEGER,
  eggsProduced REAL,
  totalFeedReceipt REAL,
  closingFeed REAL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(dailyReportId, shedId),
  FOREIGN KEY(dailyReportId) REFERENCES daily_reports(id) ON DELETE CASCADE,
  FOREIGN KEY(shedId) REFERENCES sheds(id)
);
"""


def _ensure_shed_daily_reports_columns(conn) -> None:
  existing = {
      row["name"]
      for row in conn.execute("PRAGMA table_info(shed_daily_reports)").fetchall()
  }
  required = {
      "openingBirds": "INTEGER",
      "bigEggsClosing": "INTEGER",
      "openingEggs": "INTEGER",
      "feedOpening": "REAL",
      "feedIssued": "REAL",
      "feedClosing": "REAL",
      "feedConsumed": "REAL",
      "totalEggsClosing": "INTEGER",
      "eggsProduced": "REAL",
  }

  for column, col_type in required.items():
      if column not in existing:
          conn.execute(
              f"ALTER TABLE shed_daily_reports ADD COLUMN {column} {col_type}"
          )


def _ensure_sale_items_columns(conn) -> None:
  existing = {
      row["name"] for row in conn.execute("PRAGMA table_info(sale_items)").fetchall()
  }
  required = {
      "bigEggs": "INTEGER NOT NULL DEFAULT 0",
      "loadingDamage": "INTEGER NOT NULL DEFAULT 0",
  }
  for column, col_type in required.items():
      if column not in existing:
          conn.execute(f"ALTER TABLE sale_items ADD COLUMN {column} {col_type}")


def _ensure_feed_formulation_columns(conn) -> None:
  existing = {
      row["name"] for row in conn.execute("PRAGMA table_info(feed_formulations)").fetchall()
  }
  required = {
      "ratioPer1000Kg": "REAL NOT NULL DEFAULT 0",
  }
  for column, col_type in required.items():
      if column not in existing:
          conn.execute(f"ALTER TABLE feed_formulations ADD COLUMN {column} {col_type}")


def _ensure_production_standards_columns(conn) -> None:
  existing = {
      row["name"]
      for row in conn.execute("PRAGMA table_info(production_standards)").fetchall()
  }
  required = {
      "week": "INTEGER NOT NULL DEFAULT 0",
      "standardProductionPct": "REAL NOT NULL DEFAULT 0",
      "standardFeedConsumption": "REAL NOT NULL DEFAULT 0",
  }
  for column, col_type in required.items():
      if column not in existing:
          conn.execute(
              f"ALTER TABLE production_standards ADD COLUMN {column} {col_type}"
          )
  conn.execute(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_production_standards_week ON production_standards(week)"
  )


def initialize_schema() -> None:
    with get_connection() as conn:
        conn.executescript(SCHEMA_SQL)
        _ensure_sale_items_columns(conn)
        _ensure_shed_daily_reports_columns(conn)
        _ensure_feed_formulation_columns(conn)
        _ensure_production_standards_columns(conn)
        conn.commit()
