#!/usr/bin/env bash
# Start the PAWS AI backend in REAL inference mode.
# Requires DeepLabCut + PyTorch installed and the ML artifacts present.
# Run from the paws-dog-ai directory:
#   chmod +x start-real.sh
#   ./start-real.sh

set -e
cd "$(dirname "$0")"

# Load backend .env safely — trims spaces, skips comments and blank lines.
if [ -f .env ]; then
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      export "$key=$val"
    fi
  done < .env
fi

# Real mode: do NOT set DOG_AI_ENABLE_MOCK_MODE
export DOG_AI_ENABLE_MOCK_MODE=false

LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null \
  || ipconfig getifaddr en1 2>/dev/null \
  || hostname -I 2>/dev/null | awk '{print $1}' \
  || echo "localhost")

echo ""
echo "PAWS AI backend starting (REAL inference mode)"
echo "DeepLabCut + PyTorch must be installed."
echo "Backend URL for Expo:  http://${LOCAL_IP}:8000"
echo "Make sure .env has:    EXPO_PUBLIC_DOG_AI_BASE_URL=http://${LOCAL_IP}:8000"
echo ""
echo "If DeepLabCut is missing, the backend will return errors for /analyze/activity."
echo "Use ./start-dev.sh for mock mode."
echo ""

# Use system Python 3.12 where PyTorch and DeepLabCut are installed.
# (The okc pyenv env only has numpy + opencv and is used for mock mode.)
/Library/Frameworks/Python.framework/Versions/3.12/bin/uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload
