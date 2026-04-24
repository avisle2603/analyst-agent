from export import generate_docx

test_brief = """
## Summary
NVDA is trading at $875.20, showing strong momentum.

## Key Metrics
- Revenue Growth: 122% YoY
- Gross Margin: 74.6%
- P/E Ratio: 65.2x

## Recommendation
BUY — Strong conviction based on data center demand and AI tailwinds.
"""

doc_bytes = generate_docx(test_brief, "Analyze NVDA")
with open("test_output.docx", "wb") as f:
    f.write(doc_bytes)

print("Success! Open test_output.docx to verify the output.")
