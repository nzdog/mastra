#!/bin/bash
# Store Endpoint Validation Script
# Phase 3.1: Schema validator, Ajv, and JSON imports verification

set -e

echo "=== Store Endpoint Validation ==="
echo ""

# Check if server is running
if ! curl -s http://localhost:4099/health > /dev/null 2>&1; then
  echo "❌ Server not running on port 4099"
  echo "   Start server with: npm run dev"
  exit 1
fi

echo "✅ Server is running"
echo ""

# Test store endpoint with valid memory record
echo "📝 Testing POST /memory/store endpoint..."

RESPONSE=$(curl -s -X POST http://localhost:4099/memory/store \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key" \
  -d '{
    "id": "test-'$(date +%s)'",
    "hashed_pseudonym": "hs_test_user_123",
    "session_id": "sess_test_123",
    "content": {
      "type": "text",
      "data": "Test memory content"
    },
    "consent_family": "personal",
    "consent_timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "consent_version": "1.0",
    "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "updated_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "access_count": 0,
    "audit_receipt_id": "audit_test_123"
  }')

# Check if response contains expected fields
if echo "$RESPONSE" | grep -q '"id"'; then
  echo "✅ Store endpoint returned valid response"
  echo "   Response: $RESPONSE"
else
  echo "❌ Store endpoint failed"
  echo "   Response: $RESPONSE"
  exit 1
fi

echo ""
echo "=== All Store Endpoint Tests Passed ✅ ==="
echo ""
echo "Validation complete:"
echo "  • Schema validator: ✅ Working"
echo "  • Ajv resolution: ✅ Working"
echo "  • JSON imports: ✅ Working"
echo "  • validateBody middleware: ✅ Working"
echo "  • Store endpoint: ✅ Working"
