#!/bin/bash

# Test script for prefix ID resolution feature
# Usage: ./test-prefix-resolution.sh [WORKER_URL] [API_KEY]

WORKER_URL="${1:-https://shodh-api.henry-krupp.workers.dev}"
API_KEY="${2:-sdmpwc}"

# Test memory ID from your database: 5f1e785c-64b6-40f0-a242-937baca0b8b3
FULL_ID="5f1e785c-64b6-40f0-a242-937baca0b8b3"
PREFIX_8="5f1e785c"
PREFIX_12="5f1e785c-64b"

echo "=========================================="
echo "Testing Prefix ID Resolution Feature"
echo "=========================================="
echo ""
echo "Target memory ID: ${FULL_ID}"
echo "Worker URL: ${WORKER_URL}"
echo ""

# Test 1: Full UUID (should work as before)
echo "=== Test 1: GET with full UUID ==="
curl -s "${WORKER_URL}/api/memories/${FULL_ID}" \
  -H "Authorization: Bearer ${API_KEY}" | jq -c '{
    success: (if .id then true else false end),
    id: .id,
    content_preview: (.content[:50] // "N/A"),
    resolved_from: .resolved_from
  }'
echo ""

# Test 2: 8-character prefix (minimum length)
echo "=== Test 2: GET with 8-char prefix: ${PREFIX_8} ==="
curl -s "${WORKER_URL}/api/memories/${PREFIX_8}" \
  -H "Authorization: Bearer ${API_KEY}" | jq -c '{
    success: (if .id then true else false end),
    id: .id,
    content_preview: (.content[:50] // "N/A"),
    resolved_from: .resolved_from
  }'
echo ""

# Test 3: 12-character prefix
echo "=== Test 3: GET with 12-char prefix: ${PREFIX_12} ==="
curl -s "${WORKER_URL}/api/memories/${PREFIX_12}" \
  -H "Authorization: Bearer ${API_KEY}" | jq -c '{
    success: (if .id then true else false end),
    id: .id,
    content_preview: (.content[:50] // "N/A"),
    resolved_from: .resolved_from
  }'
echo ""

# Test 4: PATCH with prefix
echo "=== Test 4: PATCH with prefix (add test tag) ==="
curl -s -X PATCH "${WORKER_URL}/api/memories/${PREFIX_8}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"tags":["test-prefix-resolution"]}' | jq -c '{
    success,
    id: .memory.id,
    tags: .memory.tags,
    resolved_from: .memory.resolved_from
  }'
echo ""

# Test 5: Reinforce with prefix (new endpoint)
echo "=== Test 5: POST reinforce with prefix ==="
curl -s -X POST "${WORKER_URL}/api/memories/${PREFIX_8}/reinforce" \
  -H "Authorization: Bearer ${API_KEY}" | jq -c '{
    success,
    id,
    previous_quality,
    new_quality,
    resolved_from
  }'
echo ""

# Test 6: Invalid prefix (too short - should fail)
echo "=== Test 6: GET with too-short prefix (7 chars - should fail) ==="
curl -s "${WORKER_URL}/api/memories/5f1e785" \
  -H "Authorization: Bearer ${API_KEY}" | jq -c '{
    error
  }'
echo ""

# Test 7: Non-existent prefix
echo "=== Test 7: GET with non-existent prefix ==="
curl -s "${WORKER_URL}/api/memories/deadbeef" \
  -H "Authorization: Bearer ${API_KEY}" | jq -c '{
    error
  }'
echo ""

# Test 8: DELETE with prefix (commented out to preserve your data)
echo "=== Test 8: DELETE with prefix (SKIPPED - would delete memory) ==="
echo "# curl -s -X DELETE \"${WORKER_URL}/api/forget/${PREFIX_8}\" -H \"Authorization: Bearer ${API_KEY}\""
echo ""

echo "=========================================="
echo "Test complete!"
echo "=========================================="
