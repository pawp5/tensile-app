/* Tokenize (mint drafts and requests) and inspections: queries and mutations against /chains/{id}/mint and
 * /chains/{id}/inspections. On-chain steps (requestMint, attest, finalizeMint, ...) are signed in the screens via lib/tx. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, API_URL, ApiError, apiBlob, apiForm } from '../lib/api';
import type {
  EvidenceFile, InspectionHistoryOut, InspectionQueueOut, InspectionReport, InspectionReportIn, InspectionSealOut,
  InspectorProfile, InspectorProfileIn, MintConfigOut, MintDraft, MintDraftIn, MintDraftsOut, MintPrepareOut,
  MintRequestDetail, MintRequestsOut, ReinspectionOrder, ReinspectionOrderIn,
} from '../lib/types';
import { useSession } from './session';

const notFound = (e: unknown) => e instanceof ApiError && e.status === 404;

/** Public record behind an attestation (tensile://reports/<id>): its body hashes to the on-chain dataHash. */
export const reportUrl = (reportId: string) => `${API_URL}/reports/${reportId}`;

/** tensile://reports/<id> or tensile://evidence/<id> -> the public API URL that resolves it. */
export function resolveUri(uri: string | null | undefined): string | undefined {
  const m = /^tensile:\/\/(reports|evidence)\/([0-9a-f]{24})$/i.exec(uri ?? '');
  return m ? `${API_URL}/${m[1]}/${m[2]}` : undefined;
}

