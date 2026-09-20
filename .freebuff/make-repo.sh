#!/usr/bin/env bash
set -euo pipefail
TOKEN_FILE=".freebuff/github-pat.txt"
USERNAME=""
REPO="phyton-exus"
DESCRIPTION="PHYTONEXUS — open, hardware-agnostic web platform for botanical extraction monitoring and control (ideathon prototype). Live demo: virtual + hardware demonstration, simulation engine, sensor profiles, threshold sliders."

if [ ! -f "$TOKEN_FILE" ]; then
  echo "ERROR: $TOKEN_FILE not found" >&2
  exit 2
fi
TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
if [ -z "$TOKEN" ]; then
  echo "ERROR: token file empty" >&2
  exit 2
fi

# Determine github username from the token via the API (if no USERNAME given)
if [ -z "$USERNAME" ]; then
  USERNAME=$(curl -s -H "Authorization: token ${TOKEN}" "https://api.github.com/user" | python -c "import sys,json; print(json.load(sys.stdin)['login'])")
  echo "Authenticated as: $USERNAME"
fi

# Create the repository if it does not already exist
RESP=$(curl -s -X POST -H "Authorization: token ${TOKEN}" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/user/repos" \
  -d "{\"name\":\"$REPO\",\"description\":\"$DESCRIPTION\",\"private\":false,\"has_issues\":true,\"has_projects\":false,\"has_wiki\":false,\"auto_init\":false}")

REPO_URL=$(echo "$RESP" | python -c "import sys,json; print(json.load(sys.stdin).get('clone_url',''))" 2>/dev/null || true)
if [ -z "$REPO_URL" ]; then
  # Likely already exists -> fetch its clone url
  echo "Repo creation response unexpected or repo already exists; fetching repo info..."
  INFO=$(curl -s -H "Authorization: token ${TOKEN}" -H "Accept: application/vnd.github+json" "https://api.github.com/repos/$USERNAME/$REPO")
  REPO_URL=$(echo "$INFO" | python -c "import sys,json; print(json.load(sys.stdin).get('clone_url',''))" 2>/dev/null || true)
fi

if [ -z "$REPO_URL" ]; then
  echo "ERROR: could not determine repo clone URL. API response:" >&2
  echo "$RESP" >&2
  exit 3
fi

echo "Repo URL: $REPO_URL"
echo "$REPO_URL" > .freebuff/phyton-exus-remote.txt
