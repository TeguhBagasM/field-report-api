#!/usr/bin/env bash
# Smoke test end-to-end untuk backend Field Report Management.
# Hanya memakai bash + curl (tanpa dependency tambahan).
# Cara pakai: ./scripts/smoke-test.sh [BASE_URL]
#   Contoh: ./scripts/smoke-test.sh http://localhost:4000

BASE="${1:-http://localhost:4000}"
PASS=0
FAIL=0
SUFFIX=$(date +%s)

BODY=""
CODE=""

pass() { PASS=$((PASS + 1)); echo "PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); echo "FAIL: $1"; }

expect_code() {
  # expect_code <nama> <harap>
  if [ "$CODE" = "$2" ]; then
    pass "$1 (HTTP $CODE)"
  else
    fail "$1 (harap HTTP $2, dapat HTTP $CODE) -- $BODY"
  fi
}

expect_contains() {
  # expect_contains <nama> <substring>
  case "$BODY" in
    *"$2"*) pass "$1" ;;
    *) fail "$1 (tidak mengandung '$2') -- $BODY" ;;
  esac
}

call() {
  # call <METHOD> <PATH> [TOKEN] [DATA]
  local method="$1" path="$2" token="${3:-}" data="${4:-}"
  local out
  if [ -n "$data" ]; then
    out=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE$path" \
      -H "Content-Type: application/json" \
      ${token:+-H "Authorization: Bearer $token"} \
      -d "$data")
  else
    out=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE$path" \
      ${token:+-H "Authorization: Bearer $token"})
  fi
  CODE=$(printf '%s\n' "$out" | tail -n 1)
  BODY=$(printf '%s\n' "$out" | sed '$d')
}

token_of() { printf '%s' "$1" | grep -o '"token":"[^"]*"' | cut -d'"' -f4; }
id_of() { printf '%s' "$1" | grep -o '"id":[0-9]*' | head -n 1 | cut -d: -f2; }
count_of() { printf '%s' "$1" | grep -o "$2" | wc -l | tr -d ' '; }

login_as() {
  # login_as <email> <password> -> token di $LOGIN_TOKEN, respons di $BODY/$CODE
  # (tidak via $(...) agar variabel CODE/BODY tidak hilang di subshell)
  call POST /api/auth/login "" "{\"email\":\"$1\",\"password\":\"$2\"}"
  LOGIN_TOKEN=$(token_of "$BODY")
}

check_login() {
  # check_login <nama> <token>
  if [ "$CODE" = "200" ] && [ -n "$2" ]; then
    pass "login $1"
  else
    fail "login $1 -- $BODY"
  fi
}

echo "== Smoke test ke $BASE =="

# 1. Login keempat akun demo
login_as "admin@demo.com" "Admin123!"; ADMIN=$LOGIN_TOKEN; check_login "admin" "$ADMIN"
login_as "pelapor1@demo.com" "Pelapor123!"; P1=$LOGIN_TOKEN; check_login "pelapor1" "$P1"
login_as "pelapor2@demo.com" "Pelapor123!"; P2=$LOGIN_TOKEN; check_login "pelapor2" "$P2"
login_as "approver@demo.com" "Approver123!"; AP=$LOGIN_TOKEN; check_login "approver" "$AP"

# 2. Pelapor1 buat laporan
call POST /api/reports "$P1" "{\"name\":\"Smoke jalan rusak $SUFFIX\",\"description\":\"Lubang besar untuk uji smoke test.\"}"
expect_code "pelapor1 buat laporan" "201"
expect_contains "laporan baru berstatus pending" '"status":"pending"'
RID=$(id_of "$BODY")
if [ -n "$RID" ]; then pass "id laporan tertangkap ($RID)"; else fail "id laporan tertangkap"; fi

# 3. Pelapor2 tidak bisa melihat laporan pelapor1
call GET "/api/reports/$RID" "$P2"
expect_code "pelapor2 tidak bisa melihat milik pelapor1" "404"

# 4-6. Approver: approve -> reject -> approve
call PATCH "/api/reports/$RID/status" "$AP" '{"status":"approved","note":"Smoke: setuju tahap 1"}'
expect_code "approver approve" "200"
expect_contains "status menjadi approved" '"status":"approved"'

call PATCH "/api/reports/$RID/status" "$AP" '{"status":"rejected","note":"Smoke: koreksi, tolak dulu"}'
expect_code "approver reject (balik keputusan)" "200"
expect_contains "status menjadi rejected" '"status":"rejected"'

call PATCH "/api/reports/$RID/status" "$AP" '{"status":"approved","note":"Smoke: setuju final"}'
expect_code "approver approve lagi (balik keputusan)" "200"

call GET "/api/reports/$RID" "$AP"
expect_code "detail laporan bisa dibaca approver" "200"
# Jumlah approval = kemunculan "approver" di dalam array approvals
# (lastDecision ikut punya field approver, jadi harus dipotong dulu).
APPROVALS=$(printf '%s' "$BODY" | sed 's/.*"approvals"://; s/\}$//')
[ "$(count_of "$APPROVALS" '"approver"')" = "3" ] && pass "riwayat tepat 3 baris" || fail "riwayat tepat 3 baris -- $BODY"
expect_contains "riwayat memuat nama approver" '"name":"Approver"'
# Kemunculan "decision" pertama milik lastDecision (key order JSON).
FIRST_DECISION=$(printf '%s' "$BODY" | grep -o '"decision":"[a-z]*"' | head -n 1)
[ "$FIRST_DECISION" = '"decision":"approved"' ] && pass "keputusan terakhir approved" || fail "keputusan terakhir approved (dapat $FIRST_DECISION)"

