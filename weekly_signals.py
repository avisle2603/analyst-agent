from datetime import datetime
import yfinance as yf

TICKERS = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN",
    "META", "TSLA", "BRK-B", "JPM", "JNJ",
    "V", "UNH", "XOM", "WMT", "PG",
    "SCHD", "VTI", "QQQ", "SGOV", "VNQ",
]

TICKER_NAMES = {
    "AAPL": "Apple", "MSFT": "Microsoft",
    "NVDA": "NVIDIA", "GOOGL": "Alphabet",
    "AMZN": "Amazon", "META": "Meta",
    "TSLA": "Tesla", "BRK-B": "Berkshire Hathaway",
    "JPM": "JPMorgan Chase", "JNJ": "Johnson & Johnson",
    "V": "Visa", "UNH": "UnitedHealth",
    "XOM": "ExxonMobil", "WMT": "Walmart",
    "PG": "Procter & Gamble", "SCHD": "Schwab Dividend ETF",
    "VTI": "Vanguard Total Market ETF",
    "QQQ": "Invesco QQQ ETF", "SGOV": "iShares T-Bill ETF",
    "VNQ": "Vanguard Real Estate ETF",
}


def screen_stock(ticker: str) -> dict:
    try:
        t = yf.Ticker(ticker)
        info = t.info

        price = info.get("currentPrice") or info.get("regularMarketPrice")
        pe_ratio = info.get("trailingPE")
        analyst_target = info.get("targetMeanPrice")
        dividend_yield = info.get("dividendYield")
        beta = info.get("beta")
        week_52_high = info.get("fiftyTwoWeekHigh")
        week_52_low = info.get("fiftyTwoWeekLow")
        name = info.get("longName") or TICKER_NAMES.get(ticker, ticker)

        revenue_growth = None
        gross_margin = None
        try:
            financials = t.financials
            if financials is not None and not financials.empty:
                if "Total Revenue" in financials.index and financials.shape[1] >= 2:
                    rev_current = financials.loc["Total Revenue"].iloc[0]
                    rev_prior = financials.loc["Total Revenue"].iloc[1]
                    if rev_prior and rev_prior != 0:
                        revenue_growth = (rev_current - rev_prior) / rev_prior * 100
                if "Gross Profit" in financials.index and "Total Revenue" in financials.index:
                    gp = financials.loc["Gross Profit"].iloc[0]
                    tr = financials.loc["Total Revenue"].iloc[0]
                    if tr and tr != 0:
                        gross_margin = gp / tr * 100
        except Exception:
            pass

        price_change_3m = None
        try:
            hist = t.history(period="3mo")
            if hist is not None and not hist.empty:
                close_start = hist["Close"].iloc[0]
                close_end = hist["Close"].iloc[-1]
                if close_start and close_start != 0:
                    price_change_3m = (close_end - close_start) / close_start * 100
        except Exception:
            pass

        upside = None
        if price and analyst_target:
            upside = (analyst_target - price) / price * 100

        def _round(v, n):
            try:
                return round(float(v), n) if v is not None else None
            except Exception:
                return None

        return {
            "ticker": ticker,
            "name": name,
            "price": _round(price, 2),
            "pe_ratio": _round(pe_ratio, 1),
            "revenue_growth": _round(revenue_growth, 1),
            "gross_margin": _round(gross_margin, 1),
            "upside_to_target": _round(upside, 1),
            "analyst_target": _round(analyst_target, 2),
            "dividend_yield": _round(dividend_yield * 100, 2) if dividend_yield else None,
            "beta": _round(beta, 2),
            "price_change_3m": _round(price_change_3m, 1),
            "week_52_high": _round(week_52_high, 2),
            "week_52_low": _round(week_52_low, 2),
            "error": None,
        }
    except Exception as e:
        return {
            "ticker": ticker,
            "name": TICKER_NAMES.get(ticker, ticker),
            "price": None, "pe_ratio": None, "revenue_growth": None,
            "gross_margin": None, "upside_to_target": None, "analyst_target": None,
            "dividend_yield": None, "beta": None, "price_change_3m": None,
            "week_52_high": None, "week_52_low": None,
            "error": str(e),
        }


