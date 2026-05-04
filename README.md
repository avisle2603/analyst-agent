# AnalystAgent

AI-powered financial analysis platform that automates 
the work of a junior equity analyst. Built from scratch 
using the Anthropic Claude SDK, React, and FastAPI.

> **From 4–8 hours of manual research to 35 seconds.**

---

## What it does

AnalystAgent runs a multi-tool agentic loop that 
autonomously fetches live market data, computes 
financial KPIs, scans news sentiment, benchmarks 
competitors, and synthesizes everything into a 
structured investment brief with a Buy, Hold, or 
Sell recommendation — at roughly $0.80 per analysis 
compared to $25,000/year for a Bloomberg Terminal.

---

## Features

### Stock Analysis Dashboard
Full investment brief in 35 seconds. Enter any ticker 
or company name and the agent autonomously runs 7 tools 
in sequence, then returns:
- Buy / Hold / Sell signal with conviction level
- Key financial metrics (P/E, margins, EPS, ROE, D/E)
- Trend analysis with SMA crossover signal
- Competitive benchmarking table vs peer companies
- News sentiment panel with positive/negative/neutral tags
- Risk assessment table with HIGH/MEDIUM/LOW severity
- Full recommendation with reasoning
- Downloadable Word document report

### Earnings Decoder
The unique differentiating feature. Every existing tool 
summarizes what management said. This one finds what 
they did not say — and why it matters.
- Management credibility score (1–10) based on 
  beat/miss track record
- Red flags with HIGH/MEDIUM/LOW severity badges
- 6 hard questions tied to actual financial metrics,
  each with what a good answer vs a dodge looks like
- 3 numbers to watch next quarter
- Overall earnings risk rating
- Downloadable Word document report

### Weekly Signals
Live stock screener across a curated universe of stocks.
Quantitative scoring model across 5 factors:
- Revenue growth
- Upside to analyst consensus target
- Gross margin
- P/E ratio vs sector
- 3-month price momentum

Output: BUY / HOLD / SELL signal with HIGH/MEDIUM/LOW 
conviction, top reasons, key risks, and score breakdown.
Filter by signal type. Click any stock to run a full 
analysis directly from the signal card.

### Portfolio Risk Check
Enter your holdings with percentage weights and the 
agent analyzes:
- Single position concentration risk (flags above 25%)
- Sector overweight risk (flags tech above 50%)
- Rebalancing triggers
- Overall portfolio risk assessment
- Downloadable Word document report

### Earnings Prep
Prepare for any earnings call using live financial data.
Generates the 8 toughest questions analysts will ask 
based on the company's actual earnings history, with 
predicted management responses for each.

### Watchlist
Save tickers for quick re-analysis. Auto-populated 
whenever you run a stock analysis. Persists across 
sessions via localStorage.

### Reports
Full history of every analysis run. Stored in 
localStorage. Each report includes the query, 
timestamp, and a re-download button for the Word doc.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 | Functional components, useState, useEffect |
| API calls | Axios | HTTP requests to FastAPI backend |
| Styling | Plain CSS | Dark theme, no Tailwind, no UI library |
| State | localStorage | Watchlist and reports history |
| Backend | FastAPI (Python) | REST API layer, CORS enabled |
| AI SDK | Anthropic SDK | Native tool_use agentic loop |
| AI Model | claude-opus-4-6 | Reasoning, synthesis, report writing |
| Data | yfinance | Live prices, financials, EPS, analyst targets |
| Export | python-docx | Generates .docx in memory via BytesIO |
| Environment | python-dotenv | Loads API key from .env |
| Server | uvicorn | Runs FastAPI on port 8000 |
| Dev server | npm start | Runs React on port 3000 |

---

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| /analyze | POST | Runs main analyst agent, returns brief |
| /export/docx | POST | Re-runs agent, returns .docx blob |
| /earnings-decoder | POST | Runs Earnings Decoder agent |
| /export/earnings-decoder | POST | Exports decoder output as .docx |
| /earnings-prep | POST | Runs earnings prep analysis |
| /weekly-signals | POST | Runs stock screener (no Claude) |
| /health | GET | Health check |

---

## The Agentic Loop

The core of the backend is a ReAct loop 
(Reason + Act) built directly with the Anthropic SDK:

```python
messages = [{"role": "user", "content": query}]
while True:
    response = client.messages.create(
        model="claude-opus-4-6",
        tools=TOOLS,
        messages=messages
    )
    if response.stop_reason == "end_turn":
        return response.content[0].text
    # execute all tool_use blocks
    # append results to messages
    # loop again
```

Claude receives the query and a list of available tools. 
When it needs data it returns a tool_use block. Python 
executes the actual function, appends the result, and 
loops. When Claude has enough data it returns 
stop_reason == end_turn with the final brief.

No framework. No abstraction layer. Full transparency 
over every tool call.

---

## The 11 Tools

