/* Signed-in data: KYC, portfolio, activity, notifications, staff queues. Plus public lot and search lookups. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api, apiBlob, apiForm } from '../lib/api';
import type {
  ActivityOut, DocKind, KycApplication, KycApplicationIn, KycMeOut, LotDetailOut, LotsOut, NotificationsOut, OpsQueueOut,
  PortfolioOut, SearchOut,
} from '../lib/types';
import { useSession } from './session';

// ------------------------------------------------------------------ KYC (applicant)

export function useKycMe() {
  const { address, signedIn } = useSession();
  return useQuery({
    queryKey: ['kyc-me', address],
    queryFn: () => api<KycMeOut>('/kyc/me'),
    enabled: signedIn,
    // while approval is being written on-chain, keep checking
    refetchInterval: (q) => (q.state.data?.application?.attestations.some((a) => a.status === 'queued' || a.status === 'running') ? 4000 : false),
  });
}

export function useKycActions() {
  const qc = useQueryClient();
  const { address } = useSession();
  const done = (app: KycApplication) => {
    qc.setQueryData(['kyc-me', address], { application: app });
    qc.invalidateQueries({ queryKey: ['me'] });
  };
  return {
    save: useMutation({ mutationFn: (body: KycApplicationIn) => api<KycApplication>('/kyc/me', { method: 'PUT', body }), onSuccess: done }),
    upload: useMutation({
      mutationFn: ({ kind, file }: { kind: DocKind; file: File }) => {
        const form = new FormData();
        form.append('kind', kind);
        form.append('file', file);
        return apiForm<KycApplication>('/kyc/me/documents', form);
      },
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: (id: string) => api<KycApplication>(`/kyc/me/documents/${id}`, { method: 'DELETE' }), onSuccess: done }),
    submit: useMutation({ mutationFn: () => api<KycApplication>('/kyc/me/submit', { method: 'POST' }), onSuccess: done }),
  };
}

/** Opens an authenticated document (applicant or KYC staff) in a new tab. */
export async function openKycDocument(id: string): Promise<void> {
  const blob = await apiBlob(`/kyc/documents/${id}`);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ------------------------------------------------------------------ KYC (staff review)

export function useKycApplication(address: string | undefined) {
  const { signedIn } = useSession();
  return useQuery({
    queryKey: ['kyc-application', address],
    queryFn: () => api<KycApplication>(`/kyc/applications/${address}`),
    enabled: signedIn && !!address,
    retry: false,
    refetchInterval: (q) => (q.state.data?.attestations.some((a) => a.status === 'queued' || a.status === 'running') ? 4000 : false),
  });
}

export function useKycReview(address: string | undefined) {
  const qc = useQueryClient();
  const done = (app: KycApplication) => {
    qc.setQueryData(['kyc-application', address], app);
    qc.invalidateQueries({ queryKey: ['ops-queue'] });
  };
  return {
    approve: useMutation({
      mutationFn: (body: { tier?: number; validDays?: number }) => api<KycApplication>(`/kyc/applications/${address}/approve`, { body }),
      onSuccess: done,
    }),
    reject: useMutation({
      mutationFn: (reason: string) => api<KycApplication>(`/kyc/applications/${address}/reject`, { body: { reason } }),
      onSuccess: done,
    }),
  };
}

// ------------------------------------------------------------------ portfolio, activity, notifications

export function usePortfolio(days: number) {
  const { chain, address, signedIn } = useSession();
  return useQuery({
    queryKey: ['portfolio', chain.chainId, address, days],
    queryFn: () => api<PortfolioOut>(`/chains/${chain.chainId}/portfolio?days=${days}`),
    enabled: signedIn,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useActivity(scope: 'mine' | 'all', limit = 20) {
  const { chain, address, signedIn } = useSession();
  return useQuery({
    queryKey: ['activity', chain.chainId, scope, scope === 'mine' ? address : null, limit],
    queryFn: () => api<ActivityOut>(`/chains/${chain.chainId}/activity?scope=${scope}&limit=${limit}`),
    enabled: scope === 'all' || signedIn,
    refetchInterval: 30_000,
  });
}

export function useNotifications() {
  const { chain, address, signedIn } = useSession();
  const qc = useQueryClient();
  const key = ['notifications', chain.chainId, address];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api<NotificationsOut>(`/chains/${chain.chainId}/notifications`),
    enabled: signedIn,
    refetchInterval: 30_000,
  });
  const markSeen = useMutation({
    mutationFn: () => api<NotificationsOut>(`/chains/${chain.chainId}/notifications/seen`, { method: 'POST' }),
    onSuccess: (data) => qc.setQueryData(key, data),
  });
  return { ...query, markSeen };
}

// ------------------------------------------------------------------ lots + search (public)

export function useLot(tokenId: number | undefined) {
  const { chain } = useSession();
  return useQuery({
    queryKey: ['lot', chain.chainId, tokenId],
    queryFn: () => api<LotDetailOut>(`/chains/${chain.chainId}/lots/${tokenId}`),
    enabled: !!tokenId,
    retry: false,
    refetchInterval: 30_000,
  });
}

export function useMyLots() {
  const { chain, address, signedIn } = useSession();
  return useQuery({
    queryKey: ['lots', chain.chainId, 'owner', address],
    queryFn: () => api<LotsOut>(`/chains/${chain.chainId}/lots?owner=${address}&limit=200`),
    enabled: signedIn && !!address,
  });
}

/** Debounced search for the top bar. */
export function useSearch(text: string) {
  const { chain } = useSession();
  const [q, setQ] = useState(text);
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 200);
    return () => clearTimeout(id);
  }, [text]);
  return useQuery({
    queryKey: ['search', chain.chainId, q],
    queryFn: ({ signal }) => api<SearchOut>(`/chains/${chain.chainId}/search?q=${encodeURIComponent(q)}`, { signal }),
    enabled: q.length > 0,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });
}

// ------------------------------------------------------------------ operations console

export function useOpsQueue() {
  const { chain, address, signedIn } = useSession();
  return useQuery({
    queryKey: ['ops-queue', chain.chainId, address],
    queryFn: () => api<OpsQueueOut>(`/chains/${chain.chainId}/ops/queue`),
    enabled: signedIn,
    retry: false,
    refetchInterval: 20_000,
  });
}
