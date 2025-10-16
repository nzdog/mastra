# Changelog

All notable changes to the Lichen Protocol Memory Layer implementation will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [Phase 1.2] - 2025-10-16

### Added

**Metrics Instrumentation:**
- Prometheus metrics for audit operations using `prom-client`
- `/metrics` endpoint exposing all audit metrics in Prometheus format
- 12 instrumented metrics covering events, performance, security, and operations:
  - `audit_events_total` - Counter for audit events by type/operation
  - `audit_ledger_height` - Gauge for current Merkle tree size
  - `audit_signature_duration_ms` - Histogram for Ed25519 signature timing
  - `audit_merkle_append_duration_ms` - Histogram for Merkle append timing
  - `audit_verification_duration_ms` - Histogram for receipt verification timing
  - `audit_verification_failures_total` - Counter for failed verifications
  - `audit_file_lock_wait_duration_ms` - Histogram for file lock wait time
  - `audit_file_lock_contention_total` - Counter for lock retries
  - `audit_key_age_days` - Gauge for signing key age
  - `audit_jwks_fetch_requests_total` - Counter for JWKS endpoint requests
  - `audit_crash_recovery_temp_files_removed_total` - Counter for crash recovery
  - Node.js default metrics (heap, CPU, event loop)
- Helper functions `measureSync()` and `measureAsync()` for timing operations
- Metrics module at `src/observability/metrics.ts` with dedicated registry

**Schema Validation:**
- Activated Ajv validation for `AuditEvent` and `SignedAuditReceipt`
- JSON Schema validation tests in CI (Phase 1.1)
- Test scaffolds passing with real audit data

**CI Gates:**
- Metrics endpoint health check in `policy-gates.yml`
- Validates `/metrics` returns `audit_events_total` metric
- Schema validation gate (Phase 1.1)
- Canonical JSON verification gate (Phase 1.1)

### Changed

**Audit Emitter:**
- Now increments `audit_events_total` counter on each event emission
- Tracks events by type (HEALTH, STORE, RECALL, etc.) and operation name

**Ledger Sink:**
- Tracks ledger height with `audit_ledger_height` gauge
- Measures Merkle append time with `audit_merkle_append_duration_ms`
- Measures file lock wait time with `audit_file_lock_wait_duration_ms`
- Increments `audit_file_lock_contention_total` on lock retries
- Increments `audit_crash_recovery_temp_files_removed_total` during recovery

**Crypto Signer:**
- Tracks signature duration with `audit_signature_duration_ms` histogram
- Emits key age with `audit_key_age_days` gauge

**Server:**
- Tracks JWKS fetch requests with `audit_jwks_fetch_requests_total`
- Measures verification duration with `audit_verification_duration_ms`
- Increments `audit_verification_failures_total` on failed verifications
- Added `/metrics` endpoint with rate limiting (10 req/min)

**Documentation:**
- Updated `docs/specs/metrics.md` status to IMPLEMENTED
- Added metrics documentation to README.md
- All TODO markers replaced with Phase 1.2 implementation comments

### Fixed

- N/A

### Security

- Comprehensive observability for audit operations
- Performance monitoring for cryptographic operations
- Lock contention tracking for concurrent writes
- Crash recovery monitoring

---

## [Phase 1.1] - 2025-10-16

### Phase 1.1 — Governance & Audit Hardening (Ops, CI, Perf)

#### Added

**CI & Validation:**
- JSON Schema validation for `AuditEvent` and `SignedAuditReceipt` structures
- RFC-8785 canonical JSON test suite for deterministic serialization
- CI gates for schema validation and canonical JSON compliance in `.github/workflows/policy-gates.yml`
- PII detection gate to prevent personal information leakage in audit logs
- Test scaffolds for schema validation (`test/schema-validation.ts`) and canonical JSON (`test/canonical-json.test.ts`)

**Documentation:**
- Key rotation runbook at `docs/runbooks/key-rotation.md` with procedures for:
  - Routine rotation (≤90 days)
  - Emergency rotation (breach response < 4 hours)
  - JWKS rollover and grace periods
  - Verification and rollback procedures
- Metrics specification at `docs/specs/metrics.md` defining:
  - Audit event metrics (counters, gauges, histograms)
  - Performance metrics (signature time, Merkle append time, lock contention)
  - Security metrics (verification failures, key age)
  - Operational metrics (crash recovery, file lock wait time)
- GitHub issue template for Phase 1.1 hardening checklist

