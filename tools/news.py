import yfinance as yf
from datetime import datetime, timedelta

POSITIVE_KEYWORDS = [
    "surge", "rally", "beat", "record", "growth", "profit", "upgrade",
    "strong", "gain", "rise", "bullish", "outperform", "positive", "exceed",
    "launch", "partnership", "acquisition", "revenue", "boom", "soar",
    "milestone", "breakthrough", "opportunity", "upside", "expansion",
]

NEGATIVE_KEYWORDS = [
    "fall", "drop", "miss", "loss", "decline", "downgrade", "weak",
    "sell", "bearish", "underperform", "cut", "layoff", "lawsuit",
    "fine", "penalty", "warning", "risk", "concern", "crash", "plunge",
    "tumble", "slump", "disappointing", "recall", "investigation", "fraud",
]


def scan_news(company: str, days: int) -> dict:
    try:
        stock = yf.Ticker(company)
        all_news = stock.news or []

        if not all_news:
            return {
                "company": company.upper(),
                "days_scanned": days,
                "headlines": [],
                "total_found": 0,
                "sentiment": "neutral",
            }

        cutoff = datetime.now() - timedelta(days=days)
        recent = [
            item for item in all_news
            if datetime.fromtimestamp(item.get("providerPublishTime", 0)) >= cutoff
        ]

        # Fall back to all available news if none fall within the window
        pool = recent if recent else all_news

        top_5 = pool[:5]
        headlines = []
        score_total = 0

        for item in top_5:
            content = item.get("content", {})
            title = content.get("title", "") if isinstance(content, dict) else item.get("title", "")
            publisher_raw = content.get("provider", {}) if isinstance(content, dict) else {}
            publisher = (
                publisher_raw.get("displayName", "Unknown")
                if isinstance(publisher_raw, dict)
                else item.get("publisher", "Unknown")
            )
            pub_ts = item.get("providerPublishTime", 0)
            pub_time_str = (
                datetime.fromtimestamp(pub_ts).strftime("%Y-%m-%d %H:%M")
                if pub_ts else "Unknown"
            )

            title_lower = title.lower()
            pos = sum(1 for kw in POSITIVE_KEYWORDS if kw in title_lower)
            neg = sum(1 for kw in NEGATIVE_KEYWORDS if kw in title_lower)
            score_total += pos - neg

            headlines.append({
                "title": title,
                "publisher": publisher,
                "published_at": pub_time_str,
            })

        sentiment = "positive" if score_total > 0 else ("negative" if score_total < 0 else "neutral")

        return {
            "company": company.upper(),
            "days_scanned": days,
            "headlines": headlines,
            "total_found": len(pool),
            "sentiment": sentiment,
        }
    except Exception as e:
        return {"error": str(e)}
