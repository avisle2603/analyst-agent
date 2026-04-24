import os
import sys

# Ensure the project root is on the path so tools/schemas imports resolve
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from analyst_agent import run_analyst_agent
from export import generate_docx
from earnings_decoder import run_earnings_decoder
from weekly_signals import run_weekly_signals

app = FastAPI(title="Analyst Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Query(BaseModel):
    query: str


@app.post("/analyze")
async def analyze(body: Query):
    result = run_analyst_agent(body.query)
    return {"result": result}


@app.post("/earnings-decoder")
async def earnings_decoder(body: dict):
    ticker = body.get("ticker", "").strip().upper()
    transcript = body.get("transcript", "")
    result = run_earnings_decoder(ticker, transcript)
    return {"decoder": result, "ticker": ticker}


@app.post("/export/earnings-decoder")
async def export_earnings_decoder(body: dict):
    from fastapi.responses import Response as FastAPIResponse
    ticker = body.get("ticker", "").strip().upper()
    transcript = body.get("transcript", "")
    result = run_earnings_decoder(ticker, transcript)
    doc_bytes = generate_docx(result, f"Earnings Decoder: {ticker}")
    from datetime import datetime as _dt
    filename = f"earnings_decoder_{ticker}_{_dt.now().strftime('%Y%m%d_%H%M%S')}.docx"
    return FastAPIResponse(
        content=doc_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.post("/weekly-signals")
async def weekly_signals():
    result = run_weekly_signals()
    return result


@app.post("/export/docx")
async def export_docx(body: Query):
    result = run_analyst_agent(body.query)
    doc_bytes = generate_docx(result, body.query)
    filename = f"analyst_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
    return Response(
        content=doc_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