**Code Instrumentation:**
- TODO markers for metrics instrumentation at key points:
  - `src/memory-layer/governance/audit-emitter.ts` - Event emission counters
  - `src/memory-layer/storage/ledger-sink.ts` - Ledger height gauge, Merkle append time, file lock metrics, crash recovery counters
  - `src/memory-layer/governance/crypto-signer.ts` - Signature time histogram, key age gauge
  - `src/server.ts` - Verification metrics, JWKS fetch counters

**Schemas:**
- `src/memory-layer/schemas/audit-event.schema.json` - JSON Schema for audit events
- `src/memory-layer/schemas/audit-receipt.schema.json` - JSON Schema for signed audit receipts

#### Changed

- CI workflow now includes Phase 1.1 hardening gates (schema validation, canonical JSON, PII detection)
- Updated `package.json` with new test scripts:
  - `test:schema-validation` - Validate audit events/receipts against JSON Schema
  - `test:canonical-json` - Test RFC-8785 canonical JSON determinism

#### Fixed

- N/A

#### Security

- Enhanced audit trail with schema-validated event structures
- Deterministic signature verification using canonical JSON (RFC-8785)
- Documented key rotation procedures including emergency breach response
- PII detection gates to prevent accidental personal data logging

---

## [Phase 1.0] - 2025-10-16

### Added

**Cryptographic Foundation:**
- Ed25519 digital signatures for audit receipts (`src/memory-layer/governance/crypto-signer.ts`)
- Merkle tree implementation for tamper-evident audit chain (`src/memory-layer/governance/merkle-tree.ts`)
- JWKS (JSON Web Key Set) manager for public key distribution (`src/memory-layer/governance/jwks-manager.ts`)
- Canonical JSON serialization utility (RFC-8785) (`src/memory-layer/utils/canonical-json.ts`)

**Audit System:**
- Audit emitter with support for multiple event types: STORE, RECALL, DISTILL, FORGET, EXPORT, HEALTH, CONSENT_GRANT, CONSENT_REVOKE, AMBIGUITY_EVENT, GOVERNANCE_OVERRIDE, ETHICAL_DEVIATION
- Persistent ledger sink with file-based storage (`.ledger/` directory)
- Atomic writes with `fsync` for crash recovery resilience
- File locking (`proper-lockfile`) for concurrent write protection
- Automatic crash recovery (removes incomplete `.tmp` files on startup)

**Verification API (Phase 1.1):**
- `GET /v1/ledger/root` - Get current Merkle root and ledger height
- `GET /v1/receipts/:id` - Retrieve and verify specific audit receipt
- `POST /v1/receipts/verify` - Verify receipt Merkle proof and signature
- `GET /v1/keys/jwks` - Public key distribution for external verifiers
- `GET /v1/ledger/integrity` - Verify complete Merkle chain integrity

**Health & Monitoring:**
- Spec-compliant `/v1/health` endpoint with audit system metrics
- Ledger height tracking
- Merkle chain integrity verification
- Key rotation status monitoring

### Changed

- Health check now includes audit ledger metrics (height, last receipt timestamp)
- Health check performs incremental Merkle chain verification

### Security

- Tamper-evident audit logging with cryptographic signatures
- Merkle proof verification for all audit events
- Key rotation support (90-day recommended cadence)
- Atomic writes prevent data corruption from crashes
- File locking prevents race conditions in multi-process environments

---

## [Phase 0] - 2025-10-15

### Added

**Foundational Infrastructure:**
- Long-lived feature branch `feature/memory-layer-spec` with branch protection
- ADR 0001: Memory Layer Architecture Decision Record
- Specification index at `docs/specs/README.md` tracking all phases (0-5)
- Audit emitter stub at `src/memory-layer/governance/audit-emitter.ts`
- Health endpoint contract at `src/memory-layer/api/health.ts`

**CI/CD:**
- Policy gates workflow (`.github/workflows/policy-gates.yml`) enforcing:
  - ADR completeness validation
  - Spec index tracking
  - Audit emitter stub validation
  - TypeScript build and lint gates
  - Security checks (no hardcoded secrets)
  - Branch protection verification
- Compliance report generation as CI artifact

### Documentation

- Phase 0 Specification outlining 6-phase implementation roadmap
- Phase 1.1 Implementation Plan detailing cryptographic upgrade path

---

## Versioning Notes

- **Phase 0**: Foundations and scaffolding
- **Phase 1.0**: Cryptographic audit system (Ed25519 + Merkle + JWKS)
- **Phase 1.1**: Operational hardening (CI gates, key rotation, metrics)
- **Phase 2**: (Planned) Differential privacy and consent management
- **Phase 3**: (Planned) Federated learning integration
- **Phase 4**: (Planned) Constitutional governance
- **Phase 5**: (Planned) Public auditing and transparency reports

---

**Invariant:** Memory enriches but never controls.
