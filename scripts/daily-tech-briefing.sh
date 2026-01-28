#!/bin/bash
# Daily Tech & AI Briefing for Tomer

# Configuration
WORKSPACE="/home/ubuntu/clawd"
LOG_FILE="$WORKSPACE/logs/daily-briefing.log"
SUMMARY_FILE="$WORKSPACE/scripts/briefing-summary.txt"

# RSS Feeds
RSS_FEEDS=(
  "https://hnrss.org/frontpage"  # Hacker News
  "https://techcrunch.com/feed/"  # TechCrunch
  "https://www.theverge.com/rss/index.xml"  # The Verge
  "https://feeds.arstechnica.com/arstechnica/index"  # Ars Technica
  "https://feeds.a.dj.com/rss/RSSMarketsMain.xml"  # WSJ Tech Markets
)

# Keywords for filtering (AI and tech)
KEYWORDS="AI|artificial intelligence|machine learning|LLM|GPT|model|neural|deep learning|startup|funding|IPO|launch|release|breakthrough|research|paper"

# Create directories
mkdir -p "$WORKSPACE/logs"

# Fetch and process RSS
{
  echo "=== Daily Tech & AI Briefing ==="
  echo "Date: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo ""
  echo "## Key Stories"
  echo ""

  for feed in "${RSS_FEEDS[@]}"; do
    echo "### $feed"
    curl -sL --max-time 30 "$feed" | \
      grep -Ei "<title>|<description>|<link>" | \
      sed -E 's/<[^>]*>//g' | \
      grep -Ei "$KEYWORDS" | \
      head -20
    echo ""
  done

} > "$SUMMARY_FILE" 2>>"$LOG_FILE"

# Log completion
echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Daily briefing generated" >> "$LOG_FILE"
