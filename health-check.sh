#!/bin/bash
# Mission Control Health Check Script
# Called by cron, reports issues to Mission Control notification API

MC_URL="http://127.0.0.1:3080"
CHECKS='[]'

check() {
  local name="$1" cmd="$2"
  if eval "$cmd" > /dev/null 2>&1; then
    CHECKS=$(echo "$CHECKS" | python3 -c "import sys,json; c=json.load(sys.stdin); c.append({'name':'$name','ok':True}); print(json.dumps(c))")
  else
    CHECKS=$(echo "$CHECKS" | python3 -c "import sys,json; c=json.load(sys.stdin); c.append({'name':'$name','ok':False,'error':'check failed'}); print(json.dumps(c))")
  fi
}

# Core services
check "Gateway" "systemctl is-active openclaw-gateway"
check "Mission Control" "curl -sf http://127.0.0.1:3080/ > /dev/null"
check "Cloudflared" "systemctl is-active cloudflared"
check "PostgreSQL" "systemctl is-active postgresql"

# Docker containers
for container in uptime-kuma n8n code-server redis pgadmin chrome-vnc stirling-pdf; do
  check "Docker:$container" "docker inspect -f '{{.State.Running}}' $container 2>/dev/null | grep -q true"
done

# Port checks
check "Grafana:3002" "curl -sf http://127.0.0.1:3002/api/health > /dev/null"
check "Prometheus:9090" "curl -sf http://127.0.0.1:9090/-/healthy > /dev/null"

# Memory check (warn if available < 500MB)
AVAIL_MB=$(free -m | awk '/^Mem:/{print $7}')
if [ "$AVAIL_MB" -lt 500 ]; then
  CHECKS=$(echo "$CHECKS" | python3 -c "import sys,json; c=json.load(sys.stdin); c.append({'name':'Memory','ok':False,'error':'Available: ${AVAIL_MB}MB (<500MB)'}); print(json.dumps(c))")
else
  CHECKS=$(echo "$CHECKS" | python3 -c "import sys,json; c=json.load(sys.stdin); c.append({'name':'Memory','ok':True}); print(json.dumps(c))")
fi

# Disk check (warn if usage > 90%)
DISK_PCT=$(df / | awk 'NR==2{print int($5)}')
if [ "$DISK_PCT" -gt 90 ]; then
  CHECKS=$(echo "$CHECKS" | python3 -c "import sys,json; c=json.load(sys.stdin); c.append({'name':'Disk','ok':False,'error':'Usage: ${DISK_PCT}% (>90%)'}); print(json.dumps(c))")
else
  CHECKS=$(echo "$CHECKS" | python3 -c "import sys,json; c=json.load(sys.stdin); c.append({'name':'Disk','ok':True}); print(json.dumps(c))")
fi

# Report to Mission Control
curl -sf -X POST "$MC_URL/api/health-report" \
  -H "Content-Type: application/json" \
  -d "{\"checks\": $CHECKS}" > /dev/null 2>&1

# Print summary
FAILED=$(echo "$CHECKS" | python3 -c "import sys,json; c=json.load(sys.stdin); print(len([x for x in c if not x['ok']]))")
TOTAL=$(echo "$CHECKS" | python3 -c "import sys,json; c=json.load(sys.stdin); print(len(c))")
echo "Health check: $TOTAL checks, $FAILED failed"
