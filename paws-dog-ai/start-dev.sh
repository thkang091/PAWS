#!/usr/bin/env bash
# Start the PAWS AI backend in development mock mode.
# Run from the paws-dog-ai directory:
#   chmod +x start-dev.sh
#   ./start-dev.sh

set -e
cd "$(dirname "$0")"

# Load backend .env safely — trims spaces, skips comments and blank lines.
if [ -f .env ]; then
  while IFS= read -r line; do
    # Skip blank lines and comments
    [[ -z "$line" || "$line" == \#* ]] && continue
    # Trim leading/trailing whitespace from the whole line
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    # Skip if still empty after trim
    [[ -z "$line" ]] && continue
    # Split on first '=' only
    key="${line%%=*}"
    val="${line#*=}"
    # Trim whitespace from key and value
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    # Only export if key is a valid shell identifier
    if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      export "$key=$val"
    fi
  done < .env
fi

# Force mock mode so DeepLabCut is not required
export DOG_AI_ENABLE_MOCK_MODE=true

# Detect local IP (works on macOS and Linux)
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null \
  || ipconfig getifaddr en1 2>/dev/null \
  || hostname -I 2>/dev/null | awk '{print $1}' \
  || echo "localhost")

echo ""
echo "PAWS AI backend starting (mock mode)"
echo "Backend URL for Expo:  http://${LOCAL_IP}:8000"
echo "Make sure .env has:    EXPO_PUBLIC_DOG_AI_BASE_URL=http://${LOCAL_IP}:8000"
echo ""

/Users/taehoonkang/.pyenv/versions/okc/bin/uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload
