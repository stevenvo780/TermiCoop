#!/bin/bash

# Configuration
NEXUS_PORT=3003
NEXUS_URL="http://localhost:$NEXUS_PORT"
TEST_DIR="./nexus_test_data"
DB_PATH="$TEST_DIR/nexus.db"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "--- Starting Worker Sharing Verification ---"

# 1. Setup Environment
echo "Cleaning up previous test artifacts..."
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"

# Cleanup function
cleanup() {
  echo "Cleaning up..."
  if [ -n "$NEXUS_PID" ]; then kill $NEXUS_PID 2>/dev/null; fi
  if [ -n "$WORKER_A_PID" ]; then kill $WORKER_A_PID 2>/dev/null; fi
  if [ -n "$WORKER_B_PID" ]; then kill $WORKER_B_PID 2>/dev/null; fi
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

# Start Nexus
echo "Starting Nexus on port $NEXUS_PORT..."
export PORT=$NEXUS_PORT
export NEXUS_DATA_DIR="$(pwd)/$TEST_DIR"
export DATABASE_URL="" # Force SQLite
export NEXUS_SETUP_TOKEN="secret-setup-token"

# Run nexus in background
nohup npm run start --workspace=nexus > nexus.log 2>&1 &
NEXUS_PID=$!
echo "Nexus PID: $NEXUS_PID"

# Wait for Nexus to be ready
echo "Waiting for Nexus to start..."
MAX_RETRIES=20
COUNT=0
URL_READY=0
while [ $COUNT -lt $MAX_RETRIES ]; do
  sleep 1
  if curl -s "$NEXUS_URL/api/auth/status" | grep -q 'status'; then
    URL_READY=1
    break
  fi
  echo -n "."
  COUNT=$((COUNT+1))
done
echo ""

if [ $URL_READY -eq 0 ]; then
  echo -e "${RED}Nexus failed to start. Check nexus.log${NC}"
  exit 1
fi
echo "Nexus is ready."

# 3. Create Users
echo "Creating User A..."
# First run setup to create admin (User A)
SETUP_RES=$(curl -s -X POST "$NEXUS_URL/api/auth/setup" \
  -H "Content-Type: application/json" \
  -d '{"password":"password123", "setupToken":"secret-setup-token"}')
# Check for success (token or success message)
if echo "$SETUP_RES" | grep -q "error"; then
    echo -e "${RED}Setup failed: $SETUP_RES${NC}"
    exit 1
fi

# Login User A
LOGIN_A=$(curl -s -X POST "$NEXUS_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin", "password":"password123"}')
TOKEN_A=$(echo "$LOGIN_A" | grep -o 'token":"[^"]*' | cut -d'"' -f3)

if [ -z "$TOKEN_A" ]; then
    echo -e "${RED}Login A failed: $LOGIN_A${NC}"
    exit 1
fi
echo "User A Logged in."

echo "Creating User B..."
REGISTER_B=$(curl -s -X POST "$NEXUS_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"user_b", "password":"password123", "setupToken":"secret-setup-token"}')

if echo "$REGISTER_B" | grep -q "error"; then
    echo -e "${RED}Register B failed: $REGISTER_B${NC}"
    exit 1
fi

# Login User B
LOGIN_B=$(curl -s -X POST "$NEXUS_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"user_b", "password":"password123"}')
TOKEN_B=$(echo "$LOGIN_B" | grep -o 'token":"[^"]*' | cut -d'"' -f3)

if [ -z "$TOKEN_B" ]; then
    echo -e "${RED}Login B failed: $LOGIN_B${NC}"
    exit 1
fi
echo "User B Logged in."

# 4. Create Workers
echo "Creating Worker A for User A..."
WORKER_A_RES=$(curl -s -X POST "$NEXUS_URL/api/workers" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"name":"Worker A"}')
WORKER_A_ID=$(echo "$WORKER_A_RES" | grep -o 'id":"[^"]*' | cut -d'"' -f3)
API_KEY_A=$(echo "$WORKER_A_RES" | grep -o 'api_key":"[^"]*' | cut -d'"' -f3)

if [ -z "$WORKER_A_ID" ]; then
    echo -e "${RED}Failed to create Worker A: $WORKER_A_RES${NC}"
    exit 1
fi
echo "Worker A Created: $WORKER_A_ID"

echo "Creating Worker B for User B..."
WORKER_B_RES=$(curl -s -X POST "$NEXUS_URL/api/workers" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H "Content-Type: application/json" \
  -d '{"name":"Worker B"}')
WORKER_B_ID=$(echo "$WORKER_B_RES" | grep -o 'id":"[^"]*' | cut -d'"' -f3)
API_KEY_B=$(echo "$WORKER_B_RES" | grep -o 'api_key":"[^"]*' | cut -d'"' -f3)

if [ -z "$WORKER_B_ID" ]; then
    echo -e "${RED}Failed to create Worker B: $WORKER_B_RES${NC}"
    exit 1
fi
echo "Worker B Created: $WORKER_B_ID"

# 5. Start Workers
echo "Starting Worker A process..."
export NEXUS_URL="$NEXUS_URL"
export API_KEY="$API_KEY_A"
export WORKER_NAME="worker-a-process"
# We need to run these in separate subshells to isolate env vars or just set them for the command
(API_KEY="$API_KEY_A" WORKER_NAME="worker-a-process" nohup npm run start:worker > worker_a.log 2>&1 & echo $! > worker_a.pid)
WORKER_A_PID=$(cat worker_a.pid) && rm worker_a.pid

echo "Starting Worker B process..."
(API_KEY="$API_KEY_B" WORKER_NAME="worker-b-process" nohup npm run start:worker > worker_b.log 2>&1 & echo $! > worker_b.pid)
WORKER_B_PID=$(cat worker_b.pid) && rm worker_b.pid

echo "Waiting for workers to connect..."
sleep 10

# 6. Share Worker A with User B
echo "Sharing Worker A with User B..."
SHARE_RES=$(curl -s -X POST "$NEXUS_URL/api/workers/share" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d "{\"workerId\":\"$WORKER_A_ID\", \"targetUsername\":\"user_b\", \"permission\":\"view\"}")

if echo "$SHARE_RES" | grep -q "error"; then
    echo -e "${RED}Share failed: $SHARE_RES${NC}"
    exit 1
fi
echo "Share Result: Success"

# 7. Verify Visibility
echo "User B checking worker list..."
LIST_B=$(curl -s -X GET "$NEXUS_URL/api/workers" \
  -H "Authorization: Bearer $TOKEN_B")

if echo "$LIST_B" | grep -q "$WORKER_A_ID"; then
  echo -e "${GREEN}SUCCESS: User B can see Worker A!${NC}"
else
  echo -e "${RED}FAILURE: User B cannot see Worker A${NC}"
  echo "List Content: $LIST_B"
  exit 1
fi

exit 0
