#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  if [[ -x /opt/homebrew/opt/python@3.13/bin/python3.13 ]]; then
    PYTHON_BIN="/opt/homebrew/opt/python@3.13/bin/python3.13"
  elif command -v python3.13 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3.13)"
  else
    PYTHON_BIN="$(command -v python3)"
  fi
fi

echo "Using Python: $PYTHON_BIN"
"$PYTHON_BIN" -m venv .venv-asr
.venv-asr/bin/python -m pip install -U pip wheel setuptools
.venv-asr/bin/pip install -r local-asr/requirements.txt

echo
echo "Local Qwen3-ASR environment is ready."
echo "Start it with: scripts/start-local-qwen-asr.sh"
