# Student activity history

The admin dashboard exposes Login and Save/change vote events through each
student's **Riwayat akses & vote** button. The admin-only endpoint is
`GET /api/admin/students/:nim/history?limit=20&before=<event-id>`.
Results are bounded (maximum 50), newest event ID first, with a nextBefore cursor.

Existing audit_log rows provide historical timestamps. Legacy login/save rows
have no IP/location or full choice snapshot, so the UI explicitly marks those
fields unavailable. Legacy group-method text is shown when recorded. No inferred
historical IP, location, or overwritten choice is generated.

New records contain the edge-provided CF-Connecting-IP and approximate
request.cf city, region, country and timezone when available. No browser GPS or
external geolocation service is used. VPNs, proxies and carrier routing can
affect these values; location is not proof of physical presence or identity.
The client request body cannot set audit metadata.

Each successful vote save appends its own sanitized choice snapshot. Vote
upsert and history append execute in one D1 batch so an audit failure rolls
back the vote mutation. Login events use the existing successful-login audit
path. Failed validation does not create a save event.

The additive idx_audit_actor_id index is applied by the existing idempotent
schema deployment step; no student/vote data is rewritten. History is retained
in audit_log when vote reset actions are used, consistent with the existing
audit trail. Routine page reads are not tracked as student activity.

Only authenticated admins can retrieve these events. Public statistics, the
student vote endpoint, and ordinary CSV exports do not include IP/location.
The voting page informs students that this activity information is recorded.
