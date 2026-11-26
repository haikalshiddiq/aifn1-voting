# Smoke-test hotfix

Copy:
- `tools/apply-smoke-test-hotfix.py` to the repository path with the same name.
- `github-workflow/apply-smoke-test-hotfix.yml` to `.github/workflows/apply-smoke-test-hotfix.yml`.

Run **Actions > Apply smoke-test account hotfix > Run workflow**. The workflow patches and commits the repository. Existing Worker and Pages workflows will then redeploy automatically.

Credentials after deployment:
- NIM: `SMOKE-AIFN1-2026`
- Name: `LIVE SMOKE TEST AIFN1`