/** Opens an evidence file (mint evidence or inspection attachment) in a new tab. Needs sign-in. */
export async function openEvidenceFile(chainId: number, fileId: string): Promise<void> {
  const blob = await apiBlob(`/chains/${chainId}/evidence/files/${fileId}`);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ------------------------------------------------------------------ tokenize: configuration, drafts, requests

export function useMintConfig() {
  const { chain } = useSession();
  return useQuery({
    queryKey: ['mint-config', chain.chainId],
    queryFn: ({ signal }) => api<MintConfigOut>(`/chains/${chain.chainId}/mint/config`, { signal }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMintDrafts(status: 'open' | 'all' = 'open') {
  const { chain, address, signedIn } = useSession();
  return useQuery({
    queryKey: ['mint-drafts', chain.chainId, address, status],
    queryFn: () => api<MintDraftsOut>(`/chains/${chain.chainId}/mint/drafts?status=${status}`),
    enabled: signedIn,
  });
}

export function useMintDraft(id: string | undefined) {
  const { chain, address, signedIn } = useSession();
  return useQuery({
    queryKey: ['mint-draft', chain.chainId, address, id],
    queryFn: () => api<MintDraft>(`/chains/${chain.chainId}/mint/drafts/${id}`),
    enabled: signedIn && !!id,
    retry: false,
    // submitted: the requestMint transaction is out; the API links the draft once the request is indexed
    refetchInterval: (q) => (q.state.data?.status === 'submitted' ? 4000 : false),
  });
}

export function useMintRequests(scope: 'mine' | 'all' = 'mine', state: 'open' | 'closed' | 'all' = 'all') {
  const { chain, address, signedIn } = useSession();
  return useQuery({
    queryKey: ['mint-requests', chain.chainId, address, scope, state],
    queryFn: () => api<MintRequestsOut>(`/chains/${chain.chainId}/mint/requests?scope=${scope}&state=${state}`),
    enabled: signedIn,
    refetchInterval: 30_000,
  });
}

export function useMintRequest(requestId: number | undefined) {
  const { chain, address, signedIn } = useSession();
  return useQuery({
    queryKey: ['mint-request', chain.chainId, address, requestId],
    queryFn: () => api<MintRequestDetail>(`/chains/${chain.chainId}/mint/requests/${requestId}`),
    enabled: signedIn && !!requestId,
    retry: false,
    placeholderData: keepPreviousData,
    // 404 right after requestMint: the indexer has not seen it yet. Open requests move as the worker and inspectors act.
    refetchInterval: (q) => (notFound(q.state.error) ? 3000 : q.state.data?.request.status === 'REQUESTED' ? 5000 : false),
  });
}

export function useDraftActions() {
  const qc = useQueryClient();
  const { chain, address } = useSession();
  const cid = chain.chainId;
  const base = `/chains/${cid}/mint/drafts`;
  const put = (d: MintDraft) => {
    qc.setQueryData(['mint-draft', cid, address, d.id], d);
    qc.invalidateQueries({ queryKey: ['mint-drafts', cid] });
  };
  return {
    create: useMutation({ mutationFn: (body: MintDraftIn) => api<MintDraft>(base, { method: 'POST', body }), onSuccess: put }),
    update: useMutation({ mutationFn: ({ id, body }: { id: string; body: MintDraftIn }) => api<MintDraft>(`${base}/${id}`, { method: 'PUT', body }), onSuccess: put }),
    discard: useMutation({
      mutationFn: (id: string) => api<null>(`${base}/${id}`, { method: 'DELETE' }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['mint-drafts', cid] }),
    }),
    upload: useMutation({
      mutationFn: ({ id, kind, file }: { id: string; kind: string; file: File }) => {
        const form = new FormData();
        form.append('kind', kind);
        form.append('file', file);
        return apiForm<MintDraft>(`${base}/${id}/documents`, form);
      },
      onSuccess: put,
    }),
    removeDocument: useMutation({
      mutationFn: ({ id, fileId }: { id: string; fileId: string }) => api<MintDraft>(`${base}/${id}/documents/${fileId}`, { method: 'DELETE' }),
      onSuccess: put,
    }),
    /** Freezes the evidence and returns requestMint's arguments. */
    prepare: useMutation({
      mutationFn: (id: string) => api<MintPrepareOut>(`${base}/${id}/prepare`, { method: 'POST' }),
      onSuccess: (p) => put(p.draft),
    }),
    /** Back to editing after the wallet refused or the transaction failed. */
    reopen: useMutation({ mutationFn: (id: string) => api<MintDraft>(`${base}/${id}/reopen`, { method: 'POST' }), onSuccess: put }),
  };
}

/** Refresh everything a mint request screen shows after a transaction. */
export function useRefreshMint() {
  const qc = useQueryClient();
  const { chain } = useSession();
  return () => {
    for (const key of ['mint-request', 'mint-requests', 'mint-drafts', 'mint-draft', 'inspection-queue', 'inspection-history', 'notifications', 'portfolio', 'lots']) {
      qc.invalidateQueries({ queryKey: [key, chain.chainId] });
    }
  };
}

// ------------------------------------------------------------------ inspections

export function useInspectionQueue() {
  const { chain, address, signedIn } = useSession();
  return useQuery({
    queryKey: ['inspection-queue', chain.chainId, address],
    queryFn: () => api<InspectionQueueOut>(`/chains/${chain.chainId}/inspections/queue`),
    enabled: signedIn,
    retry: false,
    refetchInterval: 15_000,
  });
}

export function useInspectionHistory(scope: 'mine' | 'all') {
  const { chain, address, signedIn } = useSession();
  return useQuery({
    queryKey: ['inspection-history', chain.chainId, address, scope],
    queryFn: () => api<InspectionHistoryOut>(`/chains/${chain.chainId}/inspections/history?scope=${scope}&limit=50`),
    enabled: signedIn,
    retry: false,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useInspectionReport(reportId: string | null | undefined) {
  const { chain, address, signedIn } = useSession();
  return useQuery({
    queryKey: ['inspection-report', chain.chainId, address, reportId],
    queryFn: () => api<InspectionReport>(`/chains/${chain.chainId}/inspections/reports/${reportId}`),
    enabled: signedIn && !!reportId,
    retry: false,
  });
}

export function useInspectorProfileActions() {
  const qc = useQueryClient();
  const { chain, address } = useSession();
  return useMutation({
    mutationFn: (body: InspectorProfileIn) => api<InspectorProfile>(`/chains/${chain.chainId}/inspectors/me`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspection-queue', chain.chainId, address] }),
  });
}

export function useInspectionActions() {
  const { chain } = useSession();
  const cid = chain.chainId;
  return {
    /** kind: weigh | photos | assay | report. Upload before sealing; pass the ids as fileIds. */
    uploadFile: useMutation({
      mutationFn: ({ kind, file }: { kind: string; file: File }) => {
        const form = new FormData();
        form.append('kind', kind);
        form.append('file', file);
        return apiForm<EvidenceFile>(`/chains/${cid}/inspections/files`, form);
      },
    }),
    /** Stores the report and returns its dataHash / uri, which the inspector then signs on-chain. */
    seal: useMutation({ mutationFn: (body: InspectionReportIn) => api<InspectionSealOut>(`/chains/${cid}/inspections/reports`, { method: 'POST', body }) }),
  };
}

export function useReinspectionOrders(enabled: boolean) {
  const { chain, address, signedIn } = useSession();
  return useQuery({
    queryKey: ['inspection-orders', chain.chainId, address],
    queryFn: () => api<ReinspectionOrder[]>(`/chains/${chain.chainId}/inspections/orders?status=open`),
    enabled: signedIn && enabled,
    retry: false,
  });
}

export function useOrderActions() {
  const qc = useQueryClient();
  const { chain } = useSession();
  const cid = chain.chainId;
  const done = () => {
    qc.invalidateQueries({ queryKey: ['inspection-orders', cid] });
    qc.invalidateQueries({ queryKey: ['inspection-queue', cid] });
  };
  return {
    create: useMutation({ mutationFn: (body: ReinspectionOrderIn) => api<ReinspectionOrder>(`/chains/${cid}/inspections/orders`, { method: 'POST', body }), onSuccess: done }),
    cancel: useMutation({ mutationFn: (id: string) => api<ReinspectionOrder>(`/chains/${cid}/inspections/orders/${id}`, { method: 'DELETE' }), onSuccess: done }),
  };
}
