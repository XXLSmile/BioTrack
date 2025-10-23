#!/usr/bin/env bash

# Simple end-to-end smoke test for the BioTrack backend.
# Prerequisites:
#   - Backend server running locally (default http://localhost:3000)
#   - jq installed for parsing JSON
#   - Two Google ID tokens available (Matt & Leo) passed via env or file
#   - Optional: path to an image file for /api/recognition/save when mock disabled
#
# Usage:
#   chmod +x scripts/test_flow.sh
#   ./scripts/test_flow.sh \
#      --matt-token "$(cat backend/tokens | sed -n 's/^Matt: //p')" \
#      --leo-token  "$(cat backend/tokens | sed -n 's/^Leo: //p')" \
#      --image ./bird_1.jpg

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000/api}"
MATT_TOKEN=""
LEO_TOKEN=""
IMAGE_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --matt-token)
      MATT_TOKEN="$2"
      shift 2
      ;;
    --leo-token)
      LEO_TOKEN="$2"
      shift 2
      ;;
    --image)
      IMAGE_PATH="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required. Install jq and retry." >&2
  exit 1
fi

if [[ -z "$MATT_TOKEN" || -z "$LEO_TOKEN" ]]; then
  echo "Both --matt-token and --leo-token must be provided." >&2
  exit 1
fi

if [[ -n "$IMAGE_PATH" && ! -f "$IMAGE_PATH" ]]; then
  echo "Image path does not exist: $IMAGE_PATH" >&2
  exit 1
fi

echo "=== Signing up Matt ==="
curl -sS "$API_BASE/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"idToken\":\"$MATT_TOKEN\"}" | jq .

echo "=== Signing in Matt ==="
MATT_JWT=$(
  curl -sS "$API_BASE/auth/signin" \
    -H "Content-Type: application/json" \
    -d "{\"idToken\":\"$MATT_TOKEN\"}" | jq -r '.data.token'
)
echo "Matt JWT acquired"

echo "=== Signing up Leo ==="
curl -sS "$API_BASE/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"idToken\":\"$LEO_TOKEN\"}" | jq .

echo "=== Signing in Leo ==="
LEO_JWT=$(
  curl -sS "$API_BASE/auth/signin" \
    -H "Content-Type: application/json" \
    -d "{\"idToken\":\"$LEO_TOKEN\"}" | jq -r '.data.token'
)
echo "Leo JWT acquired"

echo "=== Fetching Matt profile ==="
curl -sS "$API_BASE/user/profile" \
  -H "Authorization: Bearer $MATT_JWT" | jq .

echo "=== Matt creates a catalog ==="
CATALOG_ID=$(
  curl -sS "$API_BASE/catalogs" \
    -H "Authorization: Bearer $MATT_JWT" \
    -H "Content-Type: application/json" \
    -d '{"name":"Spring Migration","description":"Test catalog"}' | jq -r '.data.catalog._id'
)
echo "Catalog created: $CATALOG_ID"

ENTRY_ID=""
if [[ -n "$IMAGE_PATH" ]]; then
  echo "=== Running recognition save (with image $IMAGE_PATH) ==="
  ENTRY_ID=$(
    curl -sS "$API_BASE/recognition/save" \
      -H "Authorization: Bearer $MATT_JWT" \
      -F "image=@${IMAGE_PATH}" \
      | jq -r '.data.entry._id'
  )
else
  echo "=== Skipping recognition save (no image provided) ==="
fi

if [[ -z "$ENTRY_ID" ]]; then
  echo "No entry ID available. Create an entry first (e.g., via /api/recognition/save) before linking."
else
  echo "=== Linking entry to catalog ==="
  curl -sS "$API_BASE/catalogs/$CATALOG_ID/entries/$ENTRY_ID" \
    -X POST \
    -H "Authorization: Bearer $MATT_JWT" | jq .
fi

echo "=== Matt shares catalog with Leo as editor ==="
INVITATION_ID=$(
  curl -sS "$API_BASE/catalogs/$CATALOG_ID/share" \
    -H "Authorization: Bearer $MATT_JWT" \
    -H "Content-Type: application/json" \
    -d "{\"inviteeId\": \"$(jq -r '.data.user._id' <<< "$(curl -sS "$API_BASE/user/profile" -H "Authorization: Bearer $LEO_JWT")")\", \"role\": \"editor\"}" \
    | jq -r '.data.invitation._id'
)
echo "Invitation created: $INVITATION_ID"

echo "=== Leo accepts the invitation ==="
curl -sS "$API_BASE/catalogs/share/$INVITATION_ID/respond" \
  -X PATCH \
  -H "Authorization: Bearer $LEO_JWT" \
  -H "Content-Type: application/json" \
  -d '{"action":"accept"}' | jq .

echo "=== Leo lists shared catalogs ==="
curl -sS "$API_BASE/catalogs/shared-with/me" \
  -H "Authorization: Bearer $LEO_JWT" | jq .

echo "=== Matt lists friends (should be empty unless earlier tests ran) ==="
curl -sS "$API_BASE/friends" \
  -H "Authorization: Bearer $MATT_JWT" | jq .

echo "=== Smoke test complete ==="
