# Phase 1.1 Implementation Plan: Audit Hardening & Verification Endpoints

**Status:** Planning
**Branch:** `feature/memory-layer-phase-3.2`
**GitHub Issue:** #16

## Implementation Summary

Phase 1.1 builds on Phase 1's foundation to add external verifiability, operational hardening, and compliance validation to the audit system.

---

## 1. Cryptography Upgrade (High Priority)

### Files to Create/Modify:
- `src/memory-layer/governance/crypto-signer.ts` (upgrade existing)
- `src/memory-layer/governance/crypto-ed25519.ts` (new)
- `src/memory-layer/governance/jwks-manager.ts` (new)

### Changes:
1. **Switch to Ed25519**
   - Replace RSA-2048 with Ed25519 (modern, smaller signatures)
   - Fallback: Keep RSA-PSS as alternative if Ed25519 unavailable
   - Update key generation from `crypto.generateKeyPairSync('rsa')` to `crypto.generateKeyPairSync('ed25519')`

2. **Add kid/alg fields**
   ```typescript
   export interface SignatureResult {
     signature: string;
     algorithm: 'Ed25519' | 'RS256';  // Changed from 'RSA-SHA256'
     keyId: string;      // kid (Key ID)
     timestamp: string;
     alg: string;        // JOSE algorithm identifier
   }
   ```

3. **JWKS Support**
   ```typescript
   export interface JWK {
     kty: string;        // Key Type ('OKP' for Ed25519)
     use: string;        // 'sig' for signing
     kid: string;        // Key ID
     alg: string;        // 'EdDSA' for Ed25519
     crv?: string;       // Curve ('Ed25519')
     x?: string;         // Public key (base64url)
   }

   export interface JWKS {
     keys: JWK[];
   }
   ```

---

## 2. Event Schema Enhancement (High Priority)

### Files to Modify:
- `src/memory-layer/storage/ledger-sink.ts`
- `src/memory-layer/governance/audit-emitter.ts`

### Changes:
```typescript
export interface AuditEvent {
  // Existing fields
  event_id: string;
  timestamp: string;
  event_type: string;
  operation: string;
  hashed_pseudonym?: string;
  session_id?: string;
  payload: Record<string, any>;
  consent_context?: { ... };

  // NEW Phase 1.1 fields
  schemaVersion: string;        // e.g., '1.1.0'
  policyVersion: string;        // e.g., '2025-01'
  consentScope: string[];       // e.g., ['personal', 'audit']
}
```

---

## 3. Canonical Serialization (High Priority)

### Files to Create:
- `src/memory-layer/utils/canonical-json.ts`

### Implementation:
```typescript
/**
 * Canonical JSON serialization (RFC 8785)
 * Ensures deterministic signing
 */
export function canonicalStringify(obj: any): string {
  // 1. Sort object keys alphabetically
  // 2. No whitespace
  // 3. Escape sequences normalized
  // 4. Numbers in standard form

  return JSON.stringify(obj, Object.keys(obj).sort());
}
```

**Usage:** Before signing, canonicalize the event data:
```typescript
const canonical = canonicalStringify(event);
const signature = this.signer.sign(canonical);
```

---

## 4. Atomic Writes & File Locking (Critical)

### Files to Modify:
- `src/memory-layer/storage/ledger-sink.ts`

### Changes:

#### Atomic Writes:
```typescript
private async atomicWrite(filePath: string, data: string): Promise<void> {
  const tempPath = `${filePath}.tmp.${Date.now()}`;

  try {
    // Write to temp file
    await fs.promises.writeFile(tempPath, data, 'utf8');

    // Sync to disk (critical for durability)
    const fd = await fs.promises.open(tempPath, 'r');
    await fd.sync();
    await fd.close();

    // Atomic rename
    await fs.promises.rename(tempPath, filePath);
  } catch (error) {
    // Cleanup temp file on error
    try {
      await fs.promises.unlink(tempPath);
    } catch {}
    throw error;
  }
}
```

#### File Locking:
```typescript
import * as lockfile from 'proper-lockfile';

async append(event: AuditEvent): Promise<SignedAuditReceipt> {
  const lockPath = path.join(this.ledgerPath, 'ledger.lock');

  // Acquire lock
  const release = await lockfile.lock(this.ledgerPath, {
    stale: 10000,  // 10 second stale timeout
    retries: {
      retries: 5,
      minTimeout: 100,
      maxTimeout: 1000,
    },
  });

  try {
    // ... perform append operation ...
    return receipt;
  } finally {
    await release();
  }
}
```

**Dependencies to add:**
```bash
npm install proper-lockfile
npm install --save-dev @types/proper-lockfile
```

---

## 5. Crash Recovery & Replay Protection (Critical)

### Files to Modify:
- `src/memory-layer/storage/ledger-sink.ts`

### Changes:

