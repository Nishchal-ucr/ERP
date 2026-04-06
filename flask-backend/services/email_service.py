from __future__ import annotations

import smtplib
from email.message import EmailMessage
from pathlib import Path
from typing import List, Optional

from db.connection import get_connection


def _get_active_recipients() -> List[str]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT email FROM email_recipients WHERE active = 1 ORDER BY id"
        ).fetchall()
    return [str(r["email"]).strip() for r in rows if r["email"]]


def _get_smtp_settings() -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT senderEmail, appPassword, smtpHost, smtpPort, useTls
            FROM smtp_settings
            WHERE active = 1
            ORDER BY id
            LIMIT 1
            """
        ).fetchone()
    return dict(row) if row else None


def send_reports_email(report_date: str, attachment_paths: List[str]) -> Optional[str]:
    recipients = _get_active_recipients()
    settings = _get_smtp_settings()

    if not settings:
        return "SMTP settings are not configured."
    if not recipients:
        return "No active email recipients configured."

    sender = settings["senderEmail"]
    password = settings["appPassword"]
    host = settings["smtpHost"]
    port = int(settings["smtpPort"])
    use_tls = int(settings.get("useTls", 1)) == 1

    msg = EmailMessage()
    msg["Subject"] = f"PMR Farms Daily Reports - {report_date}"
    msg["From"] = sender
    msg["To"] = ", ".join(recipients)
    msg.set_content(
        f"Attached are PMR Farms daily reports for {report_date}.\n\nGenerated automatically by ERP system."
    )

    for p in attachment_paths:
        file_path = Path(p)
        if not file_path.exists():
            continue
        data = file_path.read_bytes()
        msg.add_attachment(
            data,
            maintype="application",
            subtype="pdf",
            filename=file_path.name,
        )

    try:
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            if use_tls:
                smtp.starttls()
            smtp.login(sender, password)
            smtp.send_message(msg)
    except Exception as exc:  # pragma: no cover
        return f"Failed to send report email: {exc}"
    return None
