import yfinance as yf


def fetch_market_data(ticker: str) -> dict:
    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        price = (
            info.get("currentPrice")
            or info.get("regularMarketPrice")
            or info.get("previousClose")
        )

        if not info or price is None:
            return {"error": f"Ticker '{ticker}' not found or no data available."}

        return {
            "ticker": ticker.upper(),
            "company_name": info.get("longName"),
            "current_price": round(price, 2),
            "52_week_high": info.get("fiftyTwoWeekHigh"),
            "52_week_low": info.get("fiftyTwoWeekLow"),
            "volume": info.get("volume"),
            "avg_volume": info.get("averageVolume"),
            "pe_ratio": round(info.get("trailingPE"), 2) if info.get("trailingPE") else None,
            "forward_pe": round(info.get("forwardPE"), 2) if info.get("forwardPE") else None,
            "market_cap": info.get("marketCap"),
            "market_cap_billions": round(info.get("marketCap") / 1e9, 2) if info.get("marketCap") else None,
            "dividend_yield": round(info.get("dividendYield") * 100, 2) if info.get("dividendYield") else None,
            "beta": info.get("beta"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "analyst_target_price": info.get("targetMeanPrice"),
        }
    except Exception as e:
        return {"error": str(e)}
