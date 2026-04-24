def calculate_upside(ticker: str, current_price: float, target_price: float) -> dict:
    try:
        if current_price <= 0:
            return {"error": "current_price must be greater than zero."}

        upside_pct = round(((target_price - current_price) / current_price) * 100, 2)
        dollar_upside = round(target_price - current_price, 2)

        if upside_pct > 20:
            risk_reward = "strong buy"
        elif upside_pct >= 10:
            risk_reward = "buy"
        elif upside_pct >= 0:
            risk_reward = "hold"
        else:
            risk_reward = "sell"

        return {
            "ticker": ticker.upper(),
            "current_price": round(current_price, 2),
            "target_price": round(target_price, 2),
            "dollar_upside": dollar_upside,
            "upside_pct": upside_pct,
            "risk_reward_label": risk_reward,
            "recommendation": risk_reward.upper(),
        }
    except Exception as e:
        return {"error": str(e)}
