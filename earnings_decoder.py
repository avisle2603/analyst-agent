import json
import os

import anthropic
import numpy as np
import yfinance as yf
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = (
    "You are a skeptical buy-side analyst. Your job is NOT to summarize what management "
    "said — that is what every other tool does. Your job is to find the gap between what "
    "the numbers show and what management claims.\n\n"
    "Using the data from the tools:\n"
    "1. Cross-reference the financial reality against the earnings narrative\n"
    "2. Score management credibility based on their track record\n"
    "3. Identify the specific metrics being obscured or avoided\n"
    "4. Generate the 6 hardest questions that expose contradictions\n"
    "5. Flag the 3 most important numbers to watch next quarter\n\n"
    "Format your output with these exact ## headers:\n"
    "## Decoder Summary\n"
    "## Credibility Score\n"
    "## Red Flags\n"
    "## The 6 Hard Questions\n"
    "## 3 Numbers to Watch Next Quarter\n"
    "## Overall Earnings Risk Rating\n\n"
    "Be specific. Reference actual numbers. Never say 'management may be hiding something' "
    "without pointing to the specific metric that shows it."
)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _safe_float(val):
    try:
        f = float(val)
        return None if (f != f) else f  # NaN check
    except (TypeError, ValueError):
        return None


def _get_quarterly_income(stock):
    for attr in ("quarterly_income_stmt", "quarterly_financials"):
        try:
            df = getattr(stock, attr, None)
            if df is not None and not df.empty:
                return df
        except Exception:
            pass
    return None


def _get_quarterly_cashflow(stock):
    for attr in ("quarterly_cashflow", "quarterly_cash_flow"):
        try:
            df = getattr(stock, attr, None)
            if df is not None and not df.empty:
                return df
        except Exception:
            pass
    return None