#### Crash Recovery:
```typescript
async initialize(): Promise<void> {
  // ... existing initialization ...

  // Check for incomplete writes
  await this.recoverFromCrash();

  // Verify ledger integrity
  const verification = this.merkleTree.verifyChain();
  if (!verification.valid) {
    throw new Error(`Ledger corrupted: ${verification.message}`);
  }
}

private async recoverFromCrash(): Promise<void> {
  // Find and remove any .tmp files
  const files = await fs.promises.readdir(this.ledgerPath);
  const tempFiles = files.filter(f => f.endsWith('.tmp'));

  for (const tempFile of tempFiles) {
    const tempPath = path.join(this.ledgerPath, tempFile);
    await fs.promises.unlink(tempPath);
    console.log(`🔧 Removed incomplete write: ${tempFile}`);
  }
}
```

#### Replay Protection:
```typescript
async append(event: AuditEvent): Promise<SignedAuditReceipt> {
  // Check monotonic index
  if (event.index && event.index !== this.ledgerHeight) {
    throw new Error(`Index mismatch: expected ${this.ledgerHeight}, got ${event.index}`);
  }

  // Check previous root hash
  const currentRoot = this.merkleTree.getRoot();
  if (event.prevRoot && event.prevRoot !== currentRoot) {
    throw new Error(`Root mismatch: expected ${currentRoot}, got ${event.prevRoot}`);
  }

  // ... continue with append ...
}
```

---

## 6. Incremental Integrity Checks (Performance)

### Files to Modify:
- `src/memory-layer/storage/ledger-sink.ts`
- `src/server.ts`

### Changes:

#### Cache Verified Root:
```typescript
export class LedgerSink {
  private lastVerifiedRoot: string | null = null;
  private lastVerifiedHeight: number = 0;

  /**
   * Fast integrity check (O(1) - checks only new nodes)
   */
  async verifyIncremental(): Promise<{ valid: boolean; message: string }> {
    const currentHeight = this.ledgerHeight;

    // If no new events, return cached result
    if (currentHeight === this.lastVerifiedHeight && this.lastVerifiedRoot) {
      return { valid: true, message: `No new events (cached @ height ${currentHeight})` };
    }

    // Verify only new nodes since last check
    for (let i = this.lastVerifiedHeight; i < currentHeight; i++) {
      const node = this.merkleTree.getNode(i);
      if (!node) {
        return { valid: false, message: `Missing node at index ${i}` };
      }

      // Verify hash integrity
      const recomputedHash = this.computeHash(JSON.stringify({ ... }));
      if (recomputedHash !== node.hash) {
        return { valid: false, message: `Hash mismatch at index ${i}` };
      }
    }

    // Update cache
    this.lastVerifiedRoot = this.merkleTree.getRoot();
    this.lastVerifiedHeight = currentHeight;

    return { valid: true, message: `Incremental verification passed (${currentHeight} events)` };
  }

  /**
   * Full chain verification (O(n) - for periodic audits)
   */
  async verifyFull(): Promise<{ valid: boolean; message: string; brokenAt?: number }> {
    return this.merkleTree.verifyChain();
  }
}
```

#### Update /readyz:
```typescript
// Use fast incremental check
const incrementalCheck = await ledger.verifyIncremental();
healthResponse.components.audit.status = incrementalCheck.valid ? 'healthy' : 'unhealthy';
healthResponse.components.audit.message = incrementalCheck.message;
```

---

## 7. Verification API Endpoints (High Priority)

### Files to Create/Modify:
- `src/memory-layer/api/verification.ts` (new)
- `src/server.ts` (add routes)

### Endpoints:

#### GET /v1/ledger/root
```typescript
app.get('/v1/ledger/root', apiLimiter, async (_req, res) => {
  const ledger = await getLedgerSink();
  const signer = await getCryptoSigner();

  res.json({
    root: ledger.getRootHash(),
    height: ledger.getLedgerHeight(),
    timestamp: new Date().toISOString(),
    kid: signer.getKeyId(),
    algorithm: 'Ed25519',
  });
});
```

#### GET /v1/receipts/:id
```typescript
app.get('/v1/receipts/:id', apiLimiter, async (req, res) => {
  const { id } = req.params;
  const ledger = await getLedgerSink();

  const receipt = await ledger.getReceipt(id);
  if (!receipt) {
    return res.status(404).json({ error: 'Receipt not found' });
  }

  // Verify receipt
  const verification = ledger.verifyReceipt(receipt);

  res.json({
    receipt,
    verification: {
      valid: verification.valid,
      merkle_valid: verification.merkle_valid,
      signature_valid: verification.signature_valid,
      message: verification.message,
    },
  });
});
```

#### GET /v1/keys/jwks
```typescript
app.get('/v1/keys/jwks', apiLimiter, async (_req, res) => {
  const jwksManager = await getJWKSManager();
  const jwks = await jwksManager.getJWKS();

  res.json(jwks);
});
```

#### POST /v1/receipts/verify
```typescript
app.post('/v1/receipts/verify', apiLimiter, async (req, res) => {
  const { receipt } = req.body;

  if (!receipt) {
    return res.status(400).json({ error: 'Missing receipt' });
  }

  const ledger = await getLedgerSink();
  const verification = ledger.verifyReceipt(receipt);

  res.json({
    valid: verification.valid,
    details: {
      merkle_valid: verification.merkle_valid,
      signature_valid: verification.signature_valid,
      message: verification.message,
    },
  });
});
```

