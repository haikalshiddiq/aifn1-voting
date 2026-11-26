# Assessment: Worker deployment #7

Baseline: `6c00ef065de8676942697870e722f183169b6459`.
Failed run: https://github.com/haikalshiddiq/aifn1-voting/actions/runs/45885851870

## Root cause

The smoke-account hotfix added `SMOKE-AIFN1-2026` to the seed. The resulting
roster contains 37 class students and one reserved smoke account (38 rows).
Three gates still required 37 total rows:

- `tests/verify.py`: in-memory SQLite assertion; this is the first failure.
- `tests/predeploy-check.sh`: counts SQL lines and would fail next.
- `.github/workflows/deploy-worker.yml`: remote D1 total-row assertion would
  fail after migration even if the first two gates were bypassed.

The failed run never reached Apply D1 schema, seed, or Worker deployment.
This traceback does not establish a Turnstile, API token, or remote D1 failure.

## Changes

All three gates now share `tests/student_counts.py`: require 37 active class
students, exactly one reserved smoke account, 38 total rows, zero unexpected
smoke accounts, and zero inactive rows. Shell checks execute the SQL rather
than counting its formatting. The remote check uses the same SQL and validator.

The deployment seed now uses `INSERT ... ON CONFLICT(nim) DO UPDATE`.
Previously `INSERT OR REPLACE` deleted and recreated existing student rows.
With the schema's `votes.nim -> students.nim ON DELETE CASCADE`, reseeding could
delete existing votes. UPSERT updates name/active while retaining student
identity, timestamps, and dependent votes.

Regression tests cover the valid roster, invalid/missing/extra/inactive rows,
Wrangler JSON shapes, and repeated schema+seed application with existing class
and smoke votes, sessions, timestamps, and a closed voting setting.

The annotation warning identifies `actions/setup-node@v4`'s deprecated Node 20
action runtime. Workflows and the workflow copy now use setup-node v6 and
Node.js 22 for build/test commands.

## Validation and deployment

Run `bash tests/predeploy-check.sh` and `cd worker && npm run test:http`.
The QA workflow runs both on a pull request without production secrets.
A PR does not deploy or migrate production. After QA passes, merge into main
to run the existing production deployment workflow against the fixed source.
Re-running failed run #7 alone still uses its old commit and cannot apply this fix.

Existing Cloudflare/GitHub secrets and Turnstile settings are reused.
Do not reset D1 or delete voting data to resolve this assertion.

## Assessment boundaries

The repository's frontend workflow currently publishes to **GitHub Pages**,
while its Worker and D1 run on Cloudflare. It is not a Cloudflare Pages
deployment. Keep ALLOWED_ORIGINS and EXPECTED_TURNSTILE_HOSTNAMES aligned with
the hostname actually serving the frontend.

CI tests use a local Turnstile bypass. They do not prove that a production
browser challenge works. After deployment, verify a real challenge using the
reserved smoke account, then use the scoped admin smoke reset.

The existing smoke-account hotfix excludes smoke votes from summary counts and
theme/method totals. The current export and group-generation routes still include
smoke votes; reset the smoke vote before using those outputs, or handle their
filtering as a separate follow-up.
