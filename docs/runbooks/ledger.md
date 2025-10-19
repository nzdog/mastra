# Ledger Hashing and Versioning

**Phase 3.2** - Canonical JSON Hashing Change

## Overview

The audit ledger uses cryptographic hashing to ensure tamper-evidence. As of Phase 3.2, we've migrated to **canonical JSON serialization** (RFC-8785) for deterministic hashing.

## Hashing Format Version

All new ledger records include a `hash_format` metadata field:

```json
{
  "hash_format": "canon-v1",
  "block_height": 12345,
  "merkle_root": "...",
  "timestamp": "2025-01-15T12:00:00Z"
}
```

### Version History

| Version | Format | Description | Introduced |
|---------|--------|-------------|------------|
| `canon-v1` | RFC-8785 canonical JSON | Property-order independent hashing | Phase 3.2 |
| (legacy) | Standard JSON.stringify | Property-order dependent | Phase 1.0-3.1 |

## Canonical JSON Hashing

**Benefits:**
- **Property-order independence**: `{a:1, b:2}` and `{b:2, a:1}` produce identical hashes
- **Deterministic serialization**: Consistent across different JSON libraries
- **Interoperability**: Follows RFC-8785 standard

**Implementation:**
- Uses `canonicalStringify()` utility from `src/memory-layer/utils/canonical-json.ts`
- Applies to all Merkle tree operations
- Ensures consistent hashing across verifiers

## Historical Compatibility

**Important:** Historical proofs remain valid. No re-hash is required for pre-Phase 3.2 records.

### Verification Strategy

When verifying ledger proofs:

1. **Check block height or timestamp** to infer hash format
2. **For blocks < changeover height**: Use standard JSON.stringify
3. **For blocks ≥ changeover height**: Use canonical JSON

### Changeover Height

The changeover to canonical hashing occurred at:
- **Block Height**: (TBD - set during Phase 3.2 deployment)
- **Timestamp**: (TBD - set during Phase 3.2 deployment)

## Testing

Test suite `test/merkle-canonical-json.test.ts` validates:
- Property-order independence
- Deterministic hashing
- Compatibility with legacy format

## Migration

No migration required. The system automatically:
- Uses canonical JSON for new records
- Preserves historical proofs with legacy format
- Verifiers adapt based on block metadata

## Monitoring

Track hashing format distribution:
```bash
# Query ledger for hash format versions
curl /v1/ledger/stats | jq '.hash_format_distribution'
```

## References

- RFC-8785: JSON Canonicalization Scheme (JCS)
- `src/memory-layer/utils/canonical-json.ts` - Implementation
- `test/merkle-canonical-json.test.ts` - Test suite
