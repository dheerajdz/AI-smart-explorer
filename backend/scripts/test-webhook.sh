#!/bin/bash
# ============================================================
# Webhook E2E Test Script
# Run this after starting the server with `pnpm dev`
# ============================================================

set -e

BASE_URL="http://localhost:3000"
WEBHOOK_URL="https://webhook.site/#!/replace-with-your-uuid"
USER_ID="test-user-123"

echo "========================================"
echo "  Webhook System E2E Tests"
echo "========================================"
echo ""

# ─── Test 1: Create Webhook ─────────────────────────────────
echo "[Test 1] Create webhook..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/webhooks" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"url\": \"$WEBHOOK_URL\",
    \"events\": [\"large.transfer\", \"alert.triggered\", \"wallet.tracked\"]
  }")

echo "Response: $CREATE_RESPONSE"
WEBHOOK_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Webhook ID: $WEBHOOK_ID"
echo ""

# ─── Test 2: List Webhooks ──────────────────────────────────
echo "[Test 2] List webhooks..."
curl -s "$BASE_URL/webhooks?userId=$USER_ID" | jq .
echo ""

# ─── Test 3: Send Test Event ────────────────────────────────
echo "[Test 3] Send test event..."
curl -s -X POST "$BASE_URL/webhooks/$WEBHOOK_ID/test" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\"}" | jq .
echo ""

# ─── Test 4: Get Delivery Logs ──────────────────────────────
echo "[Test 4] Get delivery logs..."
curl -s "$BASE_URL/webhooks/$WEBHOOK_ID/logs?userId=$USER_ID" | jq .
echo ""

# ─── Test 5: Delete Webhook ─────────────────────────────────
echo "[Test 5] Delete webhook..."
curl -s -X DELETE "$BASE_URL/webhooks/$WEBHOOK_ID" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\"}" | jq .
echo ""

echo "========================================"
echo "  E2E Tests Complete"
echo "========================================"
echo ""
echo "Manual verification steps:"
echo "1. Visit $WEBHOOK_URL to see received payloads"
echo "2. Check HMAC signature in X-Webhook-Signature header"
echo "3. Verify retry behavior by using a failing URL"
