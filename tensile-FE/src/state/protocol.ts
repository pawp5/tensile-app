/* Live protocol data for the selected chain (served from Mongo by the API, kept fresh by the indexer). */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '../lib/api';
import type { PricesOut, ProtocolStatsOut, SyncOut, WarehousesOut } from '../lib/types';
import { useSession } from './session';

function useChainId(): number {
  return useSession().chain.chainId;
}

export function useWarehouses() {
  const chainId = useChainId();
  return useQuery({
    queryKey: ['warehouses', chainId],
    queryFn: ({ signal }) => api<WarehousesOut>(`/chains/${chainId}/warehouses`, { signal }),
    refetchInterval: 30_000,
  });
}

export function useProtocolStats() {
  const chainId = useChainId();
  return useQuery({
    queryKey: ['protocol-stats', chainId],
    queryFn: ({ signal }) => api<ProtocolStatsOut>(`/chains/${chainId}/protocol/stats`, { signal }),
    refetchInterval: 30_000,
  });
}

export function usePrices() {
  const chainId = useChainId();
  return useQuery({
    queryKey: ['prices', chainId],
    queryFn: ({ signal }) => api<PricesOut>(`/chains/${chainId}/prices`, { signal }),
    refetchInterval: 60_000,
  });
}

export function useSync() {
  const chainId = useChainId();
  return useQuery({
    queryKey: ['sync', chainId],
    queryFn: ({ signal }) => api<SyncOut>(`/chains/${chainId}/sync`, { signal }),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

/** Re-renders every `ms` so "x s ago" labels keep counting. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
