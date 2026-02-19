#!/bin/bash
# Run the RETRO FURY AI bot and monitor its progress
# Writes to AGENT_PLAY_LOG.md and AGENT_GAME_STRATEGY.md

BROWSER=/Users/ben.civjan/.local/share/uv/tools/browser-cli/bin/browser
TAB=$1
LOG_FILE="AGENT_PLAY_LOG.md"
STRATEGY_FILE="AGENT_GAME_STRATEGY.md"
POLL_INTERVAL=10
MAX_RUNS=100

if [ -z "$TAB" ]; then
    echo "Usage: $0 <tab_id>"
    exit 1
fi

# Inject bot
echo "Injecting bot..."
$BROWSER eval "const s=document.createElement('script');s.src='/bot.js?v=3&t='+Date.now();document.head.appendChild(s);'ok';" --tab $TAB 2>/dev/null

sleep 3

echo "Bot running. Monitoring..."

PREV_RUN=0
BEST_LEVEL=0

while true; do
    sleep $POLL_INTERVAL

    # Read status
    STATUS=$($BROWSER eval "
    try {
        JSON.stringify(window.__AGENT_STATUS || {});
    } catch(e) { '{}'; }
    " --tab $TAB 2>/dev/null)

    if [ -z "$STATUS" ]; then
        echo "Failed to read status, retrying..."
        continue
    fi

    # Parse status
    WON=$(echo "$STATUS" | python3 -c "import sys,json; d=json.loads(json.load(sys.stdin)); print(d.get('won',False))" 2>/dev/null)
    RUN=$(echo "$STATUS" | python3 -c "import sys,json; d=json.loads(json.load(sys.stdin)); print(d.get('run',0))" 2>/dev/null)
    STATUS_TYPE=$(echo "$STATUS" | python3 -c "import sys,json; d=json.loads(json.load(sys.stdin)); print(d.get('status',''))" 2>/dev/null)
    LEVEL=$(echo "$STATUS" | python3 -c "import sys,json; d=json.loads(json.load(sys.stdin)); print(d.get('level',0))" 2>/dev/null)
    BEST=$(echo "$STATUS" | python3 -c "import sys,json; d=json.loads(json.load(sys.stdin)); bl=d.get('bestRun',{}); print(bl.get('level',0))" 2>/dev/null)

    echo "Status: $STATUS_TYPE | Run: $RUN | Level: $LEVEL | Best: $BEST"

    if [ "$WON" = "True" ]; then
        echo "VICTORY! Bot completed all 5 levels!"
        break
    fi

    if [ "$RUN" -gt "$MAX_RUNS" ] 2>/dev/null; then
        echo "Max runs reached ($MAX_RUNS). Stopping."
        break
    fi
done

echo "Done monitoring."
