#!/bin/bash
# Secret guard: blokir commit yang mengandung pola secret umum.
# Contoh pola: AWS key, GitHub token, Slack token, Stripe live key, private key.
# Lewati (bila false positive): SKIP_SECRET_GUARD=1 git commit
[ -n "${SKIP_SECRET_GUARD:-}" ] && exit 0

PATTERNS=(
  'AKIA[0-9A-Z]{16}'
  'ghp_[A-Za-z0-9]{36,}'
  'gho_[A-Za-z0-9]{36,}'
  'github_pat_[A-Za-z0-9_]{22,}'
  'xox[bap]-[A-Za-z0-9-]+'
  'sk_live_[A-Za-z0-9]+'
  'BEGIN (RSA )?PRIVATE KEY'
)

found=0
STAGED="$(git diff --cached -U0 || true)"
for p in "${PATTERNS[@]}"; do
  if printf '%s' "$STAGED" | grep -Eq "$p"; then
    echo "BLOCKED: pola secret terdeteksi: $p"
    found=1
  fi
done

# pola key = "value" (abaikan baris contoh/placeholder)
if printf '%s' "$STAGED" | grep -Eq "(api[_-]?key|secret|password).{0,5}[\"'][A-Za-z0-9_.@-]{12,}"; then
  if ! printf '%s' "$STAGED" | grep -Eiq "(example|placeholder|xxx|your[_-]?key|changeme|<isi)"; then
    echo 'BLOCKED: kemungkinan kredensial (key = "value") terdeteksi'
    found=1
  fi
fi

if [ "$found" -eq 1 ]; then
  echo 'Batalkan commit. False positive? Ulangi dengan: SKIP_SECRET_GUARD=1 git commit'
  exit 1
fi
exit 0
