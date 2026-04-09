# Lingo

**The smartest savings in DeFi.** Chat in your language, we find the best rates.

Built for the **DeFi Mullet Hackathon #1** by LI.FI.

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_PRIVY_APP_ID, LIFI_COMPOSER_API_KEY, OPENAI_API_KEY
npm run dev
```

## Architecture

User (6 languages) → Chat → OpenAI Agent → Server Scoring Engine → LI.FI Earn API + Composer → Privy Wallet

## Risk Scoring: 7 signals, 3 tiers

Protocol trust (25%) + TVL depth (25%) + Yield source (15%) + APY volatility (15%) + Asset complexity (10%) + Chain security (5%) + Exit liquidity (5%)

Score ≥0.75 = Savings Account | 0.45-0.74 = Growth Fund | <0.45 = High-Yield Fund

Sharpe-ratio portfolio optimization picks 2-4 vaults per tier with diversification constraints.
Gas-aware: automatically avoids mainnet for small deposits.
