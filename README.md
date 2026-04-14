# Lingo

**The smartest savings in DeFi.** Chat in your language, we find the best rates.

Lingo is a chat-first DeFi yield wallet designed for people who don't know — or care — what a vault is. Users speak plain words in any of 6 languages, describe a financial goal, and Lingo handles the rest: vault discovery across 672+ options on 21 chains, risk scoring, portfolio optimization, and one-tap deposit execution. All powered by LI.FI's Earn API and Composer under the hood.

Built for the **DeFi Mullet Hackathon #1** by LI.FI — AI × Earn track.

**Live:** [lingo-two-omega.vercel.app](https://lingo-two-omega.vercel.app)

---

## The "Mullet"

**Front:** A simple chat. "Save my 500 dollars safely." One confirm button.

**Back:** 7-signal risk scoring across 672+ vaults, Sharpe-ratio portfolio optimization, gas-aware allocation, cross-chain Composer execution across 21 chains and 20+ protocols.

---

## Features

**Multi-language AI chat** — Speak English, Hindi, Spanish, Portuguese, Indonesian, or Chinese. Lingo responds in your language and never uses crypto jargon. "Vaults" become "savings accounts." "APY" becomes "yearly rate."

**3 risk-tiered strategies** — Every deposit amount is scored against live vault data and presented as three options: Savings Account (safe, stablecoin-only, top TVL protocols), Growth Fund (balanced risk/reward), and High-Yield Fund (aggressive, reward-heavy). Each strategy is a diversified portfolio of 2-4 vaults selected by Sharpe-ratio optimization.

**7-signal risk scoring engine** — Each vault is evaluated on protocol trust (25%), TVL depth (25%), yield source composition (15%), APY volatility (15%), asset complexity (10%), chain security tier (5%), and exit liquidity (5%). The composite score determines tier placement.

**Gas-aware allocation** — Automatically avoids Ethereum mainnet for small deposits where gas would eat yield. Factors in 4 tx/year gas cost as APY drag and adjusts allocation weights accordingly.

**Embedded wallet** — Privy handles authentication (email, Google, Apple) with no seed phrases. Users get an embedded wallet on first login.

**One-tap deposits** — LI.FI Composer builds swap + bridge + deposit into a single signable transaction. Users confirm once; the backend handles cross-chain routing.

**Live portfolio tracking** — Real-time positions and earnings pulled from LI.FI's portfolio endpoint. No mock data.

---

## Architecture

```
User (6 languages)
  │
  ▼
Chat UI ──────────► OpenAI GPT-4o-mini (function calling)
                         │
                         ├─► get_strategies(amount) ──► Server Scoring Engine
                         │                                  │
                         │                                  ├─ normalizeVault()
                         │                                  ├─ scoreVault() (7 signals)
                         │                                  ├─ bucketVaults() (safe/mix/bold)
                         │                                  └─ optimizePortfolio() (Sharpe-ratio)
                         │                                          │
                         │                                          ▼
                         │                              LI.FI Earn Data API
                         │                              (vault discovery, pagination)
                         │
                         └─► get_portfolio(wallet) ──► LI.FI Portfolio API
                                                            │
                                                            ▼
                                                    LI.FI Composer API
                                                    (tx building, cross-chain)
                                                            │
                                                            ▼
                                                    Privy Embedded Wallet
                                                    (sign & broadcast)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Auth & Wallet | Privy (`@privy-io/react-auth`, `@privy-io/wagmi`) |
| Chain Interaction | wagmi + viem |
| AI Agent | OpenAI GPT-4o-mini with function calling |
| Vault Discovery | LI.FI Earn Data API (`earn.li.fi`) |
| Tx Execution | LI.FI Composer API (`li.quest`) |
| State | Zustand |
| Icons | Lucide React |
| Deploy | Vercel |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Splash screen (animated loader)
│   ├── auth/page.tsx               # Privy login (email/Google/Apple)
│   ├── onboarding/page.tsx         # 3-step intro ("Talk, Don't Tap")
│   ├── providers.tsx               # Privy + wagmi + QueryClient
│   ├── (main)/
│   │   ├── layout.tsx              # Tab layout + BottomNav
│   │   ├── home/page.tsx           # Dashboard: balances, positions, sparklines
│   │   ├── chat/page.tsx           # AI chat interface
│   │   ├── earn/page.tsx           # Strategy cards (Safe / Mix / Bold)
│   │   └── portfolio/page.tsx      # Live positions with P&L
│   └── api/
│       ├── chat/route.ts           # OpenAI agent with function calling
│       ├── vaults/route.ts         # LI.FI vault discovery + scoring
│       ├── quote/route.ts          # LI.FI Composer quote building
│       ├── balances/route.ts       # Multi-chain balance fetching
│       └── portfolio/route.ts      # LI.FI portfolio positions
├── components/
│   ├── BottomNav.tsx               # Tab navigation
│   ├── Toast.tsx                   # Notification toasts
│   ├── ui/index.tsx                # Design system (Card, Button, Sparkline, ProgressRing, etc.)
│   └── sheets/
│       ├── BottomSheet.tsx         # Reusable bottom sheet
│       ├── DepositSheet.tsx        # Deposit confirmation flow
│       ├── WithdrawSheet.tsx       # Withdrawal flow
│       ├── FundWalletSheet.tsx     # Wallet funding guide
│       └── AccountSheet.tsx        # Account settings
├── lib/
│   ├── lifi/
│   │   ├── earn-api.ts             # LI.FI API client (paginated fetching, caching)
│   │   ├── engine.ts               # Scoring engine (299 lines of pure math)
│   │   └── types.ts                # TypeScript types for vault/portfolio data
│   ├── store.ts                    # Zustand global state
│   └── wallet/
│       └── transaction.ts          # Transaction signing helpers
├── hooks/
│   └── index.ts                    # useStrategies, useBalances, useDeposit, useChat
└── constants/
    └── theme.ts                    # Design system, risk tiers, protocol names, chain config
```

---

## Risk Scoring Detail

Each vault passes through 7 weighted signals:

| Signal | Weight | Safe (3) | Mix (2) | Bold (1) |
|---|---|---|---|---|
| Protocol trust | 25% | Aave, Morpho, Spark | Euler, Pendle, Ethena | Newer protocols |
| TVL depth | 25% | > $50M | $5M–$50M | < $5M |
| Yield source | 15% | 100% organic (base only) | Incentives < 50% | Incentive-heavy |
| APY volatility | 15% | < 10% deviation (1d vs 30d) | 10–40% | > 40% |
| Asset complexity | 10% | Stablecoin, single asset | Single non-stable | Multi-asset / IL risk |
| Chain security | 5% | Ethereum | Major L2s (Base, Arb, OP) | Newer chains |
| Exit liquidity | 5% | Instant redeem | Delayed | Locked |

Composite score normalized to 0–1. Tiers: ≥ 0.75 = Savings Account, 0.45–0.74 = Growth Fund, < 0.45 = High-Yield Fund.

Portfolio construction uses **inverse-volatility weighting** with diversification constraints: max 1 vault per protocol, max 2 per chain.

---

## LI.FI API Integration

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET earn.li.fi/v1/earn/vaults` | None | Vault discovery (paginated, 672+ vaults) |
| `GET earn.li.fi/v1/earn/vaults/:network/:address` | None | Individual vault detail |
| `GET earn.li.fi/v1/earn/portfolio/:addr/positions` | None | User's live DeFi positions |
| `GET li.quest/v1/quote` | API key | Build deposit/withdraw transaction |

---

## Setup

```bash
git clone https://github.com/penguinpecker/lingo.git
cd lingo
npm install
cp .env.example .env.local
```

Fill in your keys in `.env.local`:

```
NEXT_PUBLIC_PRIVY_APP_ID=       # https://dashboard.privy.io
LIFI_COMPOSER_API_KEY=          # https://portal.li.fi
OPENAI_API_KEY=                 # https://platform.openai.com
GOOGLE_TRANSLATE_API_KEY=       # optional, for multi-language
```

Run locally:

```bash
npm run dev
```

Open in Chrome DevTools mobile view (iPhone 14 / 390px) — the app is designed mobile-first.

---

## Deploy

```bash
npx vercel --prod
```

Add environment variables in the Vercel dashboard or via CLI:

```bash
vercel env add NEXT_PUBLIC_PRIVY_APP_ID production
vercel env add LIFI_COMPOSER_API_KEY production
vercel env add OPENAI_API_KEY production
```

---

## Design System

The UI follows a brutalist-meets-warm design language: orange primary (`#F26F21`), lavender AI accent (`#938EF2`), hard drop shadows, 900-weight uppercase headers, and a dark background (`#080808`). All measurements target a 390px mobile viewport. Protocol names are mapped to normie-friendly labels — "morpho-v1" becomes "Secured Lending", "aave-v3" becomes "Bank-Grade Lending."

---

## Supported Chains

Ethereum, Base, Arbitrum, Optimism, Polygon, Gnosis, Linea, Scroll, Avalanche, BNB Chain — with gas cost estimates baked into the scoring engine for each.

---

## License

MIT
