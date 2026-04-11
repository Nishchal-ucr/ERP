from db.connection import get_connection


SCHEMA_SQL = [
    """
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('OWNER', 'SUPERVISOR')),
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS parties (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('SUPPLIER', 'CUSTOMER', 'BOTH')),
      phone TEXT,
      address TEXT,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS sheds (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      capacity INTEGER,
      flockNumber TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS shed_flock_metadata (
      id BIGSERIAL PRIMARY KEY,
      shedId BIGINT NOT NULL UNIQUE REFERENCES sheds(id) ON DELETE CASCADE,
      flockNumber TEXT NOT NULL,
      birthDate TEXT NOT NULL,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS feed_items (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('INGREDIENT', 'MEDICINE')),
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS feed_formulations (
      id BIGSERIAL PRIMARY KEY,
      shedId BIGINT NOT NULL REFERENCES sheds(id) ON DELETE CASCADE,
      feedItemId BIGINT NOT NULL REFERENCES feed_items(id),
      ratioPer1000Kg REAL NOT NULL DEFAULT 0,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(shedId, feedItemId)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS feed_item_daily_stock (
      id BIGSERIAL PRIMARY KEY,
      reportDate INTEGER NOT NULL,
      feedItemId BIGINT NOT NULL REFERENCES feed_items(id),
      openingKg REAL NOT NULL DEFAULT 0,
      receiptsKg REAL NOT NULL DEFAULT 0,
      usedKg REAL NOT NULL DEFAULT 0,
      closingKg REAL NOT NULL DEFAULT 0,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(reportDate, feedItemId)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS production_standards (
      id BIGSERIAL PRIMARY KEY,
      week INTEGER NOT NULL UNIQUE,
      standardProductionPct REAL NOT NULL DEFAULT 0,
      standardFeedConsumption REAL NOT NULL DEFAULT 0,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS email_recipients (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS smtp_settings (
      id BIGSERIAL PRIMARY KEY,
      senderEmail TEXT NOT NULL,
      appPassword TEXT NOT NULL,
      smtpHost TEXT NOT NULL DEFAULT 'smtp.gmail.com',
      smtpPort INTEGER NOT NULL DEFAULT 587,
      useTls INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS daily_reports (
      id BIGSERIAL PRIMARY KEY,
      reportDate INTEGER NOT NULL UNIQUE,
      createdByUserId BIGINT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'SUBMITTED', 'LOCKED')),
      submittedAt TIMESTAMPTZ,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS sales (
      id BIGSERIAL PRIMARY KEY,
      dailyReportId BIGINT NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
      partyId BIGINT NOT NULL REFERENCES parties(id),
      vehicleNumber TEXT,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS sale_items (
      id BIGSERIAL PRIMARY KEY,
      saleId BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      shedId BIGINT NOT NULL REFERENCES sheds(id),
      standardEggs INTEGER NOT NULL DEFAULT 0,
      smallEggs INTEGER NOT NULL DEFAULT 0,
      bigEggs INTEGER NOT NULL DEFAULT 0,
      loadingDamage INTEGER NOT NULL DEFAULT 0,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS feed_receipts (
      id BIGSERIAL PRIMARY KEY,
      dailyReportId BIGINT NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
      partyId BIGINT NOT NULL REFERENCES parties(id),
      feedItemId BIGINT NOT NULL REFERENCES feed_items(id),
      vehicleNumber TEXT,
      quantityKg REAL NOT NULL,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS shed_daily_reports (
      id BIGSERIAL PRIMARY KEY,
      dailyReportId BIGINT NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
      shedId BIGINT NOT NULL REFERENCES sheds(id),
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
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(dailyReportId, shedId)
    )
    """,
]


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    row = conn.execute(
        """
        SELECT 1 FROM information_schema.columns
        WHERE table_name = %s AND column_name = %s
        LIMIT 1
        """,
        (table_name, column_name.lower()),
    ).fetchone()
    return row is not None


def _ensure_shed_daily_reports_columns(conn) -> None:
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
        if not _column_exists(conn, "shed_daily_reports", column):
            conn.execute(
                f"ALTER TABLE shed_daily_reports ADD COLUMN {column} {col_type}"
            )


def _ensure_sale_items_columns(conn) -> None:
    required = {
        "bigEggs": "INTEGER NOT NULL DEFAULT 0",
        "loadingDamage": "INTEGER NOT NULL DEFAULT 0",
    }
    for column, col_type in required.items():
        if not _column_exists(conn, "sale_items", column):
            conn.execute(
                f"ALTER TABLE sale_items ADD COLUMN {column} {col_type}"
            )


def _ensure_feed_formulation_columns(conn) -> None:
    required = {
        "ratioPer1000Kg": "REAL NOT NULL DEFAULT 0",
    }
    for column, col_type in required.items():
        if not _column_exists(conn, "feed_formulations", column):
            conn.execute(
                f"ALTER TABLE feed_formulations ADD COLUMN {column} {col_type}"
            )


def _ensure_production_standards_columns(conn) -> None:
    required = {
        "week": "INTEGER NOT NULL DEFAULT 0",
        "standardProductionPct": "REAL NOT NULL DEFAULT 0",
        "standardFeedConsumption": "REAL NOT NULL DEFAULT 0",
    }
    for column, col_type in required.items():
        if not _column_exists(conn, "production_standards", column):
            conn.execute(
                f"ALTER TABLE production_standards ADD COLUMN {column} {col_type}"
            )
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_production_standards_week ON production_standards(week)"
    )


def _ensure_parties_columns(conn) -> None:
    required = {
        "active": "INTEGER NOT NULL DEFAULT 1",
        "email": "TEXT",
    }
    for column, col_type in required.items():
        if not _column_exists(conn, "parties", column):
            conn.execute(f"ALTER TABLE parties ADD COLUMN {column} {col_type}")


def _ensure_feed_item_daily_stock_columns(conn) -> None:
    required = {
        "manualClosingKg": "REAL",
    }
    for column, col_type in required.items():
        if not _column_exists(conn, "feed_item_daily_stock", column):
            conn.execute(
                f"ALTER TABLE feed_item_daily_stock ADD COLUMN {column} {col_type}"
            )


def initialize_schema() -> None:
    with get_connection() as conn:
        for stmt in SCHEMA_SQL:
            conn.execute(stmt)
        _ensure_sale_items_columns(conn)
        _ensure_shed_daily_reports_columns(conn)
        _ensure_feed_formulation_columns(conn)
        _ensure_production_standards_columns(conn)
        _ensure_parties_columns(conn)
        _ensure_feed_item_daily_stock_columns(conn)
        conn.commit()
