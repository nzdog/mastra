# Key Rotation Runbook - Phase 1.1

**Version:** 1.0.0
**Last Updated:** 2025-10-16
**Cadence:** ≤90 days (routine), on-demand (emergency)

---

## Overview

This runbook defines operational procedures for Ed25519 signing key rotation in the Memory Layer audit system. Key rotation is critical for:
- **Security hygiene**: Limit exposure window of any single key
- **Compliance**: Meet regulatory requirements for key lifecycle management
- **Resilience**: Enable recovery from key compromise scenarios

---

## Key Rotation Cadence

### Routine Rotation
- **Frequency:** Every 90 days maximum
- **Grace Period:** 7 days (both keys valid for verification)
- **Announcement:** 7 days before rotation window

### Compliance Rotation
- **Frequency:** Every 365 days maximum (regulatory requirement)
- **Aligns with:** Annual security audits

### Emergency Rotation
- **Trigger:** Suspected or confirmed key compromise
- **Grace Period:** 0 days (immediate revocation)
- **Response Time:** < 4 hours

---

## Pre-Rotation Checklist

### 7 Days Before Rotation

- [ ] **Announce rotation window**
  ```bash
  # Post announcement to operations channel
  echo "Key rotation scheduled for YYYY-MM-DD"
  echo "Old key (kid): <current_key_id>"
  echo "Grace period: 7 days"
  ```

- [ ] **Verify backup integrity**
  ```bash
  # Check key backup exists and is accessible
  ls -lh .keys/backup/key_*.pem

  # Verify backup can be restored
  openssl pkey -in .keys/backup/key_<timestamp>.pem -pubout -outform PEM
  ```

- [ ] **Test rotation in staging**
  ```bash
  # Run rotation procedure in staging environment
  cd /path/to/staging
  npm run key:rotate -- --dry-run

  # Verify JWKS endpoint returns both keys
  curl http://staging:3000/v1/keys/jwks | jq '.keys | length'
  # Expected: 2 (old + new)
  ```

- [ ] **Document current key metadata**
  ```bash
  # Record current key details
  curl http://localhost:3000/v1/keys/jwks | jq '.keys[] | {kid, crv, created_at}'

  # Save to rotation log
  echo "$(date): Current key <kid> scheduled for rotation" >> docs/key-rotation-log.md
  ```

---

## Rotation Procedure

### Step 1: Generate New Key Pair

```bash
# Generate new Ed25519 key pair
cd /path/to/project
node -e "
  const crypto = require('crypto');
  const fs = require('fs');
  const timestamp = Date.now();
  const keyId = \`key_\${timestamp}_\${crypto.randomBytes(4).toString('hex')}\`;

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  fs.mkdirSync('.keys/active', { recursive: true });
  fs.writeFileSync(\`.keys/active/\${keyId}.pem\`, privateKey);
  fs.writeFileSync(\`.keys/active/\${keyId}.pub\`, publicKey);

  console.log('Generated key:', keyId);
"
```

**Verify:**
```bash
# Check new key files exist
ls -lh .keys/active/key_*.pem .keys/active/key_*.pub

# Verify key type
openssl pkey -in .keys/active/key_<new_kid>.pem -text -noout | grep "ED25519"
```

---

### Step 2: Publish New Key to JWKS

```bash
# Restart server to load new key
# Server will automatically publish both old and new keys to JWKS endpoint
npm run server:restart

# Verify JWKS contains both keys
curl http://localhost:3000/v1/keys/jwks | jq '.keys | length'
# Expected: 2

# Verify new key is present
curl http://localhost:3000/v1/keys/jwks | jq '.keys[] | select(.kid == "<new_kid>")'
```

**Expected JWKS format:**
```json
{
  "keys": [
    {
      "kty": "OKP",
      "use": "sig",
      "kid": "key_<old_timestamp>_<old_hash>",
      "alg": "EdDSA",
      "crv": "Ed25519",
      "x": "<old_public_key_base64url>"
    },
    {
      "kty": "OKP",
      "use": "sig",
      "kid": "key_<new_timestamp>_<new_hash>",
      "alg": "EdDSA",
      "crv": "Ed25519",
      "x": "<new_public_key_base64url>"
    }
  ]
}
```

---

### Step 3: Grace Period - Both Keys Active

**Duration:** 24 hours

During this period:
- ✅ New receipts signed with **new key**
- ✅ Old receipts still verify with **old key** (from JWKS)
- ✅ External verifiers can cache JWKS with both keys

