# Changelog

All notable changes to the Lichen Protocol Memory Layer implementation will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

**CORS Hardening & Verification Gates (Phase 1.2)**

- **CORS Configuration Module** (`src/config/cors.ts`):
  - Environment-driven CORS configuration with safe defaults
  - Explicit origin allowlist (no wildcard with credentials)
  - Functions: `parseCorsConfig()`, `isOriginAllowed()`, `getCorsHeaders()`, `getPreflightHeaders()`
  - Production enforcement: throws error if `CORS_ALLOWED_ORIGINS` not set
  - Critical validation: prevents `CORS_ALLOW_CREDENTIALS=true` with wildcard origin

- **CORS Observability Metrics**:
  - `cors_preflight_total` - Counter for preflight (OPTIONS) requests by route and origin_allowed
  - `cors_reject_total` - Counter for rejected CORS requests by route
  - `cors_preflight_duration_ms` - Histogram for preflight processing time (P50, P95, P99)

- **Security Headers Middleware**:
  - `Referrer-Policy: no-referrer` (privacy hardening)
  - `X-Content-Type-Options: nosniff` (MIME sniffing protection)
  - `Permissions-Policy` (disable geolocation, microphone, camera, payment, USB, etc.)

- **CORS Smoke Tests** (`test/cors-smoke.test.ts`):
  - End-to-end validation of CORS configuration
  - Tests valid origin (receives CORS headers)
  - Tests invalid origin (rejected, no CORS headers)
  - Tests preflight OPTIONS requests with cache headers
  - Validates credentials policy (safe configuration)
  - Verifies security headers present
  - Confirms CORS metrics in `/metrics` endpoint

- **CI Policy Gates** (`.github/workflows/policy-gates.yml`):
  - CORS configuration validation with curl tests
  - Tests valid/invalid origin handling
  - Validates preflight OPTIONS responses
  - Confirms security headers (Referrer-Policy, X-Content-Type-Options, Permissions-Policy)
  - Verifies CORS metrics instrumentation

- **Documentation**:
  - Updated `env/SPEC_SANDBOX.md` with comprehensive CORS configuration
  - Updated `docs/specs/environment-setup.md` with CORS variables table
  - Added CORS troubleshooting section

- **Runbooks**:
  - `docs/runbooks/cors-change-checklist.md` - Step-by-step checklist for CORS configuration changes
  - `docs/runbooks/canary-cors.md` - Gradual rollout guide for high-risk CORS changes

### Changed

**Server CORS Implementation** (`src/server.ts`):
- Removed legacy `cors` package dependency
- Replaced with custom CORS middleware using `parseCorsConfig()`
- Added explicit OPTIONS handler for preflight requests
- Preflight cache control via `Access-Control-Max-Age` header (default: 600s)
- CORS rejection logging: `🚫 CORS: Rejected origin="..."`
- Metrics instrumentation for all CORS operations

**Environment Configuration** (`.env.example`):
- Added `CORS_ALLOWED_ORIGINS` (required in production)
- Added `CORS_ALLOW_CREDENTIALS` (default: false)
- Added `CORS_MAX_AGE` (default: 600 seconds)
- Added `CORS_ALLOW_METHODS` (default: GET,POST,PUT,PATCH,DELETE,OPTIONS)
- Added `CORS_ALLOW_HEADERS` (default: Content-Type,Authorization,X-Requested-With,X-API-Version,X-Trace-ID)
- Added `CORS_EXPOSE_HEADERS` (default: X-API-Version,X-Spec-Version)

### Security

- **CORS Hardening**: Explicit origin allowlist prevents CSRF attacks
- **No wildcard with credentials**: Runtime validation prevents insecure configuration
- **Preflight cache**: Reduces OPTIONS requests, improves performance
- **Security headers**: Comprehensive privacy and security hardening
- **Observability**: CORS metrics enable monitoring and alerting
- **CI gates**: Automated validation of CORS configuration on every deploy

---

## [Phase 1.2.1] - 2025-10-16

### Fixed

**CRITICAL: Unified CryptoSigner Usage (Signer Divergence Fix)**
- **Issue**: LedgerSink created its own CryptoSigner instance instead of using the global singleton, causing signatures to use a different key than published in JWKS. This meant external verifiers could NOT verify signatures.
- **Solution**: Introduced `SignerRegistry` as the single source of truth for signing keys
  - All components (LedgerSink, JWKS Manager) now use the same signer instance
  - Ensures ledger signer kid === JWKS active kid

**Implemented RFC 7638 JWK Thumbprint for Stable kid:**
- kid is now derived from SHA-256 hash of canonical JWK representation (RFC 7638)
- Ensures stable, deterministic kid across restarts
- Example kid: `ZbwG6uXwdVXkcyrc2QC0ETqPd_k9KiZmd9U1m6vnnco` (base64url-encoded)

**JWKS Rotation Grace Period:**
- JWKS endpoint now returns both current AND previous keys during 48-hour grace period
- Allows external verifiers to verify signatures during key rotation
- Previous key automatically expires after grace period

### Added

**SignerRegistry** (`src/memory-layer/governance/signer-registry.ts`):
- Process-wide singleton managing CryptoSigner lifecycle
- `getActiveSigner()` - Returns current signer for signing operations
- `getVerificationSigners()` - Returns current + previous (if in grace period) for verification
- `rotateKeys()` - Archives current key as previous, generates new current key
- Tracks rotation timestamp and grace period (48 hours)

**Kid Consistency Monitoring:**
- Health check now verifies ledger signer kid matches JWKS active kid
- Health endpoint fails if kids mismatch (critical alert)
- New metrics:
  - `audit_jwks_mismatch_total` - Counter for kid mismatches (should always be 0)
  - `audit_ledger_signer_kid_info` - Info gauge for ledger signer kid
  - `audit_jwks_active_kid_info` - Info gauge for JWKS active kid

**CI Test for JWKS Verification** (`test/jwks-verification.test.ts`):
- End-to-end test: creates receipt, fetches JWKS, verifies signature using ONLY JWKS
- Ensures LedgerSink and JWKS publish the same key
- Validates JWKS structure (OKP/Ed25519/EdDSA)
- Tests negative case (tampered data correctly rejected)

**Governance Correction Event:**
- Emitted `GOVERNANCE_OVERRIDE` event documenting the signer unification fix
- Immutable audit trail of the correction in ledger
- Script: `scripts/emit-signer-unification-event.ts`

### Changed

**LedgerSink** (`src/memory-layer/storage/ledger-sink.ts`):
- No longer creates own CryptoSigner in constructor
- Gets signer from `SignerRegistry.getActiveSigner()` during initialization
- Added null checks where signer is used

**JWKS Manager** (`src/memory-layer/governance/jwks-manager.ts`):
- Uses `SignerRegistry.getVerificationSigners()` instead of `getCryptoSigner()`
- Returns array of keys (current + previous if in grace)

**CryptoSigner** (`src/memory-layer/governance/crypto-signer.ts`):
- `generateKeys()` now computes RFC 7638 JWK thumbprint for kid
- Added `computeJwkThumbprint()` method for SHA-256 hash of canonical JWK
- Old timestamp-based `generateKeyId()` marked as deprecated

**Server** (`src/server.ts`):
- Imports `SignerRegistry` and kid metrics
- Health endpoint verifies kid consistency and emits metrics

### Security

- **CRITICAL FIX**: External verifiers can now successfully verify signatures using JWKS
- Stable kid prevents confusion during key rotation
- Grace period prevents verification failures during rotation window
- Health check detects kid mismatches immediately
- Comprehensive monitoring via Prometheus metrics

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
