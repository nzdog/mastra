# KEK Rotation Runbook

**Phase 3 Week 3 - Encryption Key Management**

This runbook describes how to rotate Key Encryption Keys (KEKs) safely in production without downtime or data loss.

## Overview

Lichen uses **envelope encryption** with monthly KEK rotation:
- **DEK (Data Encryption Key)**: Randomly generated per record, encrypted with KEK
- **KEK (Key Encryption Key)**: Managed by KMS, rotated monthly
- **KEK ID Format**: `kek-YYYYMM` (e.g., `kek-202501` for January 2025)

### Key Concepts

1. **New writes** use the current KEK ID
2. **Old records** can still be decrypted using their stored KEK ID
3. **Rotation** does NOT require rewrapping existing data immediately
4. **Rewrap jobs** can be run later to consolidate KEKs

## Monthly KEK Rotation Procedure

### 1. Pre-Rotation Checklist

- [ ] Verify current KEK ID: `echo $KEK_ID` or check logs
- [ ] Confirm KMS provider has new KEK provisioned
- [ ] Test new KEK in staging environment
- [ ] Schedule rotation during low-traffic window (optional)

### 2. Rotation Steps

#### Option A: Automatic Rotation (Recommended)

The system auto-generates KEK IDs based on `YYYYMM` format. No manual intervention needed unless using custom KEK IDs.

```bash
# Current KEK is derived from current month
# New writes automatically use current month's KEK
# No service restart required
```

#### Option B: Manual KEK ID Override

If using custom KEK IDs (not recommended for production):

```bash
# Set new KEK ID via environment variable
export KEK_ID=kek-202502

# Restart service to pick up new KEK ID
systemctl restart lichen-memory-service

# Verify new KEK ID in use
curl http://localhost:3000/metrics | grep -A5 "kek_id"
```

#### Option C: Programmatic Rotation

Use the EncryptionService API to rotate KEK mid-flight (advanced):

```typescript
import { getEncryptionService } from './encryption-service';

const service = getEncryptionService();
const newKekId = 'kek-202502';

// Rotate to new KEK for future encryptions
service.rotateKEK(newKekId);

console.log(`Rotated to ${service.getCurrentKekId()}`);
```

### 3. Post-Rotation Verification

```bash
# Check metrics for new KEK ID
curl http://localhost:3000/metrics | grep crypto_ops_duration_ms

# Verify new records use new KEK
# (Check dek_kid field in encrypted content)

# Monitor for decryption errors (should be zero)
curl http://localhost:3000/metrics | grep crypto_decrypt_failures_total
```

## KMS Provider Configuration

### Memory KMS (Dev/Test Only)

```bash
export KMS_PROVIDER=memory
export DEV_KEK_BASE64=$(openssl rand -base64 32)  # Generate 256-bit key
```

**WARNING**: Never use memory KMS in production! Keys are lost on restart.

### AWS KMS (Production)

```bash
export KMS_PROVIDER=aws
export AWS_KMS_KEY_ARN=arn:aws:kms:us-east-1:123456789012:key/UUID
export AWS_REGION=us-east-1
# AWS credentials via IAM role or env vars (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
```

### GCP KMS (Production - Not Yet Implemented)

```bash
export KMS_PROVIDER=gcp
export GCP_KMS_KEY_NAME=projects/PROJECT/locations/LOCATION/keyRings/RING/cryptoKeys/KEY
export GCP_PROJECT_ID=your-project-id
# GCP credentials via service account or ADC
```

**TODO**: Implement GCP KMS provider (currently stub only).

## Monitoring & Alerts

### Key Metrics

```promql
# KEK age (alert if > 45 days)
(time() - kek_rotation_timestamp_seconds) / 86400 > 45

# Decryption failures (alert if > 0)
rate(crypto_decrypt_failures_total[5m]) > 0

# Encryption operations
rate(crypto_ops_duration_ms_count{op="encrypt"}[5m])
```

## Troubleshooting

### Decryption Failures After Rotation

**Symptom**: `crypto_decrypt_failures_total` increasing after KEK rotation.

**Cause**: Old KEK decommissioned before rewrap completed.

**Fix**:
1. Re-provision old KEK in KMS temporarily
2. Complete rewrap job
3. Decommission old KEK again

### New Writes Fail After Rotation

**Symptom**: `crypto_encrypt_failures_total` increasing.

**Cause**: New KEK not provisioned in KMS or incorrect permissions.

**Fix**:
1. Verify KEK exists: `aws kms describe-key --key-id $AWS_KMS_KEY_ARN`
2. Check IAM permissions for encrypt operation
3. Test KEK manually: `aws kms encrypt --key-id $AWS_KMS_KEY_ARN --plaintext "test"`

## Security Best Practices

1. **Never commit KEKs to version control**
2. **Use KMS for production** (AWS KMS, GCP KMS, HashiCorp Vault)
3. **Rotate KEKs monthly** (automated via `YYYYMM` format)
4. **Monitor decryption failures** continuously
5. **Test rotation in staging** before production
6. **Keep old KEKs available** for 90 days after rotation

## References

- [NIST Key Management Guidelines](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-57pt1r5.pdf)
- [AWS KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)
- [Envelope Encryption Pattern](https://cloud.google.com/kms/docs/envelope-encryption)
