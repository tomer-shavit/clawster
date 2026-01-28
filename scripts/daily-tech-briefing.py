#!/usr/bin/env python3
"""
Daily AI & Startup Briefing for Tomer
Fetches RSS feeds and summarizes key stories
"""

import xml.etree.ElementTree as ET
import urllib.request
import subprocess
from datetime import datetime
from typing import List, Dict

# RSS Feeds - AI Research, VC, Startups (focused on Tomer's interests)
RSS_FEEDS = [
    ("Hacker News", "https://hnrss.org/frontpage"),
    ("TechCrunch", "https://techcrunch.com/feed/"),
    ("The Verge", "https://www.theverge.com/rss/index.xml"),
    ("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index"),
    # AI Research Papers (no ads, pure research)
    ("Hugging Face", "https://huggingface.co/blog/feed.xml"),
    ("Google AI Blog", "https://blog.google/technology/ai/rss/"),
    ("Distill", "https://distill.pub/rss.xml"),
    # VC & Startups
    ("VentureBeat", "https://venturebeat.com/feed"),
    ("Product Hunt", "https://www.producthunt.com/feed"),
    # AI News
    ("AI News", "https://artificialintelligence-news.com/feed"),
]

# Keywords for filtering (Tomer's interests - strict focus)
AI_KEYWORDS = [
    "artificial intelligence", "machine learning", "LLM", "chatgpt", "claude",
    "anthropic", "openai", "google ai", "gemini", "grok", "fine-tuning",
    "inference", "training", "transformer", "embedding", "rag", "agentic",
    "ai startup", "ai company", "ai model", "ai chip", "ai inference",
    "neural network", "deep learning", "foundation model",
]

STARTUP_KEYWORDS = [
    "startup", "funding", "venture", "series", "seed round", "raises",
    "valuation", "backed", "led by", "investor", "vc", "capital",
    "launch", "founded", "founder", "ceo", "raises", "raised",
]

# Exclude generic tech topics (what Tomer doesn't want)
EXCLUDE_KEYWORDS = [
    "deportation", "ice", "tiktok", "bluetooth", "airpods",
    "airtag", "iphone", "android", "data center", "power outage",
    "glitches", "surge in downloads", "social network",
    "super mario", "hitchcock", "trailer", "movie",
    "microdrama", "vertical video",
]

def fetch_rss(url: str) -> str:
    """Fetch RSS feed content"""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as response:  # Reduced timeout to 15s
            return response.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return ""

def parse_rss(xml_content: str) -> List[Dict[str, str]]:
    """Parse RSS XML and extract items"""
    items = []
    try:
        # Remove XML declaration and namespaces
        xml_content = xml_content.replace('<?xml version="1.0" encoding="UTF-8"?>', '')
        root = ET.fromstring(xml_content)

        # Try different namespace prefixes
        item_elements = root.findall('.//item') + root.findall('.//{http://www.w3.org/2005/Atom}entry')

        for elem in item_elements:
            title = ""
            link = ""
            description = ""

            # Try to find title
            title_elem = elem.find('title')
            if title_elem is None:
                title_elem = elem.find('{http://www.w3.org/2005/Atom}title')
            if title_elem is not None:
                title = title_elem.text or ""

            # Try to find link
            link_elem = elem.find('link')
            if link_elem is None:
                link_elem = elem.find('{http://www.w3.org/2005/Atom}link')
            if link_elem is not None:
                if link_elem.get('href'):
                    link = link_elem.get('href')
                else:
                    link = link_elem.text or ""

            # Try to find description
            desc_elem = elem.find('description')
            if desc_elem is None:
                desc_elem = elem.find('summary')
                if desc_elem is None:
                    desc_elem = elem.find('{http://www.w3.org/2005/Atom}summary')
            if desc_elem is not None:
                description = desc_elem.text or ""

            if title and link:
                items.append({
                    'title': title.strip(),
                    'link': link.strip(),
                    'description': description.strip()[:200] if description else ''
                })
    except Exception as e:
        print(f"Error parsing RSS: {e}")

    return items

def is_relevant(item: Dict[str, str]) -> bool:
    """Check if item matches Tomer's interests AND is not excluded"""
    title_lower = item['title'].lower()
    desc_lower = item['description'].lower()

    # First, exclude what Tomer doesn't want
    if any(kw in title_lower or kw in desc_lower for kw in EXCLUDE_KEYWORDS):
        return False

    # Then, check against relevant keyword categories
    # Must match AI keywords OR startup/VC keywords
    has_ai = any(kw in title_lower or kw in desc_lower for kw in AI_KEYWORDS)
    has_startup = any(kw in title_lower or kw in desc_lower for kw in STARTUP_KEYWORDS)

    return has_ai or has_startup

def categorize_item(item: Dict[str, str]) -> str:
    """Categorize item as Startup/VC or AI/ML"""
    title_lower = item['title'].lower()
    desc_lower = item['description'].lower()

    if any(kw in title_lower or kw in desc_lower for kw in STARTUP_KEYWORDS):
        return "startup_vc"
    else:
        return "ai_ml"

def format_briefing() -> str:
    """Fetch all feeds and format briefing"""
    briefing_lines = [
        "⚡ **Daily AI & Startup Briefing**",
        f"📅 {datetime.utcnow().strftime('%Y-%m-%d')}",
        "",
        "**🤖 AI & ML Highlights:**",
        "",
    ]

    all_items = []

    # Fetch and parse all feeds
    for source_name, feed_url in RSS_FEEDS:
        xml_content = fetch_rss(feed_url)
        if xml_content:
            items = parse_rss(xml_content)
            for item in items[:5]:  # Reduced to top 5 per feed (was 10)
                item['source'] = source_name
                all_items.append(item)

    # Filter for relevance and deduplicate
    seen_titles = set()
    relevant_items = []

    for item in all_items:
        if is_relevant(item):
            title_key = item['title'].lower()
            if title_key not in seen_titles:
                seen_titles.add(title_key)
                relevant_items.append(item)

    # Categorize items
    startup_vc_items = []
    ai_ml_items = []

    for item in relevant_items[:15]:  # Limit to 15 total
        category = categorize_item(item)
        if category == "startup_vc":
            startup_vc_items.append(item)
        else:
            ai_ml_items.append(item)

    # Add AI/ML items (limit to 7-8)
    ai_count = 0
    for item in ai_ml_items:
        if ai_count >= 7:
            break
        briefing_lines.append(f"• **{item['title']}**")
        briefing_lines.append(f"  ([{item['source']}]({item['link']}))")
        ai_count += 1

    # Add Startup & VC items (limit to 7-8)
    briefing_lines.append("")
    briefing_lines.append("**💰 Startup & VC News:**")
    briefing_lines.append("")

    vc_count = 0
    for item in startup_vc_items:
        if vc_count >= 8:
            break
        briefing_lines.append(f"• **{item['title']}**")
        briefing_lines.append(f"  ([{item['source']}]({item['link']}))")
        vc_count += 1

    return "\n".join(briefing_lines)

def send_briefing(briefing_text: str):
    """Send briefing via Clawdbot message tool"""
    try:
        cmd = [
            "/home/ubuntu/.npm-global/bin/clawdbot", "message",
            "send",
            "--channel", "telegram",
            "--target", "7215456983",
            "--message", briefing_text
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        print(f"Message sent. Status: {result.returncode}")
        if result.stderr:
            print(f"Error: {result.stderr}")
    except Exception as e:
        print(f"Error sending briefing: {e}")

if __name__ == "__main__":
    briefing = format_briefing()
    print(briefing)
    print("\n" + "="*60)
    send_briefing(briefing)
