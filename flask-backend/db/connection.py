from __future__ import annotations

from typing import Any, Callable, Sequence

import psycopg

from config import Config

# Maps lowercase Postgres column names back to the camelCase keys
# expected by application code and API responses.
_CAMELCASE_MAP: dict[str, str] = {
    "passwordhash": "passwordHash",
    "createdat": "createdAt",
    "updatedat": "updatedAt",
    "flocknumber": "flockNumber",
    "birthdate": "birthDate",
    "shedid": "shedId",
    "feeditemid": "feedItemId",
    "ratioper1000kg": "ratioPer1000Kg",
    "reportdate": "reportDate",
    "openingkg": "openingKg",
    "receiptskg": "receiptsKg",
    "usedkg": "usedKg",
    "closingkg": "closingKg",
    "standardproductionpct": "standardProductionPct",
    "standardfeedconsumption": "standardFeedConsumption",
    "senderemail": "senderEmail",
    "apppassword": "appPassword",
    "smtphost": "smtpHost",
    "smtpport": "smtpPort",
    "usetls": "useTls",
    "createdbyuserid": "createdByUserId",
    "submittedat": "submittedAt",
    "dailyreportid": "dailyReportId",
    "partyid": "partyId",
    "vehiclenumber": "vehicleNumber",
    "saleid": "saleId",
    "standardeggs": "standardEggs",
    "smalleggs": "smallEggs",
    "bigeggs": "bigEggs",
    "loadingdamage": "loadingDamage",
    "quantitykg": "quantityKg",
    "openingbirds": "openingBirds",
    "birdsmortality": "birdsMortality",
    "closingbirds": "closingBirds",
    "openingeggs": "openingEggs",
    "damagedeggs": "damagedEggs",
    "standardeggsclosing": "standardEggsClosing",
    "smalleggsclosing": "smallEggsClosing",
    "bigeggsclosing": "bigEggsClosing",
    "feedopening": "feedOpening",
    "feedissued": "feedIssued",
    "feedclosing": "feedClosing",
    "feedconsumed": "feedConsumed",
    "totaleggsclosing": "totalEggsClosing",
    "eggsproduced": "eggsProduced",
    "totalfeedreceipt": "totalFeedReceipt",
    "closingfeed": "closingFeed",
    "maxdate": "maxDate",
    "maxreportdate": "maxReportDate",
}


def _pg_row_factory(cursor: Any) -> Callable[[Sequence[Any]], dict]:
    """Row factory that returns dicts with camelCase keys matching app conventions."""
    if cursor.description is None:
        return lambda values: {}
    columns = [desc.name for desc in cursor.description]
    mapped = [_CAMELCASE_MAP.get(c, c) for c in columns]

    def make_row(values: Sequence[Any]) -> dict:
        return dict(zip(mapped, values))

    return make_row


def get_connection() -> psycopg.Connection:
    if not Config.DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL is not set. "
            "Export it as an environment variable, e.g. "
            "DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/dbname"
        )
    conn = psycopg.connect(
        Config.DATABASE_URL,
        row_factory=_pg_row_factory,
        autocommit=False,
    )
    return conn