```bash
# Monitor new receipts are signed with new key
curl http://localhost:3000/api/health
curl http://localhost:3000/v1/receipts/<receipt_id> | jq '.receipt.signature.keyId'
# Expected: key_<new_timestamp>_<new_hash>

# Verify old receipts still validate
curl http://localhost:3000/v1/receipts/<old_receipt_id> | jq '.verification.valid'
# Expected: true
```

---

### Step 4: Switch Default Signing Key

**Timing:** After 24-hour grace period

The server automatically uses the newest key for signing. No action required.

```bash
# Verify new key is default signer
curl -X POST http://localhost:3000/api/walk/start \
  -H "Content-Type: application/json" \
  -d '{"user_input": "test"}' | jq '.receipt.signature.keyId'
# Expected: key_<new_timestamp>_<new_hash>
```

---

### Step 5: Deprecate Old Key

**Timing:** 24 hours after switching default key

Mark old key as deprecated in JWKS:

```bash
# Mark old key as deprecated (manual update to JWKS metadata)
# TODO(ops): Add script to mark key as deprecated
# For now, documented in key metadata file

echo "deprecated: true" >> .keys/metadata/key_<old_kid>.json
```

**JWKS should now indicate deprecation:**
```json
{
  "keys": [
    {
      "kid": "key_<old_timestamp>_<old_hash>",
      "deprecated": true,
      "deprecated_at": "2025-10-23T12:00:00Z"
    },
    {
      "kid": "key_<new_timestamp>_<new_hash>"
    }
  ]
}
```

---

### Step 6: Extended Grace Period

**Duration:** 7 days

- ✅ Old key remains in JWKS for verification only
- ✅ External verifiers can still validate old receipts
- ❌ Old key no longer used for new signatures

```bash
# Monitor: All new receipts use new key
for i in {1..10}; do
  curl -s http://localhost:3000/api/health | jq -r '.receipt.signature.keyId'
done
# Expected: All output = key_<new_timestamp>_<new_hash>
```

---

### Step 7: Remove Old Key from JWKS

**Timing:** After 7-day grace period

```bash
# Move old key to archive
mv .keys/active/key_<old_kid>.pem .keys/archive/
mv .keys/active/key_<old_kid>.pub .keys/archive/

# Restart server (automatically removes old key from JWKS)
npm run server:restart

# Verify JWKS only contains new key
curl http://localhost:3000/v1/keys/jwks | jq '.keys | length'
# Expected: 1
```

---

## Post-Rotation Validation

### Verify New Key Operation

```bash
# Test new receipts are signed and verifiable
curl -X POST http://localhost:3000/api/walk/start \
  -H "Content-Type: application/json" \
  -d '{"user_input": "post-rotation test"}' \
  > /tmp/new_receipt.json

# Verify receipt
curl -X POST http://localhost:3000/v1/receipts/verify \
  -H "Content-Type: application/json" \
  -d @/tmp/new_receipt.json | jq '.valid'
# Expected: true
```

### Archive Old Key Securely

```bash
# Encrypt old key for long-term archive
openssl enc -aes-256-cbc \
  -in .keys/archive/key_<old_kid>.pem \
  -out .keys/archive/key_<old_kid>.pem.enc \
  -pass file:.keys/archive.password

# Remove unencrypted key
rm .keys/archive/key_<old_kid>.pem

# Store encrypted key in secure backup location
aws s3 cp .keys/archive/key_<old_kid>.pem.enc \
  s3://lichen-key-archive/$(date +%Y)/
```

### Update Monitoring Alerts

```bash
# Update key age alert threshold
# TODO(ops): Configure Prometheus/Grafana alert for key age > 85 days

# Update JWKS cache TTL monitoring
# TODO(ops): Monitor JWKS fetch rate from external verifiers
```

### Document Rotation

```bash
# Update rotation log
cat >> docs/key-rotation-log.md <<EOF

## Rotation - $(date +%Y-%m-%d)

- **Old Key:** key_<old_kid>
- **New Key:** key_<new_kid>
- **Type:** Routine (90-day cadence)
- **Grace Period:** 7 days
- **Status:** ✅ Complete
- **Verified By:** [operator name]

EOF
```

---

## Emergency Rotation (Breach Response)

### Trigger Conditions

