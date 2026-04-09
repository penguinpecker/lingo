import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { fetchAllVaults } from '@/lib/lifi/earn-api';
import { computeStrategies } from '@/lib/lifi/engine';
import { PROTOCOL_NAMES } from '@/constants/theme';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_strategies',
      description: 'Compute the 3 risk-tiered yield strategies (Savings Account, Growth Fund, High-Yield Fund) for a given deposit amount. Returns composed vault portfolios with APY, gas costs, and allocation weights.',
      parameters: {
        type: 'object',
        properties: {
          deposit_amount: { type: 'number', description: 'Amount in USD to deposit' },
        },
        required: ['deposit_amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_portfolio',
      description: 'Get the user\'s current DeFi positions and earnings across all vaults.',
      parameters: {
        type: 'object',
        properties: {
          wallet_address: { type: 'string', description: 'User wallet address' },
        },
        required: ['wallet_address'],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are Lingo, an AI financial assistant inside a mobile wallet app called Lingo. You help users save and earn yield on their stablecoins (USDC, USDT, DAI) across DeFi protocols.

IMPORTANT RULES:
- Respond in the user's language. If they write in Hindi, respond in Hindi. If English, respond in English.
- NEVER use crypto jargon with the user. No "vaults", "protocols", "TVL", "APY". Instead say "savings accounts", "earning rates", "amount locked", "yearly rate".
- When showing strategies, use the normie-friendly protocol names from the data (e.g. "Secured Lending" not "morpho-v1").
- Keep responses short and conversational. Max 2-3 sentences before showing cards.
- When the user wants to save/deposit/earn, call get_strategies with their amount.
- When the user asks about their earnings/positions, call get_portfolio.
- Always present 3 options: Savings Account (safe), Growth Fund (balanced), High-Yield Fund (aggressive).
- Explain risk in simple terms: "Your money is very safe" vs "Higher returns but more risk".
- Include monthly earning estimates to make it tangible.

You are friendly, confident, and helpful. You speak like a knowledgeable friend, not a financial advisor.`;

export async function POST(request: NextRequest) {
  try {
    const { messages, language, walletAddress } = await request.json();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + `\n\nUser's language: ${language}\nUser's wallet: ${walletAddress || 'not connected'}` },
        ...messages,
      ],
      tools: TOOLS,
      tool_choice: 'auto',
      max_tokens: 500,
    });

    const assistantMessage = response.choices[0].message;

    // Handle function calls
    if (assistantMessage.tool_calls) {
      const toolResults = [];

      for (const tc of assistantMessage.tool_calls as any[]) {
        const args = JSON.parse(tc.function.arguments);

        if (tc.function.name === 'get_strategies') {
          try {
            const vaults = await fetchAllVaults();
            const strategies = computeStrategies(vaults, args.deposit_amount);

            // Convert to normie-friendly format
            const friendly = Object.entries(strategies).map(([key, strat]) => {
              if (!strat) return null;
              return {
                name: strat.name,
                netApy: strat.netApy,
                monthlyEarn: strat.monthlyEarn,
                yearlyEarn: strat.yearlyEarn,
                gasEntry: strat.gasEntry,
                vaults: strat.allocations.map(a => ({
                  name: PROTOCOL_NAMES[a.vault.protocol] || a.vault.protocol,
                  token: a.vault.token,
                  chain: a.vault.network,
                  weight: Math.round(a.weight * 100),
                  apy: a.vault.netApy,
                })),
                protocolCount: strat.protocolCount,
                chainCount: strat.chainCount,
              };
            }).filter(Boolean);

            toolResults.push({
              tool_call_id: tc.id,
              role: 'tool' as const,
              content: JSON.stringify(friendly),
            });
          } catch {
            toolResults.push({
              tool_call_id: tc.id,
              role: 'tool' as const,
              content: JSON.stringify({ error: 'Could not fetch strategies right now' }),
            });
          }
        }

        if (tc.function.name === 'get_portfolio') {
          // Will integrate with real portfolio API
          toolResults.push({
            tool_call_id: tc.id,
            role: 'tool' as const,
            content: JSON.stringify({ positions: [], totalEarned: 0 }),
          });
        }
      }

      // Get final response with tool results
      const finalResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
          assistantMessage,
          ...toolResults,
        ],
        max_tokens: 500,
      });

      return NextResponse.json({
        message: finalResponse.choices[0].message.content,
        strategies: toolResults[0] ? JSON.parse(toolResults[0].content) : null,
      });
    }

    return NextResponse.json({
      message: assistantMessage.content,
      strategies: null,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Chat failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}
