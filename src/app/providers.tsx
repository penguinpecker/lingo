'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'viem';
import { base, arbitrum, mainnet, optimism, polygon } from 'viem/chains';
import { ReactNode, useState, useEffect } from 'react';
import { ToastProvider } from '@/components/Toast';

const wagmiConfig = createConfig({
  chains: [base, arbitrum, mainnet, optimism, polygon],
  transports: {
    [base.id]: http(),
    [arbitrum.id]: http(),
    [mainnet.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
  },
});

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } },
  }));
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // Don't render Privy during SSR or without a valid app ID
  if (!mounted || !appId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#F26F21',
          logo: undefined,
        },
        loginMethods: ['email', 'google', 'apple'],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        defaultChain: base,
        supportedChains: [base, arbitrum, mainnet, optimism, polygon],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
