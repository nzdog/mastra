# /v1/health Endpoint (Contract)

- Returns JSON with:
  - service: string
  - version: string (git SHA)
  - status: one of [ok, degraded]
  - checks: map { name -> { status, detail } }
- MUST expose degradation flags (e.g., audit_sink, metrics, db, queue)
- MUST run in shadow deployments
