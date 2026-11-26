"""One roster contract for local QA and the remote D1 deployment gate."""
import argparse
import json
from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
COUNT_QUERY = """
SELECT COUNT(*) AS total,
       COUNT(CASE WHEN nim NOT LIKE 'SMOKE-%' THEN 1 END) AS class_students,
       COUNT(CASE WHEN nim = 'SMOKE-AIFN1-2026' THEN 1 END) AS smoke_accounts,
       COUNT(CASE WHEN nim LIKE 'SMOKE-%' AND nim <> 'SMOKE-AIFN1-2026'
                  THEN 1 END) AS unexpected_smoke,
       COUNT(CASE WHEN active <> 1 THEN 1 END) AS inactive
FROM students
""".strip()
EXPECTED = {
    "total": 38, "class_students": 37, "smoke_accounts": 1,
    "unexpected_smoke": 0, "inactive": 0,
}


def validate_counts(row):
    try:
        actual = {key: int(row[key]) for key in EXPECTED}
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Incomplete or invalid roster count result") from exc
    if actual != EXPECTED:
        raise ValueError("Roster mismatch: expected %s; got %s" % (EXPECTED, actual))
    print("PASS ROSTER: 37 active students + 1 reserved smoke account = 38 rows")
    return actual


def wrangler_counts(data):
    statements = data if isinstance(data, list) else [data]
    if len(statements) != 1 or not isinstance(statements[0], dict):
        raise ValueError("Expected one D1 statement result")
    result = statements[0]
    if result.get("success") is False:
        raise ValueError("D1 count query failed")
    rows = result.get("results")
    if not isinstance(rows, list) or len(rows) != 1:
        raise ValueError("Expected one D1 roster count row")
    return rows[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--query", action="store_true")
    mode.add_argument("--wrangler-json", type=Path)
    args = parser.parse_args()
    if args.query:
        print(COUNT_QUERY)
        return
    if args.wrangler_json:
        validate_counts(wrangler_counts(json.loads(args.wrangler_json.read_text(encoding="utf-8"))))
    else:
        with sqlite3.connect(":memory:") as db:
            db.row_factory = sqlite3.Row
            db.executescript((ROOT / "database/schema.sql").read_text(encoding="utf-8"))
            db.executescript((ROOT / "database/seed_students.sql").read_text(encoding="utf-8"))
            validate_counts(dict(db.execute(COUNT_QUERY).fetchone()))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, sqlite3.Error) as exc:
        sys.exit("FAIL ROSTER: %s" % exc)