#### GET /v1/ledger/integrity
```typescript
app.get('/v1/ledger/integrity', apiLimiter, async (req, res) => {
  const { full } = req.query;
  const ledger = await getLedgerSink();

  const result = full === 'true'
    ? await ledger.verifyFull()
    : await ledger.verifyIncremental();

  res.json({
    valid: result.valid,
    message: result.message,
    brokenAt: result.brokenAt,
    height: ledger.getLedgerHeight(),
    timestamp: new Date().toISOString(),
  });
});
```

---

## 8. Testing (Critical)

### Files to Create:
- `test/memory-layer/merkle-tree.test.ts`
- `test/memory-layer/crypto-signer.test.ts`
- `test/memory-layer/ledger-sink.test.ts`
- `test/memory-layer/verification-api.test.ts`

### Test Categories:

#### Property-Based Tests:
```typescript
import * as fc from 'fast-check';

describe('Merkle Tree Properties', () => {
  test('any valid proof verifies correctly', () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { minLength: 1 }), (events) => {
        const tree = new MerkleTree();
        const proofs = events.map(e => tree.append(e).proof);

        // All proofs should verify
        return proofs.every((proof, i) => tree.verifyProof(proof, events[i]));
      })
    );
  });
});
```

#### Fuzz Tests:
```typescript
describe('Receipt Tampering Detection', () => {
  test('truncated receipts fail verification', () => {
    const receipt = createValidReceipt();
    const truncated = JSON.stringify(receipt).slice(0, -10);

    expect(() => JSON.parse(truncated)).toThrow();
  });

  test('altered signatures fail verification', () => {
    const receipt = createValidReceipt();
    receipt.signature.signature = 'tampered';

    const result = ledger.verifyReceipt(receipt);
    expect(result.valid).toBe(false);
    expect(result.signature_valid).toBe(false);
  });
});
```

#### Concurrency Tests:
```typescript
describe('Concurrent Append Operations', () => {
  test('parallel appends maintain chain integrity', async () => {
    const promises = Array.from({ length: 100 }, (_, i) =>
      ledger.append(createEvent(`event-${i}`))
    );

    await Promise.all(promises);

    const verification = await ledger.verifyFull();
    expect(verification.valid).toBe(true);
    expect(ledger.getLedgerHeight()).toBe(100);
  });
});
```

---

## 9. Key Rotation Runbook

### File to Create:
- `docs/runbooks/key-rotation.md`

### Content Outline:
```markdown
# Key Rotation Runbook

## Pre-Rotation
1. Announce rotation window (7 days before)
2. Verify backup integrity
3. Test rotation in staging

## Rotation Process
1. Generate new key pair
2. Publish new key to JWKS (both keys active)
3. Grace period (24 hours - both keys valid)
4. Switch default to new key
5. Deprecate old key (mark in JWKS)
6. Grace period (7 days)
7. Remove old key from JWKS

## Post-Rotation
1. Verify all receipts signed with new key
2. Archive old key securely
3. Update monitoring alerts

## Emergency Rotation (Breach Response)
1. Immediately generate new key
2. Revoke compromised key (0-day grace)
3. Re-sign recent receipts if possible
4. Notify stakeholders
5. Incident report
```

---

## 10. CI/CD Updates

### Files to Modify:
- `.github/workflows/policy-gates.yml`

### Add Steps:
```yaml
- name: Validate Audit Event Schema
  run: |
    npm run test:schema-validation

- name: Run Property-Based Tests
  run: |
    npm run test:property

- name: Run Fuzz Tests
  run: |
    npm run test:fuzz

- name: Verify No PII in Logs
  run: |
    npm run test:pii-check
```

---

## Implementation Order

1. **Crypto Upgrade** (Day 1-2)
   - Ed25519 implementation
   - kid/alg fields
   - JWKS manager

2. **Ledger Hardening** (Day 2-3)
   - Atomic writes + fsync
   - File locking
   - Crash recovery

3. **API Endpoints** (Day 3-4)
   - Verification endpoints
   - JWKS endpoint
   - Integrity check endpoint

4. **Testing** (Day 4-5)
   - Property-based tests
   - Fuzz tests
   - Concurrency tests

5. **Documentation** (Day 5-6)
   - Runbooks
   - ADR updates
   - API documentation

6. **CI/CD** (Day 6)
   - Schema validation
   - Test automation
   - PII checking

---

## Success Metrics

- ✅ External verifiers can validate receipts via API
- ✅ Zero data loss during crash scenarios
- ✅ < 1s incremental integrity check @ 10k receipts
- ✅ < 30s full chain verification @ 10k receipts
- ✅ 100% test coverage for crypto operations
- ✅ All audits pass PII redaction checks

---

**Invariant:** Memory enriches but never controls.
