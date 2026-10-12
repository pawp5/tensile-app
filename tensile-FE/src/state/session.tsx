import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { createSiweMessage } from 'viem/siwe';
import { useConnection, useDisconnect, useSignMessage, useSwitchChain } from 'wagmi';

import { api, ApiError, setAuthToken } from '../lib/api';
import type { Address, ChainInfo, ChainsOut, MeOut, NonceOut, Persona, SessionOut } from '../lib/types';

const CHAIN_KEY = 'tensile.chainId';
const SESSION_KEY = 'tensile.session';
const PERSONA_KEY = 'tensile.persona';
const BASE_PERSONAS: Persona[] = ['owner', 'lender', 'buyer'];

interface StoredSession {
  address: Address;
  token: string;
  expiresAt: string;
}

export interface SessionValue {
  chains: ChainInfo[];
  /** The chain the app is showing (follows the wallet when it is on a supported chain). */
  chain: ChainInfo;
  selectChain: (chainId: number) => Promise<void>;
  address?: Address;
  isConnected: boolean;
  /** Wallet is on a chain Tensile is not deployed on. */
  wrongNetwork: boolean;
  signedIn: boolean;
  signingIn: boolean;
  signIn: (account?: Address, walletChainId?: number) => Promise<void>;
  signOut: () => void;
  me?: MeOut;
  persona: Persona;
  personas: Persona[];
  setPersona: (p: Persona) => void;
  error: string | null;
  setError: (message: string | null) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

const read = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: session lasts for this tab only */
  }
};

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  const err = e as { shortMessage?: string; message?: string };
  return err?.shortMessage ?? err?.message ?? 'Something went wrong';
}

export function SessionProvider({ config, children }: { config: ChainsOut; children: ReactNode }) {
  const { chains, defaultChainId } = config;
  const queryClient = useQueryClient();
  const { address, chainId: walletChainId, isConnected } = useConnection();
  const { mutateAsync: switchChainAsync } = useSwitchChain();
  const { mutateAsync: signMessageAsync } = useSignMessage();
  const { mutate: disconnect } = useDisconnect();

  const supported = useCallback((id?: number) => !!id && chains.some((c) => c.chainId === id), [chains]);

  // ---- chain
  const [chainId, setChainId] = useState<number>(() => {
    const saved = read<number>(CHAIN_KEY);
    return saved && chains.some((c) => c.chainId === saved) ? saved : defaultChainId;
  });
  const chain = chains.find((c) => c.chainId === chainId) ?? chains[0];

  useEffect(() => {
    // The wallet switched to another supported chain (in-app or in the wallet itself): follow it.
    if (supported(walletChainId) && walletChainId !== chainId) {
      setChainId(walletChainId!);
      write(CHAIN_KEY, walletChainId);
    }
  }, [walletChainId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectChain = useCallback(
    async (id: number) => {
      if (!supported(id)) return;
      if (isConnected && walletChainId !== id) {
        await switchChainAsync({ chainId: id }); // the effect above updates the app chain on success
        return;
      }
      setChainId(id);
      write(CHAIN_KEY, id);
    },
    [isConnected, walletChainId, switchChainAsync, supported],
  );

  // ---- session (Sign-In with Ethereum)
  const [session, setSession] = useState<StoredSession | null>(() => read<StoredSession>(SESSION_KEY));
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signedIn =
    !!session && !!address && session.address.toLowerCase() === address.toLowerCase() && Date.parse(session.expiresAt) > Date.now();

  // Layout effect: the token is in place before any child query fires.
  useLayoutEffect(() => setAuthToken(signedIn ? session!.token : null), [signedIn, session]);

  const clearSession = useCallback(() => {
    write(SESSION_KEY, null);
    setSession(null);
    setAuthToken(null);
    queryClient.removeQueries({ queryKey: ['me'] });
  }, [queryClient]);

  const signIn = useCallback(
    async (account?: Address, walletChain?: number) => {
      const who = account ?? address;
      if (!who) throw new Error('Connect a wallet first');
      setSigningIn(true);
      setError(null);
      try {
        const { nonce } = await api<NonceOut>('/auth/nonce', { body: { address: who } });
        const message = createSiweMessage({
          domain: window.location.host,
          address: who,
          statement: 'Sign in to Tensile',
          uri: window.location.origin,
          version: '1',
          chainId: walletChain ?? walletChainId ?? chainId,
          nonce,
          issuedAt: new Date(),
        });
        const signature = await signMessageAsync({ account: who, message });
        const s = await api<SessionOut>('/auth/verify', { body: { message, signature } });
        const stored = { address: s.address, token: s.token, expiresAt: s.expiresAt };
        setAuthToken(s.token);
        write(SESSION_KEY, stored);
        setSession(stored);
      } catch (e) {
        setError(errorMessage(e));
        throw e;
      } finally {
        setSigningIn(false);
      }
    },
    [address, walletChainId, chainId, signMessageAsync],
  );

  const signOut = useCallback(() => {
    clearSession();
    disconnect({});
  }, [clearSession, disconnect]);

  // ---- me: roles + identity on the current chain
  const meQuery = useQuery({
    queryKey: ['me', chain.chainId, address],
    queryFn: () => api<MeOut>(`/chains/${chain.chainId}/me`),
    enabled: signedIn,
    staleTime: 30_000,
    retry: (count, e) => !(e instanceof ApiError && e.status < 500) && count < 2,
  });
  useEffect(() => {
    if (meQuery.error instanceof ApiError && meQuery.error.status === 401) clearSession();
  }, [meQuery.error, clearSession]);

  // ---- persona ("Viewing as")
  const personas = meQuery.data?.personas ?? BASE_PERSONAS;
  const [savedPersona, setSavedPersona] = useState<Persona>(() => read<Persona>(PERSONA_KEY) ?? 'owner');
  const persona = personas.includes(savedPersona) ? savedPersona : personas[0];
  const setPersona = useCallback((p: Persona) => {
    setSavedPersona(p);
    write(PERSONA_KEY, p);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      chains,
      chain,
      selectChain,
      address,
      isConnected,
      wrongNetwork: isConnected && !!walletChainId && !supported(walletChainId),
      signedIn,
      signingIn,
      signIn,
      signOut,
      me: signedIn ? meQuery.data : undefined,
      persona,
      personas,
      setPersona,
      error,
      setError,
    }),
    [chains, chain, selectChain, address, isConnected, walletChainId, supported, signedIn, signingIn, signIn, signOut, meQuery.data, persona, personas, setPersona, error],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}