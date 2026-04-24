from tools.market_data import fetch_market_data
from tools.kpis import compute_kpis
from tools.news import scan_news
from tools.portfolio import check_portfolio_risk
from tools.trends import detect_trends
from tools.competitors import benchmark_competitors
from tools.upside import calculate_upside

TOOLS = [
    {
        "name": "fetch_market_data",
        "description": (
            "Fetch real-time market data for a stock ticker: current price, 52-week high/low, "
            "volume, PE ratio, market cap, dividend yield, beta, sector, and analyst target price."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol, e.g. 'NVDA' or 'AAPL'.",
                }
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "compute_kpis",
        "description": (
            "Compute key financial KPIs from income statement and balance sheet data: "
            "revenue growth YoY (%), gross margin (%), operating margin (%), EPS, "
            "debt-to-equity ratio, ROE, ROA, and price-to-book."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol, e.g. 'NVDA' or 'AAPL'.",
                }
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "scan_news",
        "description": (
            "Fetch recent news headlines for a company and determine overall sentiment "
            "(positive, neutral, or negative) based on keyword analysis. "
            "Returns top 5 headlines with title, publisher, and publish time."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "company": {
                    "type": "string",
                    "description": "Stock ticker symbol or company name, e.g. 'NVDA'.",
                },
                "days": {
                    "type": "integer",
                    "description": "Number of days back to scan for news, e.g. 7 or 30.",
                },
            },
            "required": ["company", "days"],
        },
    },
    {
        "name": "check_portfolio_risk",
        "description": (
            "Analyze portfolio risk given a list of holdings with weights. "
            "Flags positions exceeding 25% concentration, tech sector weight over 50%, "
            "and misaligned total weights. Returns risk_level, flags, and rebalance recommendation."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "holdings": {
                    "type": "array",
                    "description": "List of portfolio holdings with ticker and weight.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "ticker": {
                                "type": "string",
                                "description": "Stock ticker symbol.",
                            },
                            "weight": {
                                "type": "number",
                                "description": "Portfolio weight as a decimal, e.g. 0.30 for 30%.",
                            },
                        },
                        "required": ["ticker", "weight"],
                    },
                }
            },
            "required": ["holdings"],
        },
    },
    {
        "name": "detect_trends",
        "description": (
            "Analyze price trends for a stock over a given period. "
            "Returns price change %, average monthly return, best/worst months, "
            "annualized volatility, and a SMA-based trend signal."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol, e.g. 'NVDA'.",
                },
                "period": {
                    "type": "string",
                    "description": "Lookback period: '1y', '2y', or '5y'.",
                    "enum": ["1y", "2y", "5y"],
                },
            },
            "required": ["ticker", "period"],
        },
    },
    {
        "name": "benchmark_competitors",
        "description": (
            "Compare a stock against a list of competitors on: current price, PE ratio, "
            "market cap, 52-week performance, and revenue growth. "
            "Returns a table sorted by market cap descending."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Primary stock ticker to analyze.",
                },
                "competitors": {
                    "type": "array",
                    "description": "List of competitor ticker symbols.",
                    "items": {"type": "string"},
                },
            },
            "required": ["ticker", "competitors"],
        },
    },
    {
        "name": "calculate_upside",
        "description": (
            "Calculate upside potential from current price to a target price. "
            "Returns upside %, dollar upside, and a risk/reward label: "
            "'strong buy' (>20%), 'buy' (10-20%), 'hold' (0-10%), or 'sell' (negative)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {
                    "type": "string",
                    "description": "Stock ticker symbol.",
                },
                "current_price": {
                    "type": "number",
                    "description": "Current market price of the stock.",
                },
                "target_price": {
                    "type": "number",
                    "description": "Analyst consensus target price.",
                },
            },
            "required": ["ticker", "current_price", "target_price"],
        },
    },
]

TOOL_MAP = {
    "fetch_market_data": fetch_market_data,
    "compute_kpis": compute_kpis,
    "scan_news": scan_news,
    "check_portfolio_risk": check_portfolio_risk,
    "detect_trends": detect_trends,
    "benchmark_competitors": benchmark_competitors,
    "calculate_upside": calculate_upside,
}
