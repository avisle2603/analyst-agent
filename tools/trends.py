import numpy as np
import yfinance as yf


def detect_trends(ticker: str, period: str) -> dict:
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period=period)

        if hist.empty:
            return {"error": f"No historical data found for ticker '{ticker}'."}

        start_price = float(hist["Close"].iloc[0])
        end_price = float(hist["Close"].iloc[-1])
        price_change_pct = round(((end_price - start_price) / start_price) * 100, 2)

        # Resample to month-end prices then compute returns
        monthly = hist["Close"].resample("ME").last()
        monthly_returns = monthly.pct_change().dropna()

        avg_monthly_return_pct = round(float(monthly_returns.mean()) * 100, 2)

        best_idx = monthly_returns.idxmax()
        worst_idx = monthly_returns.idxmin()
        best_month = best_idx.strftime("%Y-%m") if hasattr(best_idx, "strftime") else str(best_idx)
        worst_month = worst_idx.strftime("%Y-%m") if hasattr(worst_idx, "strftime") else str(worst_idx)

        daily_returns = hist["Close"].pct_change().dropna()
        annualized_volatility_pct = round(float(daily_returns.std()) * np.sqrt(252) * 100, 2)

        # Simple trend direction based on 50-day vs 200-day SMA (if enough data)
        close = hist["Close"]
        trend_signal = "insufficient data"
        if len(close) >= 200:
            sma50 = float(close.iloc[-50:].mean())
            sma200 = float(close.iloc[-200:].mean())
            trend_signal = "bullish (50-day > 200-day)" if sma50 > sma200 else "bearish (50-day < 200-day)"

        return {
            "ticker": ticker.upper(),
            "period": period,
            "start_price": round(start_price, 2),
            "end_price": round(end_price, 2),
            "price_change_pct": price_change_pct,
            "avg_monthly_return_pct": avg_monthly_return_pct,
            "best_month": best_month,
            "best_month_return_pct": round(float(monthly_returns.max()) * 100, 2),
            "worst_month": worst_month,
            "worst_month_return_pct": round(float(monthly_returns.min()) * 100, 2),
            "annualized_volatility_pct": annualized_volatility_pct,
            "trend_signal": trend_signal,
        }
    except Exception as e:
        return {"error": str(e)}
