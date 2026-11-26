"""Regression tests for the real SQLite seed and D1 count validation."""
import contextlib
import io
from pathlib import Path
import sqlite3
import unittest

from student_counts import COUNT_QUERY, EXPECTED, validate_counts, wrangler_counts

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = (ROOT / "database/schema.sql").read_text(encoding="utf-8")
SEED = (ROOT / "database/seed_students.sql").read_text(encoding="utf-8")


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        self.db.executescript(SEED)
        self.addCleanup(self.db.close)

    def counts(self):
        return dict(self.db.execute(COUNT_QUERY).fetchone())

    def test_roster_is_37_students_and_one_smoke_account(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(validate_counts(self.counts()), EXPECTED)

    def test_bad_rosters_fail_closed(self):
        changes = [
            "DELETE FROM students WHERE nim='25110200041'",
            "DELETE FROM students WHERE nim='SMOKE-AIFN1-2026'",
            "INSERT INTO students(nim,name) VALUES('999','Unexpected student')",
            "INSERT INTO students(nim,name) VALUES('SMOKE-OTHER','Unexpected smoke')",
            "UPDATE students SET active=0 WHERE nim='25110200041'",
            "UPDATE students SET active=0 WHERE nim='SMOKE-AIFN1-2026'",
        ]
        for sql in changes:
            with self.subTest(sql=sql):
                self.db.execute("SAVEPOINT invalid_roster")
                self.db.execute(sql)
                with self.assertRaises(ValueError):
                    validate_counts(self.counts())
                self.db.execute("ROLLBACK TO invalid_roster")
                self.db.execute("RELEASE invalid_roster")

    def test_reseed_preserves_votes_sessions_metadata_and_settings(self):
        self.assertEqual(self.db.execute("PRAGMA foreign_keys").fetchone()[0], 1)
        nims = ["25110200041", "SMOKE-AIFN1-2026"]
        for nim in nims:
            self.db.execute(
                "INSERT INTO votes(nim,group_method,theme_rank_1,theme_rank_2,"
                "theme_rank_3,theme_rank_4,theme_rank_5,reason) VALUES(?,?,?,?,?,?,?,?)",
                (nim, "method", "a", "b", "c", "d", "e", "keep this vote"),
            )
            self.db.execute(
                "INSERT INTO sessions(token_hash,nim,expires_at) VALUES(?,?,?)",
                (nim, nim, "2099-01-01T00:00:00Z"),
            )
            self.db.execute(
                "UPDATE students SET name='old name',created_at='2020-01-01' WHERE nim=?",
                (nim,),
            )
        self.db.execute("UPDATE settings SET setting_value='closed' WHERE setting_key='voting_status'")
        before = [tuple(row) for row in self.db.execute("SELECT * FROM votes ORDER BY nim")]
        sessions = [tuple(row) for row in self.db.execute("SELECT * FROM sessions ORDER BY nim")]
        # Exercise the actual deployment sequence twice, including schema defaults.
        for _ in range(2):
            self.db.executescript(SCHEMA)
            self.db.executescript(SEED)
            self.assertEqual([tuple(row) for row in self.db.execute("SELECT * FROM votes ORDER BY nim")], before)
            self.assertEqual([tuple(row) for row in self.db.execute("SELECT * FROM sessions ORDER BY nim")], sessions)
            self.assertEqual(self.counts(), EXPECTED)
        for nim in nims:
            student = self.db.execute("SELECT * FROM students WHERE nim=?", (nim,)).fetchone()
            self.assertNotEqual(student["name"], "old name")
            self.assertEqual(student["created_at"], "2020-01-01")
        self.assertEqual(self.db.execute(
            "SELECT setting_value FROM settings WHERE setting_key='voting_status'"
        ).fetchone()[0], "closed")

    def test_remote_output_supports_wrangler_list_and_object(self):
        row = self.counts()
        for report in [[{"success": True, "results": [row]}], {"results": [row]}]:
            self.assertEqual(wrangler_counts(report), row)

    def test_remote_output_rejects_failures_and_missing_counts(self):
        for report in [[], {}, {"success": False, "results": [EXPECTED]},
                       [{"results": []}], [{"results": [EXPECTED, EXPECTED]}]]:
            with self.subTest(report=report), self.assertRaises(ValueError):
                wrangler_counts(report)
        for row in [{}, {**EXPECTED, "total": "invalid"}, {**EXPECTED, "total": 37}]:
            with self.subTest(row=row), self.assertRaises(ValueError):
                validate_counts(row)


if __name__ == "__main__":
    unittest.main(verbosity=2)
