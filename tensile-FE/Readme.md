# Tensile frontend

The web app for **Tensile**: tokenized physical metal. Owners turn warehouse-held lots into on-chain material
passports, borrow against them, trade and redeem them. Lenders supply USDC, and inspectors and operations staff
attest and run the protocol.

- **Vite 6 + React 18 + TypeScript**, React Router 6, TanStack Query 5.
- **wagmi 3 + viem 2** for wallets. Users sign their own transactions; the API prepares and simulates.
- **Design-faithful:** every screen is built from the design exports (`*.dc.html`), with the same markup and
  `t-*` classes and the `tensile.css` tokens. That includes the rotating orb on the landing page.
- **Multi-chain:** the chain switcher in the top bar lists every chain the API serves (`/v1/chains`).

> **Build status.** Screens marked **Live** are wired to the API and the chain. **Design** screens still render
> the static export and get wired in the stage shown.

| Stage | Screens | Status |
|---|---|---|
| 1–2 | Shell (top bar, sidebar, chain switcher, wallet, sign-in), Landing (live figures), Overview | Live |
| 3 | Onboarding / KYC (applicant and staff review), Lots and lot passport, Operations console (queue) | Live |
| 4 | Tokenize (7 steps), Inspector workspace | Live |
| 5 | Borrow, Lend, testnet USDC faucet | Planned |
| 6 | Marketplace, Purchase (atomic settlement), RFQ, Portfolio | Planned |
| 7 | Redemptions, Disputes, Reserve health | Planned |
| 8 | Liquidation and risk, console risk parameters, global states, mobile polish | Planned |

---

## Contents