# 7. Status sama dua kali berturut-turut -> 409
call PATCH "/api/reports/$RID/status" "$AP" '{"status":"approved"}'
expect_code "approve dua kali berturut-turut ditolak" "409"
expect_contains "pesan status sama" "sudah berstatus approved"

# 8. Pelapor edit setelah approved -> 409
call PUT "/api/reports/$RID" "$P1" '{"name":"Diubah","description":"Coba edit setelah approved."}'
expect_code "pelapor edit setelah approved ditolak" "409"

# 9. Pelapor mencoba PATCH status -> 403
call PATCH "/api/reports/$RID/status" "$P1" '{"status":"rejected"}'
expect_code "pelapor PATCH status ditolak" "403"

# 10. Admin buat user baru lalu user itu login
SMOKE_EMAIL="smoke$SUFFIX@demo.com"
call POST /api/users "$ADMIN" "{\"name\":\"Smoke User\",\"email\":\"$SMOKE_EMAIL\",\"password\":\"Smoke123!\",\"role\":\"pelapor\"}"
expect_code "admin buat user baru" "201"
expect_contains "user baru tanpa password_hash" "\"email\":\"$SMOKE_EMAIL\""
case "$BODY" in
  *password_hash*|*passwordHash*) fail "user baru tanpa password_hash (hash bocor)" ;;
  *) pass "user baru tanpa password_hash" ;;
esac

call POST /api/auth/login "" "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"Smoke123!\"}"
expect_code "user baru bisa login" "200"

# 11. Dashboard summary untuk keempat role
num_after() { # num_after <body> <key> -> angka pertama setelah "key":
  printf '%s' "$1" | grep -o "\"$2\":[0-9]*" | head -n 1 | cut -d: -f2
}

call GET /api/dashboard/summary
expect_code "dashboard tanpa token ditolak" "401"

call GET /api/dashboard/summary "$P1"
expect_code "dashboard pelapor1" "200"
P1_TOTALS=$(printf '%s' "$BODY" | sed 's/.*"totals"://; s/,"trend".*//')
P1_TOTAL=$(num_after "$P1_TOTALS" total)
[ "$P1_TOTAL" = "$(($(num_after "$P1_TOTALS" pending) + $(num_after "$P1_TOTALS" approved) + $(num_after "$P1_TOTALS" rejected)))" ] \
  && pass "totals pelapor1 konsisten" || fail "totals pelapor1 konsisten -- $P1_TOTALS"
expect_contains "pelapor1 awaiting null" '"awaiting":null'
expect_contains "pelapor1 myDecisions null" '"myDecisions":null'
expect_contains "pelapor1 users null" '"users":null'
[ "$(count_of "$BODY" '"date":"')" = "7" ] && pass "trend 7 hari" || fail "trend 7 hari -- $BODY"
P1_RECENT=$(printf '%s' "$BODY" | sed 's/.*"recent"://; s/,"awaiting".*//')
[ "$(count_of "$P1_RECENT" '"reporter":')" -le 5 ] && pass "recent maksimal 5" || fail "recent maksimal 5 -- $BODY"

call GET /api/dashboard/summary "$P2"
expect_code "dashboard pelapor2" "200"
P2_TOTALS=$(printf '%s' "$BODY" | sed 's/.*"totals"://; s/,"trend".*//')
P2_TOTAL=$(num_after "$P2_TOTALS" total)
[ "$P2_TOTAL" = "$(($(num_after "$P2_TOTALS" pending) + $(num_after "$P2_TOTALS" approved) + $(num_after "$P2_TOTALS" rejected)))" ] \
  && pass "totals pelapor2 konsisten" || fail "totals pelapor2 konsisten -- $P2_TOTALS"
expect_contains "pelapor2 awaiting null" '"awaiting":null'

call GET /api/dashboard/summary "$AP"
expect_code "dashboard approver" "200"
case "$BODY" in
  *'"awaiting":null'*) fail "awaiting approver terisi" ;;
  *) pass "awaiting approver terisi" ;;
esac
AP_AWAITING=$(printf '%s' "$BODY" | sed 's/.*"awaiting"://; s/,"myDecisions".*//')
case "$AP_AWAITING" in
  *'"status":"approved"'*|*'"status":"rejected"'*) fail "awaiting hanya berisi pending" ;;
  *) pass "awaiting hanya berisi pending" ;;
esac
AP_MD=$(printf '%s' "$BODY" | sed 's/.*"myDecisions"://; s/,"users".*//')
[ "$(num_after "$AP_MD" total)" -ge 3 ] && pass "myDecisions approver >= 3" || fail "myDecisions approver >= 3 -- $AP_MD"
expect_contains "approver users null" '"users":null'
AP_TOTAL=$(num_after "$(printf '%s' "$BODY" | sed 's/.*"totals"://; s/,"trend".*//')" total)
[ "$AP_TOTAL" -gt "$P1_TOTAL" ] && pass "approver melihat lebih banyak dari pelapor ($AP_TOTAL > $P1_TOTAL)" \
  || fail "approver melihat lebih banyak dari pelapor ($AP_TOTAL vs $P1_TOTAL)"

call GET /api/dashboard/summary "$ADMIN"
expect_code "dashboard admin" "200"
expect_contains "admin users terisi" '"byRole"'
AD_USERS=$(printf '%s' "$BODY" | sed 's/.*"users"://; s/\}$//')
[ "$(num_after "$AD_USERS" total)" = "$(($(num_after "$AD_USERS" active) + $(num_after "$AD_USERS" inactive)))" ] \
  && pass "users total konsisten" || fail "users total konsisten -- $AD_USERS"
expect_contains "admin awaiting null" '"awaiting":null'
expect_contains "admin myDecisions null" '"myDecisions":null'

echo "------------------------------"
echo "Hasil: $PASS PASS, $FAIL FAIL"
[ "$FAIL" -eq 0 ]