Emergency rotation required if:
- ✅ Private key file compromised (unauthorized access)
- ✅ Key material leaked (e.g., committed to git)
- ✅ Unauthorized signatures detected
- ✅ Security audit identifies key exposure

### Emergency Procedure

**Timeline:** < 4 hours from detection to completion

#### 1. Immediately Generate New Key (< 30 min)

```bash
# Generate emergency key with timestamp
EMERGENCY_TIMESTAMP=$(date +%s)
node scripts/generate-emergency-key.js --timestamp $EMERGENCY_TIMESTAMP

# Verify key generation
ls -lh .keys/emergency/key_emergency_${EMERGENCY_TIMESTAMP}*
```

#### 2. Revoke Compromised Key (< 30 min)

```bash
# Mark compromised key as REVOKED in JWKS
cat > .keys/revoked/key_<compromised_kid>.json <<EOF
{
  "kid": "key_<compromised_kid>",
  "revoked": true,
  "revoked_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "reason": "key_compromise",
  "incident_id": "INC-$(date +%Y%m%d-%H%M)"
}
EOF

# Remove compromised key from active directory
mv .keys/active/key_<compromised_kid>.pem .keys/revoked/

# Restart server (0-day grace period)
npm run server:restart
```

#### 3. Re-sign Recent Receipts (< 2 hours)

```bash
# Re-sign receipts from last 24 hours with new key
# TODO(ops): Implement receipt re-signing script

node scripts/re-sign-receipts.js \
  --since "24 hours ago" \
  --new-key key_emergency_${EMERGENCY_TIMESTAMP}

# Verify re-signed receipts
curl http://localhost:3000/v1/ledger/integrity | jq '.valid'
# Expected: true
```

#### 4. Notify Stakeholders (< 1 hour)

```bash
# Post security advisory
cat > /tmp/security-advisory.md <<EOF
# Security Advisory - Emergency Key Rotation

**Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Incident ID:** INC-$(date +%Y%m%d-%H%M)
**Severity:** HIGH

## Summary
Emergency key rotation performed due to suspected key compromise.

## Actions Taken
- Revoked key: key_<compromised_kid>
- Generated new key: key_emergency_${EMERGENCY_TIMESTAMP}
- Re-signed receipts from last 24 hours

## Impact
- All receipts remain valid and verifiable
- External verifiers should refresh JWKS cache immediately

## Next Steps
- Update JWKS cache (TTL: 0)
- Re-verify all receipts if necessary
- Contact security@lichen-protocol.org for questions

EOF

# Send to operations channel
./scripts/notify-stakeholders.sh /tmp/security-advisory.md
```

#### 5. File Incident Report

```bash
# Create incident report
cp /tmp/security-advisory.md docs/incidents/INC-$(date +%Y%m%d-%H%M).md

# Update incident log
echo "- $(date): Emergency rotation (key_<compromised_kid> → key_emergency_${EMERGENCY_TIMESTAMP})" \
  >> docs/incident-log.md
```

---

## JWKS Rollover Procedure

### Cache TTL Management

```bash
# Set JWKS cache TTL header (24 hours max)
# Server should include: Cache-Control: max-age=86400

# During rotation: reduce TTL to 1 hour
# Server should include: Cache-Control: max-age=3600
```

### External Verifier Guidance

External verifiers should:
1. **Cache JWKS** with respect to `Cache-Control` header
2. **Refresh cache** when signature verification fails with `kid not found`
3. **Maintain key history** for at least 90 days (3 rotation cycles)

### JWKS Version History

```bash
# Maintain JWKS snapshots for audit trail
mkdir -p .keys/jwks-history
curl http://localhost:3000/v1/keys/jwks > .keys/jwks-history/jwks_$(date +%s).json

# Retention: 365 days
find .keys/jwks-history -name "jwks_*.json" -mtime +365 -delete
```

---

## Verification Steps

### Pre-Flight Checks

```bash
# 1. Verify new key type
openssl pkey -in .keys/active/key_<new_kid>.pem -text -noout | grep "ED25519"

# 2. Test signature creation
node -e "
  const crypto = require('crypto');
  const fs = require('fs');
  const key = fs.readFileSync('.keys/active/key_<new_kid>.pem');
  const data = 'test';
  const sig = crypto.sign(null, Buffer.from(data), key);
  console.log('Signature:', sig.toString('base64'));
"

# 3. Test signature verification
node -e "
  const crypto = require('crypto');
  const fs = require('fs');
  const key = fs.readFileSync('.keys/active/key_<new_kid>.pub');
  const data = 'test';
  const sig = Buffer.from('<signature_from_above>', 'base64');
  const valid = crypto.verify(null, Buffer.from(data), key, sig);
  console.log('Valid:', valid); // Expected: true
"
```

