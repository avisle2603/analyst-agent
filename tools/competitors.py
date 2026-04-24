import yfinance as yf


def benchmark_competitors(ticker: str, competitors: list) -> dict:
    try:
        all_tickers = [ticker.upper()] + [c.upper() for c in competitors]
        comparison = []

        for t in all_tickers:
            try:
                stock = yf.Ticker(t)
                info = stock.info

                price = (
                    info.get("currentPrice")
                    or info.get("regularMarketPrice")
                    or info.get("previousClose")
                )

                hist = stock.history(period="1y")
                perf_52w = None
                if not hist.empty:
                    year_start = float(hist["Close"].iloc[0])
                    year_end = float(hist["Close"].iloc[-1])
                    if year_start != 0:
                        perf_52w = round(((year_end - year_start) / year_start) * 100, 2)

                pe = info.get("trailingPE")
                mcap = info.get("marketCap")

                comparison.append({
                    "ticker": t,
                    "company_name": info.get("longName", t),
                    "current_price": round(price, 2) if price else None,
                    "pe_ratio": round(pe, 2) if pe else None,
                    "market_cap": mcap,
                    "market_cap_billions": round(mcap / 1e9, 2) if mcap else None,
                    "52w_performance_pct": perf_52w,
                    "revenue_growth_pct": (
                        round(info.get("revenueGrowth") * 100, 2)
                        if info.get("revenueGrowth") else None
                    ),
                    "sector": info.get("sector"),
                })
            except Exception as inner_e:
                comparison.append({"ticker": t, "error": str(inner_e)})

        comparison.sort(key=lambda x: x.get("market_cap") or 0, reverse=True)

        return {
            "base_ticker": ticker.upper(),
            "competitors_analyzed": len(all_tickers),
            "comparison": comparison,
        }
    except Exception as e:
        return {"error": str(e)}
