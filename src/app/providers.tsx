'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'viem';
import { base, arbitrum, mainnet, optimism, polygon, bsc, avalanche, gnosis, linea, scroll } from 'viem/chains';
import { ReactNode, useState, useEffect } from 'react';
import { ToastProvider } from '@/components/Toast';

const ALL_CHAINS = [base, arbitrum, mainnet, optimism, polygon, bsc, avalanche, gnosis, linea, scroll] as const;

const wagmiConfig = createConfig({
  chains: ALL_CHAINS,
  transports: Object.fromEntries(ALL_CHAINS.map(c => [c.id, http()])),
});

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } },
  }));
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return <div style={{ minHeight: '100dvh', background: '#080808' }} />;
  }

  if (!PRIVY_APP_ID) {
    return (
      <div style={{
        minHeight: '100dvh', background: '#080808', color: '#F26F21',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24, textAlign: 'center', fontFamily: 'system-ui',
      }}>
        <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 12 }}>L</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>NEXT_PUBLIC_PRIVY_APP_ID not set</div>
        <div style={{ fontSize: 12, color: '#888' }}>Add it to .env.local or Vercel env vars and redeploy.</div>
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: { theme: 'light', accentColor: '#F26F21', logo: undefined },
        loginMethods: ['email', 'google', 'apple'],
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        defaultChain: base,
        supportedChains: [...ALL_CHAINS],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <ToastProvider>{children}</ToastProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
