import json
import os
import sys
from datetime import datetime
from pathlib import Path

import anthropic
from dotenv import load_dotenv

load_dotenv()

from schemas.tool_schemas import TOOL_MAP, TOOLS

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = (
    "You are a senior analyst combining business analytics and financial analysis. "
    "When given a query:\n"
    "1. Always fetch market data first if a ticker is mentioned.\n"
    "2. Compute KPIs from financial statements.\n"
    "3. Scan recent news for sentiment.\n"
    "4. Detect price trends.\n"
    "5. If competitors are mentioned, benchmark them.\n"
    "6. Calculate upside to analyst consensus target.\n"
    "7. Synthesize everything into a structured brief with: Summary, Key Metrics, "
    "Trend Analysis, News Sentiment, Risk Assessment, and Recommendation "
    "(Buy/Hold/Sell with reasoning).\n"
    "Always cite which tools you called and what they returned."
)

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

STOP_MARKER = "=" * 60


def _extract_ticker(query: str) -> str:
    """Best-effort extraction of a ticker symbol from the query string."""
    common_words = {
        "ANALYZE", "COMPARE", "CHECK", "WHAT", "ARE", "THE", "AND", "FOR",
        "OVER", "PAST", "YEAR", "WITH", "MY", "ON", "TO", "OF", "IN", "A",
        "AN", "IS", "IT", "ITS", "PORTFOLIO", "RISK", "TRENDS", "NEWS",
        "INVESTMENT", "CASE", "VERSUS", "VS", "AGAINST",
    }
    for word in query.upper().split():
        cleaned = "".join(c for c in word if c.isalpha())
        if 2 <= len(cleaned) <= 5 and cleaned not in common_words:
            return cleaned
    return "REPORT"


def run_analyst_agent(query: str) -> str:
    messages = [{"role": "user", "content": query}]

    print(f"\n{STOP_MARKER}")
    print(f"ANALYST AGENT")
    print(f"Query : {query}")
    print(f"{STOP_MARKER}\n")

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
                (block.text for block in response.content if hasattr(block, "text")),
                "",
            )

            ticker = _extract_ticker(query)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = OUTPUT_DIR / f"{ticker}_{timestamp}.txt"
            output_file.write_text(final_text, encoding="utf-8")

            print(f"\n{STOP_MARKER}")
            print(f"[Report saved] {output_file}")
            print(f"{STOP_MARKER}\n")

            return final_text

        # Collect tool_use blocks and build results
        tool_results = []

        for block in response.content:
            if block.type != "tool_use":
                continue

            tool_name = block.name
            tool_input = block.input

            print(f"[Tool Call]   {tool_name}({json.dumps(tool_input)})")

            fn = TOOL_MAP.get(tool_name)
            result = fn(**tool_input) if fn else {"error": f"Unknown tool: {tool_name}"}

            print(f"[Tool Result] {json.dumps(result)}\n")

            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result),
                }
            )

        # Extend the conversation
        messages.append({"role": "assistant", "content": response.content})
        if tool_results:
            messages.append({"role": "user", "content": tool_results})


if __name__ == "__main__":
    query = (
        " ".join(sys.argv[1:])
        if len(sys.argv) > 1
        else "Analyze NVDA and compare it against AMD"
    )
    result = run_analyst_agent(query)
    print(result)