### Core Analyst Tools (7)
| Tool | Purpose |
|---|---|
| fetch_market_data | Live price, P/E, market cap, 52-week range, analyst target |
| compute_kpis | Revenue growth, margins, EPS, debt/equity, ROE |
| scan_news | Recent headlines with positive/neutral/negative sentiment |
| detect_trends | SMA crossover, volatility, best/worst months, price change |
| benchmark_competitors | Side-by-side P/E, market cap, revenue vs peers |
| check_portfolio_risk | Concentration, sector overweight, rebalancing triggers |
| calculate_upside | Current price vs consensus target → Buy/Hold/Sell signal |

### Earnings Decoder Tools (4)
| Tool | Purpose |
|---|---|
| fetch_transcript | Last 4 quarters EPS actual vs estimate, beat/miss record |
| analyze_guidance_credibility | Credibility score 1–10 from financial track record |
| detect_narrative_vs_reality | Flags contradictions between numbers and claims |
| generate_decoder_questions | 6 hard questions tied to actual metrics |

### Weekly Signals (Pure Python — no Claude)
| Function | Purpose |
|---|---|
| screen_stock | Fetches live data for each ticker via yfinance |
| generate_signal | Scores stock across 5 factors, outputs BUY/HOLD/SELL |
| run_full_screen | Loops all tickers, returns ranked results |

---

## Financial Formulas

### Revenue Growth (YoY)
Revenue Growth % = (Current Revenue - Prior Revenue) / Prior Revenue × 100

### Gross Margin
Gross Margin % = Gross Profit / Total Revenue × 100

### Operating Margin
Operating Margin % = Operating Income / Total Revenue × 100

### EPS
EPS = Net Income / Shares Outstanding

### Debt to Equity
D/E = Total Debt / Total Shareholders Equity

### ROE
ROE % = Net Income / Shareholders Equity × 100

### Price Change
Price Change % = (End Price - Start Price) / Start Price × 100

### Annualized Volatility
Volatility = Standard Deviation of Daily Returns × √252

### Upside to Target
Upside % = (Analyst Target - Current Price) / Current Price × 100

### Signal Classification
- Above +20% upside → BUY (HIGH conviction)
- +10% to +20% → BUY (MEDIUM conviction)
- 0% to +10% → BUY (LOW conviction)
- -10% to 0% → HOLD
- Below -10% → SELL

---

## The Bend vs Build Decision

Built with the Anthropic SDK directly instead of 
no-code platforms (n8n, Zapier) or frameworks 
(LangChain, CrewAI) for these reasons:

| Dimension | Decision | Reason |
|---|---|---|
| Control | BUILD | Custom tool logic, dynamic orchestration |
| Cost | BUILD | $0.80/analysis vs $1k–10k/month platforms |
| Integration | BUILD | yfinance + custom KPIs, no pre-built connectors |
| Differentiation | BUILD | The contradiction engine IS the product |
| Maintenance | BUILD | Developer owns the loop and model upgrades |

5 of 6 dimensions point to BUILD.

---

## Setup

### Requirements
- Python 3.11+
- Node.js 18+
- Anthropic API key from console.anthropic.com

### Installation

1. Clone the repository
git clone https://github.com/avisle2603/analyst-agent.git
cd analyst-agent

2. Create and activate virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
source venv/bin/activate   # Mac/Linux

3. Install Python dependencies
pip install -r requirements.txt

4. Set up environment variables
cp .env.example .env
Add your Anthropic API key to .env

5. Install frontend dependencies
cd frontend
npm install

### Running locally

Terminal 1 — Backend:
uvicorn api:app --reload --port 8000

Terminal 2 — Frontend:
cd frontend
npm start

Open http://localhost:3000

---

## Project Structure
analyst_agent/
├── analyst_agent.py      # Main agent — 7 core tools + agentic loop
├── earnings_decoder.py   # Earnings Decoder — 4 tools + agentic loop
├── earnings_prep.py      # Earnings Prep agent
├── weekly_signals.py     # Stock screener — pure Python, no Claude
├── export.py             # Word document generator (python-docx)
├── api.py                # FastAPI — all endpoints
├── requirements.txt      # Python dependencies
├── .env.example          # Environment variable template
├── README.md             # This file
└── frontend/
└── src/
├── App.js            # Sidebar + page switcher
├── Dashboard.js      # Stock analysis page
├── EarningsDecoder.js
├── EarningsPrep.js
├── WeeklySignals.js
├── Portfolio.js
├── Watchlist.js
└── Reports.js

---

## Competitive Positioning

| Tool | Cost | What it does |
|---|---|---|
| Bloomberg Terminal | $25,000/year | Institutional data + analytics |
| AlphaSense | $10,000–50,000/year | Transcript summarization |
| VerityData | Enterprise pricing | Earnings call analysis |
| AnalystAgent | ~$0.80/analysis | Full stack analysis + Earnings Decoder |

The key differentiator: every existing tool summarizes 
what management said. AnalystAgent finds what they 
did not say — by cross-referencing live financial data 
against earnings narratives in a single agentic workflow.

---

## Disclaimer

This tool is for educational and informational purposes 
only. Nothing on this platform constitutes financial 
advice. Always conduct your own research and consult 
a licensed financial advisor before making investment 
decisions. Data sourced from Yahoo Finance via yfinance. 
Powered by Anthropic Claude.