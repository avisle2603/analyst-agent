import yfinance as yf


def compute_kpis(ticker: str) -> dict:
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        income_stmt = stock.income_stmt

        revenue_growth = None
        gross_margin = None
        operating_margin = None

        if income_stmt is not None and not income_stmt.empty:
            # Revenue growth YoY
            if "Total Revenue" in income_stmt.index:
                revenues = income_stmt.loc["Total Revenue"].dropna()
                if len(revenues) >= 2:
                    latest, prev = revenues.iloc[0], revenues.iloc[1]
                    if prev and prev != 0:
                        revenue_growth = round(((latest - prev) / abs(prev)) * 100, 2)

            # Gross margin
            if "Gross Profit" in income_stmt.index and "Total Revenue" in income_stmt.index:
                gp = income_stmt.loc["Gross Profit"].iloc[0]
                rev = income_stmt.loc["Total Revenue"].iloc[0]
                if rev and rev != 0:
                    gross_margin = round((gp / rev) * 100, 2)

            # Operating margin
            op_key = next(
                (k for k in ["Operating Income", "EBIT"] if k in income_stmt.index),
                None,
            )
            if op_key and "Total Revenue" in income_stmt.index:
                op = income_stmt.loc[op_key].iloc[0]
                rev = income_stmt.loc["Total Revenue"].iloc[0]
                if rev and rev != 0:
                    operating_margin = round((op / rev) * 100, 2)

        eps = info.get("trailingEps") or info.get("epsTrailingTwelveMonths")
        d2e_raw = info.get("debtToEquity")
        debt_to_equity = round(d2e_raw / 100, 2) if d2e_raw else None

        roe_raw = info.get("returnOnEquity")
        roa_raw = info.get("returnOnAssets")

        return {
            "ticker": ticker.upper(),
            "revenue_growth_yoy_pct": revenue_growth,
            "gross_margin_pct": gross_margin,
            "operating_margin_pct": operating_margin,
            "eps": round(eps, 2) if eps is not None else None,
            "debt_to_equity": debt_to_equity,
            "return_on_equity_pct": round(roe_raw * 100, 2) if roe_raw is not None else None,
            "return_on_assets_pct": round(roa_raw * 100, 2) if roa_raw is not None else None,
            "price_to_book": round(info.get("priceToBook"), 2) if info.get("priceToBook") else None,
        }
    except Exception as e:
        return {"error": str(e)}
