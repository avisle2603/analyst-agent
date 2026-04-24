# Analyst Agent

A Python agentic loop that acts as a senior business and financial analyst. Given a natural language query, it autonomously chains tool calls — fetching real market data, computing KPIs, scanning news, and benchmarking competitors — then returns a structured executive brief.

---

## Setup

**1. Install dependencies**

```bash
cd analyst_agent
pip install -r requirements.txt
```

**2. Add your Anthropic API key**

Edit `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## How to Run

```bash
python analyst_agent.py "Analyze NVDA's investment case"
```

Reports are written to `output/<TICKER>_<timestamp>.txt` and printed to the console.

---

## Example Queries

```bash
# Single-stock deep dive
python analyst_agent.py "Analyze NVDA's investment case"

# Valuation comparison
python analyst_agent.py "Compare AAPL and MSFT on valuation"

# Portfolio risk check
python analyst_agent.py "Check my portfolio risk: SCHD 40%, SGOV 20%, VNQ 20%, VUG 20%"

# Trend and news analysis
python analyst_agent.py "What are the trends and news for TSLA over the past year"
```

---

## The 7 Tools

| Tool | Function | Data Source |
|------|----------|-------------|
| `fetch_market_data` | Price, volume, PE, market cap, 52-week range | yfinance |
| `compute_kpis` | Revenue growth, margins, EPS, D/E ratio, ROE | yfinance income statement |
| `scan_news` | Top 5 headlines + sentiment scoring | yfinance news feed |
| `check_portfolio_risk` | Concentration and sector risk flags | Rule-based |
| `detect_trends` | Price change %, volatility, monthly returns, SMA signal | yfinance historical |
| `benchmark_competitors` | Side-by-side competitor comparison table | yfinance |
| `calculate_upside` | Target price upside % and risk/reward label | Calculated |

---

## Project Structure

```
analyst_agent/
├── analyst_agent.py        ← main agentic loop
├── tools/
│   ├── market_data.py
│   ├── kpis.py
│   ├── news.py
│   ├── portfolio.py
│   ├── trends.py
│   ├── competitors.py
│   └── upside.py
├── schemas/
│   └── tool_schemas.py     ← JSON schemas + TOOL_MAP
├── output/                 ← generated reports land here
├── .env
├── requirements.txt
└── README.md
```

---

## Why the Anthropic SDK? The 6 Dimensions Framework

This agent was built directly with the Anthropic SDK rather than a higher-level framework for six concrete reasons:

1. **Control** — Direct ownership of the `tool_use` / `tool_result` message loop. No hidden retry logic or prompt rewriting sits between your intent and the model.

2. **Transparency** — Every tool call and raw result is logged as it happens. For financial analysis, auditability is non-negotiable.

3. **Determinism** — No framework-level prompt engineering alters the system prompt or injects context you didn't write. What you see is what runs.

4. **Performance** — Zero framework overhead. The agentic loop is plain Python — easy to profile, benchmark, and optimize per query.

5. **Flexibility** — Tool schemas, the system prompt, and loop behaviour are all independent and fully modifiable. Adding a new tool is adding one schema and one function.

6. **Portability** — The entire agent is a single file (`analyst_agent.py`) with no agent-framework dependency. It runs anywhere Python 3.11+ runs.
