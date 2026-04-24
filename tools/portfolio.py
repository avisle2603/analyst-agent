TECH_TICKERS = {
    "AAPL", "MSFT", "NVDA", "GOOGL", "GOOG", "META", "AMZN", "TSLA",
    "AMD", "INTC", "ORCL", "CRM", "ADBE", "NFLX", "QCOM", "TXN",
    "AVGO", "IBM", "NOW", "SNOW", "PLTR", "UBER", "LYFT", "ABNB",
    "SMH", "SOXX", "QQQ", "XLK", "VGT", "ARKK", "SOXL", "TECL",
}


def check_portfolio_risk(holdings: list) -> dict:
    try:
        flags = []

        total_weight = sum(h.get("weight", 0) for h in holdings)
        if not (0.95 <= total_weight <= 1.05):
            flags.append(
                f"Portfolio weights sum to {round(total_weight * 100, 1)}% — expected ~100%."
            )

        for h in holdings:
            ticker = h.get("ticker", "").upper()
            weight = h.get("weight", 0)
            if weight > 0.25:
                flags.append(
                    f"{ticker} at {round(weight * 100, 1)}% exceeds the 25% single-position limit."
                )

        tech_weight = sum(
            h.get("weight", 0)
            for h in holdings
            if h.get("ticker", "").upper() in TECH_TICKERS
        )
        if tech_weight > 0.50:
            flags.append(
                f"Tech sector allocation {round(tech_weight * 100, 1)}% exceeds the 50% sector limit."
            )

        risk_level = "low" if len(flags) == 0 else ("medium" if len(flags) == 1 else "high")

        return {
            "holdings_analyzed": len(holdings),
            "total_weight_pct": round(total_weight * 100, 1),
            "tech_sector_weight_pct": round(tech_weight * 100, 1),
            "risk_level": risk_level,
            "flags": flags,
            "rebalance_recommended": len(flags) > 0,
        }
    except Exception as e:
        return {"error": str(e)}
