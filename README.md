# Buidace Statement Analyzer

A **local-first** bank statement analyzer that runs entirely in your browser. Upload CSV or PDF statements, explore income and spending, detect duplicates and recurring payments, and export a summary report for a financial advisor or AI.

**Live app:** [chike523.github.io/Buidace-Statement-Analyzer](https://chike523.github.io/Buidace-Statement-Analyzer/)

## Features

- **CSV & PDF import** — digital PDFs and scanned statements (OCR via Tesseract, lazy-loaded)
- **Multi-account** — import statements from different banks or wallets
- **Overview dashboard** — income, expenses, net flow, monthly charts
- **Transactions** — virtualized table with filters and name search
- **Review** — duplicate detection and internal transfer pairs
- **Recurring payments** — automatic pattern detection
- **Export report** — download or copy a Markdown summary for advisors or AI tools
- **Privacy** — data stays in your browser tab; nothing is uploaded to a server

## Supported formats

| Format | Notes |
|--------|--------|
| CSV | Column mapping with auto-detect |
| Digital PDF | Text extraction via pdf.js |
| Scanned PDF | OCR fallback when no text layer |
| OPay PDF | Optimized parser for OPay statement layout |

## Quick start (local)

```bash
git clone https://github.com/chike523/Buidace-Statement-Analyzer.git
cd Buidace-Statement-Analyzer
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Build

```bash
npm run build
npm run preview
```

## How to use

1. **Import** — drop a CSV or PDF on the welcome screen
2. **Review** — confirm parsed rows and create or select an account
3. **Overview** — use toggles to exclude internal transfers or group payees
4. **Transactions** — filter, search, and drill into line items
5. **Review tab** — resolve duplicate groups and check transfer pairs
6. **Export report** — header button downloads `financial-summary-YYYY-MM-DD.md` or copies to clipboard

## Tech stack

- React 19 + TypeScript + Vite
- [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview) for analytics
- pdf.js, Papa Parse, Tesseract.js, Recharts

## Deployment

The app is a static site. GitHub Pages deploys automatically on push to `main` via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

To enable Pages (first time only):

1. Repo **Settings → Pages**
2. **Build and deployment → Source:** GitHub Actions

## Privacy

All parsing and analysis happen in your browser. Closing the tab clears session data unless you keep the tab open. The hosted site does not receive your statement files or transaction data.

## License

Private / all rights reserved unless otherwise specified by the repository owner.
