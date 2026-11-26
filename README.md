# Corrected smoke-test hotfix v2

The first hotfix generated invalid JavaScript because SQL strings containing `'SMOKE-%'` were wrapped in JavaScript single quotes. Version 2 uses JavaScript template literals for those SQL statements.

Replace these two repository files:

1. `tools/apply-smoke-test-hotfix.py`
2. `.github/workflows/apply-smoke-test-hotfix.yml`

Then run **Actions > Apply smoke-test account hotfix v2 > Run workflow**.

After Worker and Pages redeploy:

- NIM: `SMOKE-AIFN1-2026`
- Name: `LIVE SMOKE TEST AIFN1`