### Post-Rotation Checks

```bash
# 1. Verify JWKS contains correct keys
curl http://localhost:3000/v1/keys/jwks | jq '.keys[] | {kid, crv, deprecated}'

# 2. Test external verifier workflow
curl http://localhost:3000/v1/keys/jwks > /tmp/jwks.json
curl http://localhost:3000/v1/receipts/<receipt_id> > /tmp/receipt.json

# Verify receipt using JWKS
node scripts/verify-receipt-with-jwks.js \
  --jwks /tmp/jwks.json \
  --receipt /tmp/receipt.json
# Expected: ✅ Receipt verified

# 3. Verify ledger integrity
curl http://localhost:3000/v1/ledger/integrity?full=true | jq '.valid'
# Expected: true
```

---

## Rollback Procedure

If rotation fails, rollback to previous key:

```bash
# 1. Restore old key to active directory
mv .keys/backup/key_<old_kid>.pem .keys/active/

# 2. Remove failed new key
rm .keys/active/key_<failed_new_kid>.pem

# 3. Restart server
npm run server:restart

# 4. Verify old key is active
curl http://localhost:3000/v1/keys/jwks | jq '.keys[] | select(.kid == "key_<old_kid>")'

# 5. Document rollback
echo "$(date): Rotation rollback (key_<failed_new_kid> → key_<old_kid>)" \
  >> docs/key-rotation-log.md
```

---

## Troubleshooting

### Issue: JWKS not updating after key rotation

```bash
# Check server logs for key loading errors
tail -f logs/server.log | grep "JWKS\|key"

# Verify key file permissions
ls -l .keys/active/*.pem
# Expected: -rw------- (600)

# Force JWKS refresh
curl -X POST http://localhost:3000/internal/jwks/refresh
```

### Issue: Old receipts fail verification

```bash
# Verify old key still in JWKS during grace period
curl http://localhost:3000/v1/keys/jwks | jq '.keys[] | select(.kid == "key_<old_kid>")'

# Check receipt signature metadata
curl http://localhost:3000/v1/receipts/<receipt_id> | jq '.receipt.signature'

# Manual verification with old key
node scripts/verify-with-kid.js \
  --receipt-id <receipt_id> \
  --kid key_<old_kid>
```

### Issue: External verifiers see stale JWKS

```bash
# Check cache headers
curl -I http://localhost:3000/v1/keys/jwks

# Force cache invalidation on CDN (if applicable)
curl -X PURGE https://cdn.lichen-protocol.org/v1/keys/jwks

# Notify verifiers to clear cache
./scripts/notify-cache-clear.sh
```

---

## Compliance & Audit

### Audit Trail

All key rotations must be logged in:
- `docs/key-rotation-log.md` - Human-readable rotation history
- `.keys/metadata/*.json` - Machine-readable key metadata
- `docs/incidents/*.md` - Incident reports (emergency rotations)

### Regulatory Requirements

- **SOC 2:** Key rotation every 365 days maximum
- **HIPAA:** Key lifecycle documented with audit trail
- **GDPR:** Key compromise response < 72 hours

### External Audit Support

```bash
# Generate key lifecycle report
node scripts/generate-key-report.js \
  --start-date 2025-01-01 \
  --end-date 2025-12-31 \
  --format pdf \
  --output reports/key-lifecycle-2025.pdf
```

---

## Appendix

### Key Metadata Schema

```json
{
  "kid": "key_1760576878187_dd08fda6",
  "algorithm": "Ed25519",
  "created_at": "2025-10-16T01:07:58.187Z",
  "activated_at": "2025-10-16T01:07:58.187Z",
  "deprecated_at": "2025-11-15T12:00:00Z",
  "revoked_at": null,
  "rotation_reason": "routine_90day",
  "predecessor_kid": "key_1757900000000_abcd1234",
  "successor_kid": "key_1763400000000_efgh5678"
}
```

### Contact Information

- **Security Team:** security@lichen-protocol.org
- **Operations:** ops@lichen-protocol.org
- **On-Call:** +1-555-LICHEN-1 (555-424-2436)

---

**Invariant:** Memory enriches but never controls.
