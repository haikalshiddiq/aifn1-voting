# Deployment targets

- API Worker: `aifn-voting-uts`, deployed by GitHub Actions after D1 validation.
- Canonical frontend: https://haikalshiddiq.github.io/aifn1-voting/
- Cloudflare frontend alias: https://aifn1-voting.hicall.workers.dev/

The root Wrangler configuration belongs to the existing **static frontend**
Worker, not the API Worker. It deploys redirects to the canonical frontend.
This prevents the duplicate Cloudflare frontend from serving an unresolved
config.js and using an origin outside the current CORS/Turnstile hostname list.
Admin and asset paths are retained by the wildcard redirect. Redirects use 302
so they can be changed without a permanent browser cache.

The empty `previews` block enables Worker Previews for the static alias.
It has no D1 binding or authentication secret. Preview deployments redirect to
the same canonical site, where the normal production voting rules apply.
No production D1 resource is attached to the branch Preview.

Cloudflare Builds uses its existing root `/` and commands:
`npx wrangler deploy` for main and `npx wrangler preview` for branch builds.
Worker Previews requires Wrangler >= 4.135.0; the observed Builds runtime is
4.168.0. The API workflow continues to use its separately pinned Worker package.

Smoke-account votes are excluded from statistics, CSV exports, and generated
class groups. The admin dashboard retains the smoke account for scoped reset.
Regression coverage uses real in-memory SQLite; it never writes production votes.
