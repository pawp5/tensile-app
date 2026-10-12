# Tensile

Tensile connects physical metal held in warehouses to on-chain material passports. The system tracks provenance and
reserve data, supports identity checks and inspections, and provides the foundation for financing, trading, and
redemption.

## How the system works

```text
Web app ── REST API ── MongoDB
   │          │            ▲
   │          └── EVM chains│
   └── wallet transactions  │
          Indexer ──────────┘
          Worker ────────── chains
```

- **Web app** presents portfolios, lots, onboarding, tokenization, and inspection workflows. Users connect a wallet
  and sign their own on-chain transactions.
- **API** handles sign-in, application data, evidence files, and reads from indexed data. It prepares and simulates
  transactions; it does not hold user keys.
- **Indexer** reads contract events and builds MongoDB records used by the app.
- **Worker** performs protocol upkeep with a service wallet, such as updating reserve and price data and processing
  mint requests.
- **Contracts** record material passports and protocol state on supported EVM chains. Chain addresses and metadata
  are configured in the backend.

## Repository

- [`tensile-FE/`](tensile-FE/Readme.md) — React, TypeScript, Vite, wagmi, and viem web app.
- [`tensile-BE/`](tensile-BE/Readme.md) — FastAPI API, MongoDB integration, chain indexer, and worker.

## Run locally

Start MongoDB and configure the backend first. See the [backend guide](tensile-BE/Readme.md) for environment
variables, chain setup, and service options.

```bash
cd tensile-BE
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Configure tensile-BE/.env, including JWT_SECRET and chain RPC settings.
uvicorn app.main:app --reload --port 8000
```

In another terminal:

```bash
cd tensile-FE
npm install
npm run dev
```

The app runs at `http://localhost:3000`; the API docs are at `http://localhost:8000/docs`. Set `VITE_API_URL` in
`tensile-FE/.env.local` if the API is hosted elsewhere. Enable the backend indexer and worker when you want the
background chain services to run (`RUN_INDEXER=true` and `RUN_WORKER=true`).
