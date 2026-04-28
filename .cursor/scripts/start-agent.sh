#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VENV_DIR="$ROOT_DIR/backend/.venv"
VENV_PY="$VENV_DIR/bin/python"

echo "[cloud-agent-bootstrap] preparing BillboardHub dependencies..."

if command -v npm >/dev/null 2>&1; then
  echo "[cloud-agent-bootstrap] npm ci"
  npm ci --prefix "$ROOT_DIR"
else
  echo "[cloud-agent-bootstrap] npm not found; skipping Node dependency install"
fi

if command -v python3 >/dev/null 2>&1; then
  echo "[cloud-agent-bootstrap] creating backend virtualenv"
  python3 -m venv "$VENV_DIR" || true

  echo "[cloud-agent-bootstrap] ensuring backend/.venv/bin/python wrapper"
  mkdir -p "$VENV_DIR/bin"
  cat >"$VENV_PY" <<'PYWRAP'
#!/usr/bin/env bash
set -euo pipefail
exec python3 "$@"
PYWRAP
  chmod +x "$VENV_PY"

  echo "[cloud-agent-bootstrap] installing backend Python requirements"
  "$VENV_PY" -m pip install --user -r "$ROOT_DIR/backend/requirements.txt"
else
  echo "[cloud-agent-bootstrap] python3 not found; skipping backend dependency install"
fi

echo "[cloud-agent-bootstrap] environment bootstrap complete"
