#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -x .venv-asr/bin/python ]]; then
  echo "Missing .venv-asr. Run scripts/setup-local-qwen-asr.sh first." >&2
  exit 1
fi

exec .venv-asr/bin/python local-asr/qwen3_asr_ws.py --host "${QWEN_ASR_HOST:-127.0.0.1}" --port "${QWEN_ASR_PORT:-8766}"