1. [Quick start](#quick-start)
2. [Configuration](#configuration)
3. [Project layout](#project-layout)
4. [Routes and screens](#routes-and-screens)
5. [Session, wallets and sign-in](#session-wallets-and-sign-in)
6. [Data fetching](#data-fetching)
7. [Transactions](#transactions)
8. [Contract ABIs](#contract-abis)
9. [Design system and the design exports](#design-system-and-the-design-exports)
10. [Personas and permissions](#personas-and-permissions)
11. [Building and deploying](#building-and-deploying)
12. [Conventions](#conventions)
13. [Troubleshooting](#troubleshooting)

---

## Quick start

Requirements: **Node 20+** and npm, a running backend (see `../backend/README.md`), and a browser wallet
(MetaMask, Rabby or any EIP-6963 wallet).

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

| Script | |
|---|---|
| `npm run dev` | Dev server on port **3000** |
| `npm run build` | Type-check, then a production build into `dist/` |
| `npm run preview` | Serve `dist/` locally |

The backend's `SIWE_DOMAINS` must include the host you open the app on, e.g. `localhost:*`. Otherwise sign-in
fails with *"Sign-in domain … is not allowed"*.

---

## Configuration

| Variable | Default | |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000/v1` | Backend base URL, including `/v1` |

Put it in `frontend/.env.local` for development or set it in the build environment. Vite inlines it **at build
time**, so changing it needs a rebuild. Everything else (chains, RPC URLs, explorers, contract addresses) comes from
`GET /v1/chains` at start-up. Nothing chain-specific is hard-coded.

---

## Project layout

```
frontend/
├── index.html
├── vite.config.ts
├── public/
│   └── design-assets/          images and fonts from the design exports (the Tensile mark, etc.)
├── tools/
│   └── dc2react.mjs            converts design exports (*.dc.html) into React components
└── src/
    ├── main.tsx                providers: session (wagmi + React Query), router
    ├── App.tsx                 routes; in-app handling of the designs' <a href="/…"> links; toast
    ├── abis/                   contract ABIs as typed `as const` modules (generated, don't edit)
    ├── lib/
    │   ├── api.ts              fetch wrapper: api(), apiForm() (uploads), apiBlob() (downloads), ApiError
    │   ├── types.ts            API types, mirroring backend/app/core/schemas.py (camelCase)
    │   ├── format.ts           number, money, tonnes and time formatting (en-US, as in the designs)
    │   ├── tx.ts               useTx(): switch chain → simulate → sign → wait for receipt, readable errors
    │   ├── web3.ts             wagmi config from /v1/chains, shortAddress()
    │   └── activityIcons.ts    activity row icons
    ├── state/
    │   ├── session.tsx         chains, selected chain, wallet, SIWE sign-in, /me, persona, error toast
    │   ├── protocol.ts         warehouses, prices, stats, sync (public, polled)
    │   ├── account.ts          KYC, portfolio, activity, notifications, lots, search, ops queue
    │   └── minting.ts          tokenize drafts and requests, inspections, reinspection orders
    ├── shell/
    │   ├── TopBar.tsx          breadcrumb, search, network badge and chain switcher, notifications, wallet
    │   ├── Sidebar.tsx         navigation, "Viewing as" persona switch, identity card
    │   ├── Popover.tsx         menus
    │   └── shell.css
    └── design/
        ├── tensile.css         design tokens and the t-* classes every screen uses
        ├── runtime.ts          DCLogic base class used by generated components
        ├── Orb.tsx, Landing.tsx                     generated, then wired (orb rotates on the landing page)
        ├── Overview.tsx, Onboarding.tsx, LotPassport.tsx, Operations.tsx, Inspector.tsx    wired screens
        ├── Tokenize.tsx + tokenize/                 route + draft view, request view, step panels, shared pieces
        ├── Borrow, Lend, Marketplace, Purchase, RFQ, Portfolio, Redemption, Dispute,
        │   ReserveHealth, Liquidation, States, Film  design screens (wired by later stages)
        └── *.css                                    per-screen styles from the exports
```

---

## Routes and screens

| Path | Screen | Status | Notes |
|---|---|---|---|
| `/` | Landing | Live | Live protocol figures; orb rotates through warehouses |
| `/overview` | Overview | Live | Portfolio value, holdings by material, sites on the orb, activity |
| `/onboarding` | Identity (KYC) | Live | Organisation details, documents, submit, attestation progress |
| `/onboarding/review/:address` | KYC review | Live | KYC_ADMIN approves (writes identity on every chain) or rejects |
| `/lots` | Lots | Live | Your lots |
| `/lots/:tokenId` | Material passport | Live | Provenance, attestations, reserve health, history |
| `/tokenize` | Tokenize: new request | Live | Steps 1–2 as a draft, plus your drafts and requests |
| `/tokenize?draft=<id>` | Tokenize: draft | Live | Details, evidence upload, **Submit for review** signs `requestMint` |
| `/tokenize?request=<id>` | Tokenize: request | Live | Review, inspection, custody, reserve, **Mint passport** signs `finalizeMint`; risk override / reject; cancel; expire |
| `/inspections` (`?ref=MR-0003`) | Inspector workspace | Live | Queue, record form, seal and sign `attest` / `rejectRequest`, history, reinspection orders |
| `/console` | Operations console | Live (queue) | Work queue across modules; risk parameters wired in Stage 8 |
| `/borrow` | Borrow | Stage 5 | Quote, open loan, borrow more, repay, close (`CreditRouter`) |
| `/lend` | Lend | Stage 5 | Vault deposit / withdraw (ERC-4626), APY, utilization; testnet faucet |
| `/marketplace` | Marketplace | Stage 6 | Listings, list / cancel, bids |
| `/marketplace/buy` | Purchase | Stage 6 | Atomic settlement: the buyer pays, the seller's loan is paid off, the passport transfers |
| `/marketplace/rfq` | RFQ | Stage 6 | Place / accept / cancel bids |
| `/portfolio` | Portfolio | Stage 6 | Lots, loans, vault position, trades |
| `/redemptions` | Redemption | Stage 7 | Request redemption, release, cancel, dispute |
| `/disputes` | Disputes | Stage 7 | Operations dispute handling, reinspection, freeze / unfreeze |
| `/reserve` (`?wh=CODE`) | Reserve health | Stage 7 | Coverage per warehouse, feed history, breaches |
| `/risk` | Liquidation and risk | Stage 8 | Positions near liquidation, liquidations, class parameters |
| `/states` | Global UX states | Stage 8 | Empty, loading, error and frozen states reference |
| `/film` | Product film | — | Demo film from the design export |

Links inside the designs are plain `<a href="/…">`. `App.tsx` intercepts them and routes in-app, without a page
reload. The backend's links (notifications, search results, the ops queue) use the same paths.

---

## Session, wallets and sign-in

`state/session.tsx` provides `useSession()`:

| Field | |
|---|---|
| `chains`, `chain`, `selectChain(id)`, `wrongNetwork` | Chains from `/v1/chains`; the selected one drives every query |
| `address`, `isConnected`, `signedIn`, `signingIn`, `signIn()`, `signOut()` | Wallet and session |
| `me` | `/chains/{id}/me`: roles, personas and identity on the selected chain |
| `persona`, `personas`, `setPersona()` | The "Viewing as" switch |
| `error`, `setError()` | The toast at the bottom right; `errorMessage(e)` turns any error into a sentence |

Sign-in is **SIWE**:

1. Connect a wallet. Wallets announce themselves through EIP-6963.
2. Sign the EIP-4361 message for the current host.
3. The backend returns a JWT, which `lib/api.ts` sends as a bearer token.

Switching chains changes which chain the queries read. Wallet transactions switch the wallet's network first.

---

## Data fetching

- **TanStack Query** hooks per area (`state/*.ts`). Keys always include the chain id and, where it matters, the
  address, so switching chain or wallet never shows stale data.
- **Polling, not sockets:**

  | Data | Interval |
  |---|---|
  | Sync badge | 10 s |
  | Inspection queue | 15 s |
  | Warehouses, stats, portfolio, notifications | 30 s |
  | An open mint request | 5 s |
  | A request that isn't indexed yet (404 right after signing) | 3 s |

- After a transaction, `useRefreshMint()` (and similar hooks in later stages) invalidate the affected queries. The
  page then catches up once the indexer has the new event, usually within a few seconds.
- `lib/api.ts` throws `ApiError(status, code, message, details)` built from the backend's `{"error": {...}}`
  shape.

---

## Transactions

Every on-chain action goes through `useTx()` in `lib/tx.ts`:

```ts
const tx = useTx();
await tx.run('Mint passport', (c) =>
  simulateContract(c.config, {
    address: controller, abi: MintingControllerAbi, functionName: 'finalizeMint',
    args: [BigInt(requestId)], account: c.account, chainId: c.chainId,
  }));
```

1. **Switch** the wallet to the selected chain if needed.
2. **Simulate.** A revert shows the contract's reason (e.g. *"Waiting for the inspection attestation."*) before
   the wallet opens.
3. **Sign** in the wallet, then **wait** for the receipt.
4. **Errors become sentences:** custom errors via a map in `tx.ts`, and wallet refusals as *"You rejected the
   request in your wallet."*

`tx.status` gives button labels: *Confirm in wallet…*, *Waiting for confirmation…*. `TxError.hash` and `.reverted`
tell a refused or failed transaction apart from one still pending.

Because the ABIs are `as const`, `functionName` and `args` are type-checked against the contract. A wrong
argument is a compile error.

| Flow | Calls (signed by the user) |
|---|---|
| Tokenize | `ERC20.approve` (only with a mint fee) → `MintingController.requestMint`; later `finalizeMint` / `cancelRequest` / `expireRequest` |
| Risk review | `MintingController.overrideAi`, `rejectRequest` |
| Inspection | `AttestationRegistry.attest(INSPECTION or REINSPECTION, …)` / `MintingController.rejectRequest` |
| Credit (Stage 5) | `CreditRouter.openLoan`, `borrowMore`, `repay`, `closeLoan`; vault `deposit`, `withdraw`, `redeem`; `MockUSDC.faucet` |
| Market (Stage 6) | `Marketplace.list`, `buy`, `cancelListing`, `placeBid`, `acceptBid`, `cancelBid` (plus `approve` for the passport and USDC) |
| Redemption (Stage 7) | `RedemptionManager.requestRedemption`, `cancelRedemption`, `raiseDispute` |

---

## Contract ABIs

`src/abis/<Name>.ts` export `<Name>Abi` (`as const`), plus an `index.ts`. They're generated from the Foundry build
by the backend script:

```bash
cd backend && python scripts/export_abis.py     # writes backend/app/abis and frontend/src/abis
```

Run it again after any contract change. Don't edit the files by hand. Addresses are **not** in the ABIs; they come
from `chain.addresses` (`/v1/chains`).

---

## Design system and the design exports

- **`tensile.css`** holds the tokens (colors, type scale, radii, glass surfaces, motion) and the `t-*` classes:
  `t-card`, `t-btn`, `t-badge`, `t-steps`, `t-kv`, `t-table`, `t-alert`, `t-meter`, `t-plate` and so on. Screens
  use these classes and inline styles exactly as the exports do. Prefer an existing class over new CSS.
- **`tools/dc2react.mjs`** converts the design exports (`*.dc.html`: an `<x-dc>` template plus a small logic
  class) into components on the `DCLogic` runtime (`design/runtime.ts`), with per-screen CSS. Assets go to
  `public/design-assets/`.
  - The generated file is a starting point. Once a screen is wired, it's owned by the app and edited by hand.
  - The Orb and Landing keep the generated class form; the other wired screens are plain React components with
    the same markup.
- **The orb** (`design/Orb.tsx`) is context-aware: portfolio sites on Overview, a lot's warehouse on the
  passport, rotation on the landing page.
- **Additions** that the designs didn't specify (failed and blocked step states, the evidence drop zone) live in
  small CSS files next to the screen, e.g. `design/Tokenize.css`.

---

## Personas and permissions

| Persona | Who | Sees |
|---|---|---|
| Owner, Lender, Buyer | Any wallet | Workspace screens; acting on-chain needs a verified identity (KYC tier) |
| Inspector | `INSPECTOR` role on the chain | Inspector workspace |
| Operations / risk | `ADMIN`, `KYC_ADMIN` or `RISK_ADMIN` | Console, KYC review, reserve, risk, disputes, reinspection orders |

- Roles come from `/me`, which reads the chain live, cached for 60 s.
- The persona switch only changes the view. **The backend and the contracts enforce every permission.**
- Staff screens switch to the staff persona automatically when opened.

---

## Building and deploying

```bash
VITE_API_URL=https://<your-api>/v1 npm run build    # → dist/
```

`dist/` is a static single-page app. Any static host works if it **rewrites unknown paths to `index.html`**, so
deep links like `/tokenize?request=3` and `/lots/12` load.

- **Heroku:** serve `dist/` with a static buildpack or a small static server, with SPA fallback to `index.html`.
- **Netlify / Vercel / Cloudflare Pages:** set the build command and output folder (`dist`), and add an SPA
  rewrite.

Then add the deployed host to the backend's `SIWE_DOMAINS` (host only, e.g. `tensile-fe-xxxx.herokuapp.com`).

---

## Conventions

- **Types mirror the backend.** `lib/types.ts` follows `backend/app/core/schemas.py` field for field
  (camelCase). Add types when the backend adds models.
- **One hooks module per area** in `state/`. Screens never call `fetch` directly.
- **Every transaction goes through `useTx`.** It always simulates first and always gives readable errors.
- **Design first.** Copy markup and classes from the export, then replace sample data with live data. Keep
  wording close to the design. Where real data needs a state the design lacks (empty, loading, frozen, failed),
  follow the global UX states export.
- **Chain-agnostic:** no hard-coded addresses, chain ids or explorers.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| *Sign-in domain … is not allowed* | Add this host to the backend's `SIWE_DOMAINS`: `host[:port]`, no `https://`, no path. |
| Dev server: `EACCES` on the port (Windows) | Ports 5141–5240 are often reserved by Hyper-V; the dev server uses **3000**. |
| White page | Check the console: usually `VITE_API_URL` is wrong or the API is down (the app loads `/v1/chains` first). |
| "Wrong network · switch" | The wallet is on another chain. Click the badge, or let the next transaction switch it. |
| Type errors after a contract change | Re-run `export_abis.py`, and check that `src/abis/*.ts` are `as const`. |
| Request page says "on-chain, waiting for the indexer" for long | The backend's indexer is offline or behind. Check the network badge and `/v1/chains/{id}/sync`. |