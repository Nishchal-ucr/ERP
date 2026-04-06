import bcrypt

from db.connection import get_connection


def _count(conn, table_name: str) -> int:
    row = conn.execute(f"SELECT COUNT(*) AS c FROM {table_name}").fetchone()
    return int(row["c"])


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode(
        "utf-8"
    )


def seed_data() -> None:
    with get_connection() as conn:
        _seed_users(conn)
        _seed_parties(conn)
        _seed_feed_items(conn)
        _seed_sheds(conn)
        _seed_shed_flock_metadata(conn)
        _seed_email_recipients(conn)
        _seed_smtp_settings(conn)
        conn.commit()


def _seed_users(conn):
    if _count(conn, "users") > 0:
        return

    users = [
        ("Supervisor One", "9876543210", "22446688", "SUPERVISOR"),
        ("Supervisor Two", "9876543211", "22446688", "SUPERVISOR"),
        ("Supervisor Three", "9876543212", "22446688", "SUPERVISOR"),
    ]

    for name, phone, password, role in users:
        existing = conn.execute("SELECT id FROM users WHERE phone = ?", (phone,)).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO users (name, phone, passwordHash, role) VALUES (?, ?, ?, ?)",
                (name, phone, _hash_password(password), role),
            )


def _seed_parties(conn):
    if _count(conn, "parties") > 0:
        return

    parties = [
        ("Prime Feed Suppliers", "SUPPLIER", "03111234567", "Malkajgiri, Hyderabad"),
        ("Quality Feed Exports", "SUPPLIER", "03112345678", "Uppal, Hyderabad"),
        ("Livestock Distributors", "BOTH", "03113456789", "Shamshabad, Hyderabad"),
        ("Poultry Trading Hub", "BOTH", "03114567890", "Manasanpalle, Hyderabad"),
        ("Bulk Commodities Ltd", "SUPPLIER", "03115678901", "Choutuppal, Telangana"),
    ]

    for name, kind, phone, address in parties:
        existing = conn.execute("SELECT id FROM parties WHERE name = ?", (name,)).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO parties (name, type, phone, address) VALUES (?, ?, ?, ?)",
                (name, kind, phone, address),
            )


def _seed_feed_items(conn):
    if _count(conn, "feed_items") > 0:
        return

    items = [
        ("Maize", "INGREDIENT"),
        ("Broken Rice", "INGREDIENT"),
        ("PARAM", "INGREDIENT"),
        ("Soya", "INGREDIENT"),
        ("DDGS", "INGREDIENT"),
        ("DORB", "INGREDIENT"),
        ("MDOC", "INGREDIENT"),
        ("DOGN", "INGREDIENT"),
        ("Soya Oil", "INGREDIENT"),
        ("Rice bran", "INGREDIENT"),
        ("MBM", "INGREDIENT"),
        ("Calcite", "INGREDIENT"),
        ("Stone", "INGREDIENT"),
        ("MCP", "MEDICINE"),
        ("Methionine", "MEDICINE"),
        ("Lysine", "MEDICINE"),
        ("Threonine", "MEDICINE"),
        ("Salt", "MEDICINE"),
        ("Sodium_Bicarbonate", "MEDICINE"),
        ("Probiotic", "MEDICINE"),
        ("Vitamin Premix", "MEDICINE"),
        ("Trace Minerals (TM)", "MEDICINE"),
        ("Liver Tonic", "MEDICINE"),
        ("Toxin Binder", "MEDICINE"),
        ("Choline chloride", "MEDICINE"),
        ("Acidifire", "MEDICINE"),
        ("Enzymes", "MEDICINE"),
        ("Phytase", "MEDICINE"),
        ("Antibiotic", "MEDICINE"),
        ("Betaine", "MEDICINE"),
    ]

    for name, category in items:
        existing = conn.execute(
            "SELECT id FROM feed_items WHERE name = ?",
            (name,),
        ).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO feed_items (name, category) VALUES (?, ?)",
                (name, category),
            )


def _seed_sheds(conn):
    if _count(conn, "sheds") > 0:
        return

    sheds = [
        ("Shed 1", 43000, "FK10092024", 1),
        ("Shed 2", 43000, "FK02022024", 1),
        ("Shed 3", 43000, "FK04212024", 1),
        ("Shed 4", 43000, "FK04162023", 1),
        ("Shed 5", 43000, "FK04162023", 1),
        ("Grower 1", 50000, "FK04262025", 1),
    ]

    for name, capacity, flock, active in sheds:
        existing = conn.execute("SELECT id FROM sheds WHERE name = ?", (name,)).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO sheds (name, capacity, flockNumber, active) VALUES (?, ?, ?, ?)",
                (name, capacity, flock, active),
            )


def _seed_shed_flock_metadata(conn):
    sheds = conn.execute("SELECT id, flockNumber FROM sheds ORDER BY id").fetchall()
    if not sheds:
        return

    # Temporary seeded dates until flock lifecycle integration is available.
    seeded_birth_dates = {
        1: "2024-09-10",
        2: "2024-02-02",
        3: "2024-04-21",
        4: "2023-04-16",
        5: "2023-04-16",
        6: "2025-04-26",
    }

    for shed in sheds:
        shed_id = int(shed["id"])
        flock_number = shed["flockNumber"] or f"TEMP-FLOCK-{shed_id}"
        birth_date = seeded_birth_dates.get(shed_id, "2024-01-01")
        existing = conn.execute(
            "SELECT id FROM shed_flock_metadata WHERE shedId = ?",
            (shed_id,),
        ).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE shed_flock_metadata
                SET flockNumber = ?, birthDate = ?, updatedAt = CURRENT_TIMESTAMP
                WHERE shedId = ?
                """,
                (flock_number, birth_date, shed_id),
            )
        else:
            conn.execute(
                """
                INSERT INTO shed_flock_metadata (shedId, flockNumber, birthDate)
                VALUES (?, ?, ?)
                """,
                (shed_id, flock_number, birth_date),
            )


def _seed_email_recipients(conn):
    recipients = [
        "nishchalparne@gmail.com",
        "reddydushyanth29@gmail.com",
        "shivashashank001@gmail.com",
    ]
    for email in recipients:
        existing = conn.execute(
            "SELECT id FROM email_recipients WHERE email = ?",
            (email,),
        ).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO email_recipients (email, active) VALUES (?, 1)",
                (email,),
            )


def _seed_smtp_settings(conn):
    existing = conn.execute(
        "SELECT id FROM smtp_settings WHERE active = 1 ORDER BY id LIMIT 1"
    ).fetchone()
    if existing:
        return
    conn.execute(
        """
        INSERT INTO smtp_settings (
          senderEmail, appPassword, smtpHost, smtpPort, useTls, active
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            "nishchalparne@gmail.com",
            "lczo nwst nxxn wndz",
            "smtp.gmail.com",
            587,
            1,
            1,
        ),
    )
