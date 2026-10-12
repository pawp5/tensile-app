import { defineChain, type Chain } from 'viem';
import { createConfig, http, type Config } from 'wagmi';
import { injected } from 'wagmi/connectors';

import type { ChainInfo } from './types';

/** Chains come from the backend (/v1/chains), so adding a chain never needs a frontend change. */
export function toViemChain(c: ChainInfo): Chain {
  return defineChain({
    id: c.chainId,
    name: c.name,
    nativeCurrency: c.nativeCurrency,
    rpcUrls: { default: { http: [c.rpcUrl] } },
    blockExplorers: c.explorerUrl ? { default: { name: 'Explorer', url: c.explorerUrl } } : undefined,
    testnet: c.testnet,
  });
}

export function makeWagmiConfig(chains: ChainInfo[]): Config {
  const viemChains = chains.map(toViemChain) as [Chain, ...Chain[]];
  return createConfig({
    chains: viemChains,
    // Browser wallets (MetaMask, Rabby, OKX, Coinbase extension...) announce themselves via EIP-6963.
    connectors: [injected({ shimDisconnect: true })],
    transports: Object.fromEntries(viemChains.map((c) => [c.id, http()])),
    multiInjectedProviderDiscovery: true,
  });
}

export const shortAddress = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');