def generate_signal(stock_data: dict) -> dict:
    score = 0
    reasons_buy = []
    reasons_risk = []

    revenue_growth = stock_data.get("revenue_growth")
    upside = stock_data.get("upside_to_target")
    gross_margin = stock_data.get("gross_margin")
    pe_ratio = stock_data.get("pe_ratio")
    price_change_3m = stock_data.get("price_change_3m")
    price = stock_data.get("price")
    week_52_high = stock_data.get("week_52_high")

    if revenue_growth is not None:
        if revenue_growth > 20:
            score += 25
            reasons_buy.append(f"{revenue_growth:.0f}% revenue growth")
        elif revenue_growth > 10:
            score += 15
        elif revenue_growth < 0:
            score -= 20
            reasons_risk.append(f"Revenue declining {revenue_growth:.0f}%")

    if upside is not None:
        if upside > 20:
            score += 25
            reasons_buy.append(f"{upside:.0f}% upside to analyst target")
        elif upside > 10:
            score += 15
            reasons_buy.append(f"{upside:.0f}% upside to analyst target")
        elif upside < 0:
            score -= 25
            reasons_risk.append(f"Trading {abs(upside):.0f}% above analyst target")

    if gross_margin is not None:
        if gross_margin > 60:
            score += 15
            reasons_buy.append(f"{gross_margin:.0f}% gross margin")
        elif gross_margin > 40:
            score += 10
        elif gross_margin < 20:
            score -= 10
            reasons_risk.append(f"Low gross margin of {gross_margin:.0f}%")

    if pe_ratio is not None:
        if pe_ratio < 15:
            score += 15
            reasons_buy.append(f"Attractive valuation at {pe_ratio:.0f}x PE")
        elif pe_ratio < 25:
            score += 5
        elif pe_ratio > 50:
            score -= 10
            reasons_risk.append(f"Expensive at {pe_ratio:.0f}x PE")

    if price_change_3m is not None:
        if price_change_3m > 15:
            score += 10
        elif price_change_3m < -15:
            score -= 15
            reasons_risk.append(f"Down {abs(price_change_3m):.0f}% in 3 months")

    if price and week_52_high:
        pct_from_high = (price - week_52_high) / week_52_high * 100
        if pct_from_high > -10:
            score += 5
        elif pct_from_high < -30:
            score -= 5

    if score >= 50:
        signal, conviction = "BUY", "HIGH"
    elif score >= 30:
        signal, conviction = "BUY", "MEDIUM"
    elif score >= 10:
        signal, conviction = "BUY", "LOW"
    elif score >= -10:
        signal, conviction = "HOLD", None
    elif score >= -25:
        signal, conviction = "SELL", "LOW"
    else:
        signal, conviction = "SELL", "HIGH"

    if signal == "BUY":
        if reasons_buy:
            top = reasons_buy[0]
            summary = f"Strong fundamentals with {top.lower()} supporting a positive outlook."
        else:
            summary = "Positive technical and fundamental signals support a buy thesis."
    elif signal == "HOLD":
        summary = "Mixed signals — monitor before acting."
    else:
        if reasons_risk:
            top = reasons_risk[0]
            summary = f"Risk factors weigh on the thesis: {top.lower()}."
        else:
            summary = "Risk factors outweigh current valuation."

    return {
        "ticker": stock_data["ticker"],
        "name": stock_data["name"],
        "price": stock_data["price"],
        "pe_ratio": stock_data["pe_ratio"],
        "revenue_growth": stock_data["revenue_growth"],
        "gross_margin": stock_data["gross_margin"],
        "upside_to_target": stock_data["upside_to_target"],
        "analyst_target": stock_data["analyst_target"],
        "dividend_yield": stock_data["dividend_yield"],
        "beta": stock_data["beta"],
        "price_change_3m": stock_data["price_change_3m"],
        "week_52_high": stock_data["week_52_high"],
        "week_52_low": stock_data["week_52_low"],
        "signal": signal,
        "conviction": conviction,
        "score": score,
        "reasons_buy": reasons_buy[:2],
        "reasons_risk": reasons_risk[:2],
        "summary": summary,
    }


def run_full_screen() -> list:
    results = []
    for ticker in TICKERS:
        print(f"Screening {ticker}...")
        try:
            stock_data = screen_stock(ticker)
            signal_data = generate_signal(stock_data)
            results.append(signal_data)
        except Exception as e:
            print(f"  Skipped {ticker}: {e}")
    results.sort(key=lambda x: x["score"], reverse=True)
    return results


def run_weekly_signals() -> dict:
    results = run_full_screen()
    return {
        "generated_at": datetime.now().strftime("%B %d, %Y at %I:%M %p"),
        "total_screened": len(results),
        "buy_count": sum(1 for r in results if r["signal"] == "BUY"),
        "hold_count": sum(1 for r in results if r["signal"] == "HOLD"),
        "sell_count": sum(1 for r in results if r["signal"] == "SELL"),
        "stocks": results,
    }