def _trend(values):
    """Return 'growing', 'declining', or 'flat' for a list of values (newest first)."""
    vals = [v for v in values if v is not None]
    if len(vals) < 2:
        return "insufficient data"
    mid = max(1, len(vals) // 2)
    recent = sum(vals[:mid]) / mid
    older = sum(vals[mid:]) / len(vals[mid:]) if vals[mid:] else vals[-1]
    if older == 0:
        return "flat"
    pct = ((recent - older) / abs(older)) * 100
    if pct > 3:
        return "growing"
    if pct < -3:
        return "declining"
    return "flat"


# ─── Tool 1: fetch_transcript ─────────────────────────────────────────────────

def fetch_transcript(ticker: str) -> dict:
    try:
        stock = yf.Ticker(ticker.upper())

        eps_history = []
        beat_count = 0
        miss_count = 0

        try:
            ed = stock.earnings_dates
            if ed is not None and not ed.empty:
                for date_idx, row in ed.head(8).iterrows():
                    eps_actual = _safe_float(row.get("Reported EPS"))
                    eps_est = _safe_float(row.get("EPS Estimate"))
                    if eps_actual is None and eps_est is None:
                        continue
                    beat = None
                    if eps_actual is not None and eps_est is not None:
                        beat = eps_actual >= eps_est
                        if beat:
                            beat_count += 1
                        else:
                            miss_count += 1
                    date_str = str(date_idx.date()) if hasattr(date_idx, "date") else str(date_idx)
                    eps_history.append({
                        "date": date_str,
                        "eps_actual": round(eps_actual, 4) if eps_actual is not None else None,
                        "eps_estimate": round(eps_est, 4) if eps_est is not None else None,
                        "beat": beat,
                    })
                    if len(eps_history) >= 4:
                        break
        except Exception:
            pass

        last_earnings_date = eps_history[0]["date"] if eps_history else "Unknown"

        next_earnings_date = "Unknown"
        try:
            cal = stock.calendar
            if cal is not None:
                if isinstance(cal, dict):
                    ed_val = cal.get("Earnings Date")
                    if ed_val:
                        next_earnings_date = str(ed_val[0]) if isinstance(ed_val, list) else str(ed_val)
                elif hasattr(cal, "loc"):
                    try:
                        ed_val = cal.loc["Earnings Date"]
                        next_earnings_date = str(ed_val.iloc[0]) if hasattr(ed_val, "iloc") else str(ed_val)
                    except (KeyError, IndexError):
                        pass
        except Exception:
            pass

        revenue_history = []
        try:
            q_fin = _get_quarterly_income(stock)
            if q_fin is not None and "Total Revenue" in q_fin.index:
                for col in q_fin.columns[:4]:
                    rv = _safe_float(q_fin.loc["Total Revenue", col])
                    date_str = str(col.date()) if hasattr(col, "date") else str(col)
                    revenue_history.append({
                        "date": date_str,
                        "revenue_actual_billions": round(rv / 1e9, 2) if rv else None,
                    })
        except Exception:
            pass

        total = beat_count + miss_count
        beat_miss = (
            f"{beat_count} beat{'s' if beat_count != 1 else ''}, "
            f"{miss_count} miss{'es' if miss_count != 1 else ''} in last {total} quarters"
            if total > 0 else "Insufficient data"
        )

        return {
            "ticker": ticker.upper(),
            "last_earnings_date": last_earnings_date,
            "next_earnings_date": next_earnings_date,
            "eps_history": eps_history,
            "revenue_history": revenue_history,
            "beat_miss_record": beat_miss,
            "has_transcript": False,
            "note": (
                "Full earnings call transcripts require a premium data provider. "
                "Financial metrics and beat/miss history sourced from yfinance."
            ),
        }
    except Exception as e:
        return {"error": str(e), "ticker": ticker.upper()}


# ─── Tool 2: analyze_guidance_credibility ────────────────────────────────────

def analyze_guidance_credibility(ticker: str) -> dict:
    try:
        stock = yf.Ticker(ticker.upper())
        q_fin = _get_quarterly_income(stock)
        q_cf = _get_quarterly_cashflow(stock)

        revenue_vals, gross_margins, op_margins = [], [], []

        if q_fin is not None and not q_fin.empty:
            if "Total Revenue" in q_fin.index:
                for col in q_fin.columns[:4]:
                    revenue_vals.append(_safe_float(q_fin.loc["Total Revenue", col]))

            if "Gross Profit" in q_fin.index and "Total Revenue" in q_fin.index:
                for col in q_fin.columns[:4]:
                    gp = _safe_float(q_fin.loc["Gross Profit", col])
                    rv = _safe_float(q_fin.loc["Total Revenue", col])
                    gross_margins.append(round((gp / rv) * 100, 2) if gp and rv and rv != 0 else None)

            op_key = next((k for k in ["Operating Income", "EBIT"] if k in q_fin.index), None)
            if op_key and "Total Revenue" in q_fin.index:
                for col in q_fin.columns[:4]:
                    op = _safe_float(q_fin.loc[op_key, col])
                    rv = _safe_float(q_fin.loc["Total Revenue", col])
                    op_margins.append(round((op / rv) * 100, 2) if op and rv and rv != 0 else None)

        fcf_vals = []
        if q_cf is not None and not q_cf.empty:
            cf_key = next(
                (k for k in ["Free Cash Flow", "Operating Cash Flow"] if k in q_cf.index), None
            )
            if cf_key:
                for col in q_cf.columns[:4]:
                    fcf_vals.append(_safe_float(q_cf.loc[cf_key, col]))

        revenue_trend = _trend(revenue_vals)
        margin_trend = _trend(gross_margins)
        op_margin_trend = _trend(op_margins)
        fcf_trend = _trend(fcf_vals)

        deteriorating = []
        if margin_trend == "declining":
            deteriorating.append("gross margin")
        if op_margin_trend == "declining":
            deteriorating.append("operating margin")
        if revenue_trend == "declining":
            deteriorating.append("revenue")
        if fcf_trend == "declining":
            deteriorating.append("free cash flow")

        info = stock.info
        eps_fwd = _safe_float(info.get("forwardEps"))
        eps_ttm = _safe_float(info.get("trailingEps"))
        eps_trend = (
            "growing" if eps_ttm and eps_fwd and eps_fwd > eps_ttm
            else "declining" if eps_ttm and eps_fwd and eps_fwd < eps_ttm
            else "unknown"
        )

        beat_count, miss_count = 0, 0
        try:
            ed = stock.earnings_dates
            if ed is not None and not ed.empty:
                for _, row in ed.head(4).iterrows():
                    a = _safe_float(row.get("Reported EPS"))
                    e = _safe_float(row.get("EPS Estimate"))
                    if a is not None and e is not None:
                        if a >= e:
                            beat_count += 1
                        else:
                            miss_count += 1
        except Exception:
            pass

        total = beat_count + miss_count
        beat_rate = beat_count / total if total > 0 else 0.5
        base_score = round(beat_rate * 10)
        score = max(1, min(10, base_score - len(deteriorating)))

        if score >= 7:
            label = "Highly Credible"
        elif score >= 4:
            label = "Moderately Credible"
        else:
            label = "Low Credibility"

        beat_miss_str = (
            f"{beat_count} beats, {miss_count} misses in last {total} quarters"
            if total > 0 else "Insufficient data"
        )

        return {
            "ticker": ticker.upper(),
            "credibility_score": score,
            "credibility_label": label,
            "revenue_trend": revenue_trend,
            "margin_trend": margin_trend,
            "op_margin_trend": op_margin_trend,
            "fcf_trend": fcf_trend,
            "eps_trend": eps_trend,
            "deteriorating_metrics": deteriorating,
            "beat_miss_record": beat_miss_str,
            "gross_margins": [m for m in gross_margins if m is not None],
            "op_margins": [m for m in op_margins if m is not None],
            "analysis": (
                f"Score based on {beat_count}/{total} EPS beats and "
                f"{len(deteriorating)} deteriorating metric(s)."
                if total > 0 else
                "Insufficient earnings history to score credibility."
            ),
        }
    except Exception as e:
        return {"error": str(e), "ticker": ticker.upper()}


# ─── Tool 3: detect_narrative_vs_reality ─────────────────────────────────────

def detect_narrative_vs_reality(
    ticker: str,
    earnings_data: dict,
    guidance_data: dict,
    transcript_text: str = "",
) -> dict:
    flags = []

    score = guidance_data.get("credibility_score", 5)
    revenue_trend = guidance_data.get("revenue_trend", "unknown")
    margin_trend = guidance_data.get("margin_trend", "unknown")
    op_margin_trend = guidance_data.get("op_margin_trend", "unknown")
    fcf_trend = guidance_data.get("fcf_trend", "unknown")
    deteriorating = guidance_data.get("deteriorating_metrics", [])
    beat_miss = earnings_data.get("beat_miss_record", "")
    gross_margins = guidance_data.get("gross_margins", [])

    beats_count = beat_miss.lower().count("beat")

    if margin_trend == "declining" and beats_count >= 2:
        flags.append({
            "type": "Beating a Conservative Bar",
            "severity": "MEDIUM",
            "explanation": (
                "EPS beats are occurring alongside declining margins. "
                "Management appears to be guiding conservatively enough to manufacture easy wins "
                "while the underlying profitability deteriorates."
            ),
            "what_to_watch": (
                "Ask directly: is guidance set below internal forecasts to ensure a beat? "
                "Request the internal vs. external guidance range."
            ),
        })

    if margin_trend == "declining" and revenue_trend in ("growing", "flat"):
        flags.append({
            "type": "Margin Compression Hidden by Revenue Growth",
            "severity": "HIGH",
            "explanation": (
                "Revenue is growing but gross margins are contracting — profitability per dollar "
                "of revenue is declining even as the top line grows. "
                "This is often obscured in headline EPS when buybacks are simultaneously reducing share count."
            ),
            "what_to_watch": (
                "Ask management to break out gross margin guidance ex-stock-based compensation "
                "and ex-one-time items, with a specific recovery timeline."
            ),
        })

    if fcf_trend == "declining" and margin_trend != "declining":
        flags.append({
            "type": "Free Cash Flow Diverging from Reported Earnings",
            "severity": "HIGH",
            "explanation": (
                "Operating margins appear stable but free cash flow is declining. "
                "This divergence typically signals rising capex, working capital build-up, "
                "or aggressive revenue recognition ahead of cash collection."
            ),
            "what_to_watch": (
                "Request a line-item bridge from net income to free cash flow. "
                "Ask specifically about accounts receivable days and capex intensity for next 2 quarters."
            ),
        })

    if revenue_trend == "declining":
        flags.append({
            "type": "Revenue Deceleration",
            "severity": "HIGH",
            "explanation": (
                "Revenue has been declining over the trailing quarters. "
                "Any management guidance citing 'strong demand,' 'robust pipeline,' or "
                "'accelerating momentum' is directly contradicted by this data."
            ),
            "what_to_watch": (
                "Demand a specific revenue inflection quarter with the named catalyst. "
                "Reject any answer that uses narrative language without attaching a number and date."
            ),
        })

    if score <= 4:
        flags.append({
            "type": "Guidance Track Record: Low Confidence",
            "severity": "HIGH",
            "explanation": (
                f"Management credibility score is {score}/10 based on historical beat/miss record "
                f"({beat_miss}). Prior guidance has consistently failed to predict actual results."
            ),
            "what_to_watch": (
                "Apply a systematic discount to all forward guidance. "
                "Ask what has specifically changed in the forecasting process."
            ),
        })

    hedging_score = 0
    confidence_score = 0
    omitted_topics = []

    if transcript_text:
        tl = transcript_text.lower()
        hedging = ["we expect", "we anticipate", "we believe", "we hope",
                   "subject to", "assuming", "we think", "we project"]
        confident = ["we will", "we are on track", "committed to",
                     "we are confident", "we have visibility"]
        for p in hedging:
            hedging_score += tl.count(p)
        for p in confident:
            confidence_score += tl.count(p)

        if hedging_score > confidence_score * 2:
            flags.append({
                "type": "Heavy Hedging Language in Transcript",
                "severity": "MEDIUM",
                "explanation": (
                    f"Found {hedging_score} hedging phrases vs {confidence_score} confident "
                    "statements. Management is using unusually cautious language, suggesting "
                    "internal uncertainty about the guidance being communicated."
                ),
                "what_to_watch": (
                    "Note every 'we expect' and 'we anticipate' — ask for the specific "
                    "number behind each projection."
                ),
            })

        sentences = transcript_text.split(".")
        deflection_count = sum(
            1 for s in sentences if len(s.strip()) > 60 and not any(c.isdigit() for c in s)
        )
        if deflection_count > 5:
            flags.append({
                "type": "Deflection Pattern: Answers Without Numbers",
                "severity": "MEDIUM",
                "explanation": (
                    f"{deflection_count} long answers contained no numerical data. "
                    "Management may be using narrative language to avoid quantitative commitments."
                ),
                "what_to_watch": (
                    "Re-read these sections specifically. Any answer to a quantitative question "
                    "that contains no number is a non-answer."
                ),
            })

        watch_topics = ["china", "supply chain", "inventory", "margin",
                        "competition", "guidance", "capex", "pricing"]
        omitted_topics = [t for t in watch_topics if t not in tl]

    high_count = sum(1 for f in flags if f["severity"] == "HIGH")
    if high_count >= 2 or score <= 3:
        overall_risk = "HIGH"
    elif high_count == 1 or score <= 5 or len(deteriorating) >= 2:
        overall_risk = "MEDIUM"
    else:
        overall_risk = "LOW"

    return {
        "ticker": ticker.upper(),
        "flags": flags,
        "hedging_score": min(10, hedging_score),
        "confidence_score": min(10, confidence_score),
        "omitted_topics": omitted_topics,
        "overall_risk": overall_risk,
        "flag_count": len(flags),
    }


# ─── Tool 4: generate_decoder_questions ──────────────────────────────────────

def generate_decoder_questions(
    ticker: str,
    flags: list,
    credibility_data: dict,
    transcript_text: str = "",
) -> dict:
    questions = []
    deteriorating = credibility_data.get("deteriorating_metrics", [])
    gross_margins = credibility_data.get("gross_margins", [])
    op_margins = credibility_data.get("op_margins", [])
    revenue_trend = credibility_data.get("revenue_trend", "unknown")
    fcf_trend = credibility_data.get("fcf_trend", "unknown")
    score = credibility_data.get("credibility_score", 5)
    beat_miss = credibility_data.get("beat_miss_record", "")

    if "gross margin" in deteriorating and gross_margins:
        recent = round(gross_margins[0], 1)
        older = round(gross_margins[-1], 1) if len(gross_margins) > 1 else "N/A"
        questions.append({
            "question": (
                f"Gross margin has moved from ~{older}% to ~{recent}% over the past "
                f"{len(gross_margins)} quarters. What is the specific path back to expansion, "
                "and in which quarter do you expect to see inflection?"
            ),
            "why_it_matters": (
                "Gross margin compression is the single most reliable leading indicator of "
                "pricing power loss. Without a specific recovery timeline tied to a named catalyst, "
                "this trend will continue."
            ),
            "good_answer": (
                "A specific number: 'we expect gross margin to recover to X% by Q[N] due to "
                "[named cost initiative]' — with a date and a dollar amount."
            ),
            "bad_answer": (
                "'Long-term value creation,' 'we are investing in the business,' "
                "or 'mix headwinds' without attaching a number to any of those phrases."
            ),
            "dodge_risk": "HIGH",
        })

    if "operating margin" in deteriorating and op_margins:
        recent = round(op_margins[0], 1)
        questions.append({
            "question": (
                f"Operating margin is currently ~{recent}% and has been contracting. "
                "Can you provide operating margin guidance broken out by segment with specific "
                "dollar amounts for the next two quarters?"
            ),
            "why_it_matters": (
                "Operating leverage is the core efficiency thesis for any growth stock. "
                "If operating margin is not expanding as revenue grows, "
                "the entire efficiency narrative is broken."
            ),
            "good_answer": (
                "Segment-level operating margin targets with specific percentages, "
                "a timeline, and the named driver."
            ),
            "bad_answer": (
                "'Disciplined cost management' or 'investing for growth' "
                "without numerical targets attached."
            ),
            "dodge_risk": "HIGH",
        })

    if revenue_trend == "declining":
        questions.append({
            "question": (
                "Revenue has declined for multiple consecutive quarters. "
                "At what specific revenue run-rate and in which quarter do you expect "
                "to return to growth, and what is the single biggest variable that could "
                "prevent that?"
            ),
            "why_it_matters": (
                "Declining revenue with continued cost spend is the fastest path to a cash "
                "flow crisis. The market needs a specific bottom, not a narrative of patience."
            ),
            "good_answer": (
                "A specific quarter, a specific dollar amount, and a named single catalyst "
                "(product launch, geographic expansion, specific contract)."
            ),
            "bad_answer": (
                "'Challenging macro environment,' 'softness in the market,' or any answer "
                "that does not name a specific recovery quarter."
            ),
            "dodge_risk": "HIGH",
        })

    if fcf_trend == "declining":
        questions.append({
            "question": (
                "Free cash flow has been declining while reported earnings appear stable. "
                "Can you walk through the specific working capital and capex changes "
                "driving this divergence, line by line?"
            ),
            "why_it_matters": (
                "A gap between reported earnings and cash flow is one of the highest-quality "
                "warning signs in financial analysis. The business may appear profitable "
                "while actually consuming cash."
            ),
            "good_answer": (
                "A line-item bridge from net income to FCF with specific numbers, "
                "and a timeline for normalization."
            ),
            "bad_answer": (
                "Any response that does not directly explain why free cash flow and "
                "net income are diverging."
            ),
            "dodge_risk": "HIGH",
        })

    if score <= 5:
        questions.append({
            "question": (
                f"Your guidance track record over the past 4 quarters is {beat_miss}, "
                f"giving a credibility score of {score}/10. "
                "What has specifically changed about your forecasting methodology that would "
                "give investors confidence in today's guidance?"
            ),
            "why_it_matters": (
                "Consistent guidance misses cause systematic multiple compression "
                "regardless of underlying business quality. Investors discount all forward "
                "guidance from low-credibility management teams."
            ),
            "good_answer": (
                "A specific change to the forecasting process — a new methodology, "
                "external validation, or explicit conservatism targets with measurement."
            ),
            "bad_answer": (
                "Pivoting to positives or forward-looking statements without "
                "directly acknowledging the miss history."
            ),
            "dodge_risk": "MEDIUM",
        })

    if "gross margin" in deteriorating or "operating margin" in deteriorating:
        questions.append({
            "question": (
                "EPS beats have continued while margins contract. "
                "What specific percentage of EPS performance over the past 4 quarters "
                "is attributable to share buybacks versus actual operating improvement? "
                "Please separate these clearly."
            ),
            "why_it_matters": (
                "Buyback-driven EPS growth masks deteriorating business quality. "
                "A company can beat EPS estimates indefinitely through financial engineering "
                "while the underlying profitability weakens."
            ),
            "good_answer": (
                "The exact EPS contribution from share count reduction vs. operational "
                "improvement, presented as separate line items."
            ),
            "bad_answer": (
                "Treating buybacks and operational improvement as equivalent contributors "
                "to shareholder value without separating them."
            ),
            "dodge_risk": "MEDIUM",
        })

    if len(questions) < 6:
        questions.append({
            "question": (
                f"Over the next 12 months, which single segment or product line "
                f"carries the most uncertainty in your internal model, "
                "and what is the range of outcomes — best case vs. base case — you are planning for?"
            ),
            "why_it_matters": (
                "Management's willingness to identify their own uncertainty is one of the "
                "strongest credibility signals available. Companies that claim high visibility "
                "across all segments in an uncertain environment are guessing."
            ),
            "good_answer": (
                "Names a specific segment, gives a revenue range for best vs. base case, "
                "and identifies the single key variable that determines the outcome."
            ),
            "bad_answer": (
                "Claims strong visibility across all segments, or gives a range so wide "
                "it provides no information."
            ),
            "dodge_risk": "LOW",
        })

    # Top 3 numbers to watch
    top_3 = []

    if "gross margin" in deteriorating and gross_margins:
        floor = round(gross_margins[-1] - 3, 1) if len(gross_margins) > 1 else round(gross_margins[0] - 5, 1)
        top_3.append({
            "metric": "Gross Margin %",
            "why": (
                f"Has been contracting to ~{round(gross_margins[0], 1)}%. "
                "This is the first indicator of pricing power and competitive pressure — "
                "it deteriorates before anything else does."
            ),
            "threshold": f"Below {floor}% = serious concern requiring immediate position review.",
        })

    if "operating margin" in deteriorating and op_margins:
        floor = round(op_margins[-1] - 5, 1) if len(op_margins) > 1 else round(op_margins[0] - 7, 1)
        top_3.append({
            "metric": "Operating Margin %",
            "why": (
                f"Declining — currently ~{round(op_margins[0], 1)}%. "
                "Operating leverage is the core thesis for growth stocks. "
                "If this does not expand as revenue grows, the efficiency story is broken."
            ),
            "threshold": f"Below {floor}% = operating leverage story is broken; reassess thesis.",
        })

    if revenue_trend == "declining":
        top_3.append({
            "metric": "Quarterly Revenue Growth Rate (QoQ)",
            "why": (
                "Revenue has been declining. The first positive inflection — "
                "even a deceleration in the decline — is the most important signal to watch. "
                "Two consecutive quarters of sequential decline without a catalyst = re-evaluate."
            ),
            "threshold": "Any two consecutive sequential declines without a named catalyst = full review.",
        })

    if len(top_3) < 3:
        top_3.append({
            "metric": "Free Cash Flow Conversion Rate",
            "why": (
                "The ratio of free cash flow to net income tells you whether reported "
                "earnings quality is real or accounting-driven. Divergence is a leading warning."
            ),
            "threshold": "FCF conversion below 80% of net income for two consecutive quarters = earnings quality concern.",
        })

    if len(top_3) < 3:
        top_3.append({
            "metric": "EPS Beat/Miss Spread",
            "why": (
                f"Current record: {beat_miss}. The magnitude of beats or misses matters "
                "as much as the direction. Narrowing beats signal guidance is becoming harder to beat."
            ),
            "threshold": "Two consecutive misses after a string of beats = guidance methodology has changed; reassess all forward estimates.",
        })

    return {
        "ticker": ticker.upper(),
        "questions": questions[:6],
        "top_3_numbers_to_watch": top_3[:3],
    }


# ─── Tool registry ────────────────────────────────────────────────────────────

TOOL_MAP = {
    "fetch_transcript": fetch_transcript,
    "analyze_guidance_credibility": analyze_guidance_credibility,
    "detect_narrative_vs_reality": detect_narrative_vs_reality,
    "generate_decoder_questions": generate_decoder_questions,
}

TOOLS = [
    {
        "name": "fetch_transcript",
        "description": (
            "Fetch earnings history and beat/miss record for a ticker. Returns the last 4 quarters "
            "of EPS actuals vs estimates, quarterly revenue history, beat/miss summary string, "
            "last earnings date, and next expected earnings date."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol, e.g. 'AAPL'."},
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "analyze_guidance_credibility",
        "description": (
            "Analyze quarterly financial trends and score management credibility 1–10. "
            "Returns revenue trend, gross margin trend, operating margin trend, FCF trend, "
            "list of deteriorating metrics, beat/miss record, and a credibility score with label."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol."},
            },
            "required": ["ticker"],
        },
    },
    {
        "name": "detect_narrative_vs_reality",
        "description": (
            "Cross-reference financial data against typical management narrative patterns. "
            "Detects red flags: margin compression hidden by buybacks, beating a conservative bar, "
            "FCF divergence, revenue deceleration, low credibility score, and transcript hedging. "
            "Returns flags with HIGH/MEDIUM/LOW severity and an overall risk rating."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol."},
                "earnings_data": {
                    "type": "object",
                    "description": "Output dict from the fetch_transcript tool.",
                },
                "guidance_data": {
                    "type": "object",
                    "description": "Output dict from the analyze_guidance_credibility tool.",
                },
                "transcript_text": {
                    "type": "string",
                    "description": "Optional earnings call transcript text pasted by the user. Pass empty string if not available.",
                },
            },
            "required": ["ticker", "earnings_data", "guidance_data"],
        },
    },
    {
        "name": "generate_decoder_questions",
        "description": (
            "Generate the 6 most important analyst questions based on the detected flags and "
            "financial data. Each question is specific to this company's actual numbers, "
            "references a deteriorating or suspicious metric, and includes what a good vs. "
            "bad answer looks like. Also returns the top 3 numbers to watch next quarter."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ticker": {"type": "string", "description": "Stock ticker symbol."},
                "flags": {
                    "type": "array",
                    "description": "List of flag objects from the detect_narrative_vs_reality tool.",
                    "items": {"type": "object"},
                },
                "credibility_data": {
                    "type": "object",
                    "description": "Output dict from the analyze_guidance_credibility tool.",
                },
                "transcript_text": {
                    "type": "string",
                    "description": "Optional earnings call transcript text. Pass empty string if not available.",
                },
            },
            "required": ["ticker", "flags", "credibility_data"],
        },
    },
]


# ─── Agentic loop ─────────────────────────────────────────────────────────────

def run_earnings_decoder(ticker: str, transcript_text: str = "") -> str:
    ticker = ticker.strip().upper()
    query = f"Run a complete earnings decoder analysis for {ticker}."
    if transcript_text.strip():
        query += f"\n\nEarnings transcript provided by user:\n{transcript_text[:4000]}"

    messages = [{"role": "user", "content": query}]

    print(f"\n{'=' * 60}")
    print(f"EARNINGS DECODER — {ticker}")
    print(f"{'=' * 60}\n")

    while True:
        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            final_text = next(
                (block.text for block in response.content if hasattr(block, "text")), ""
            )
            return final_text

        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue

            fn = TOOL_MAP.get(block.name)
            result = fn(**block.input) if fn else {"error": f"Unknown tool: {block.name}"}

            print(f"[Tool] {block.name} → {list(result.keys()) if isinstance(result, dict) else 'error'}")

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": json.dumps(result),
            })

        messages.append({"role": "assistant", "content": response.content})
        if tool_results:
            messages.append({"role": "user", "content": tool_results})
