/* Wallet transactions from the browser: switch the wallet to the selected chain, simulate first (so a revert shows
 * the contract's reason before the wallet opens), send, then wait for the receipt. Errors become readable sentences.
 *
 *   const tx = useTx();
 *   const receipt = await tx.run('Cancel request', (c) =>
 *     simulateContract(c.config, { address, abi: MintingControllerAbi, functionName: 'cancelRequest', args: [id], account: c.account, chainId: c.chainId }));
 */
import { useCallback, useState } from 'react';
import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError, type TransactionReceipt } from 'viem';
import { useConfig, type Config } from 'wagmi';
import { getConnection, switchChain, waitForTransactionReceipt, writeContract } from 'wagmi/actions';

import { errorMessage, useSession } from '../state/session';
import type { Address } from './types';

export type TxPhase = 'idle' | 'switching' | 'checking' | 'wallet' | 'confirming';

export interface TxContext {
  config: Config;
  account: Address;
  chainId: number;
}

/** Thrown by useTx().run with a sentence fit for the screen. `hash` is set once the transaction was sent; `reverted`
 * when it was mined and failed. A hash without `reverted` means the outcome is unknown (still pending). */
export class TxError extends Error {
  constructor(message: string, public hash?: `0x${string}`, public rejected = false, public reverted = false) {
    super(message);
  }
}

// Custom errors of MintingController, AttestationRegistry, the access manager and OpenZeppelin's ERC20.
const REVERTS: Record<string, string> = {
  AiReviewInsufficient: 'The automated review is below the threshold; a risk admin must override or reject it.',
  AlreadyConfirmed: 'Custody is already confirmed.',
  BadStatus: 'This mint request is no longer open.',
  CertificateUnavailable: 'This certificate has already been tokenized or is on another open request.',
  InvalidParams: 'The parameters are invalid.',
  InvalidRequest: 'The request is missing its material, quantity or certificate.',
  MissingCustody: 'Waiting for the warehouse to confirm custody.',
  MissingInspection: 'Waiting for the inspection attestation.',
  NotOperator: 'Only the warehouse operator can do this.',
  NotOwner: 'Only the owner of the request can do this.',
  NotVerified: 'The wallet is not verified on this network.',
  NotYetExpired: 'The request has not expired yet.',
  RequestExpired: 'The request has expired.',
  ReserveInsufficient: "The warehouse's attested reserve does not cover this lot.",
  Unauthorized: 'Your wallet does not hold the role this needs on this network.',
  WarehouseUnavailable: 'The warehouse is frozen or inactive.',
  ZeroAddress: 'An address is missing.',
  EmptyDataHash: 'The report hash is empty.',
  InvalidKind: 'That attestation kind is not allowed here.',
  InvalidScore: 'The score is out of range.',
  UnknownLot: 'No such lot on this network.',
  PassportNotSet: 'The attestation registry is not linked to the passport yet.',
  ERC20InsufficientAllowance: 'Approve the fee token first.',
  ERC20InsufficientBalance: 'Your wallet does not hold enough of the fee token.',
  SafeERC20FailedOperation: 'The fee token transfer failed.',
};

export function txErrorMessage(e: unknown): string {
  if (e instanceof TxError) return e.message;
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError || (x as { code?: number }).code === 4001)) {
      return 'You rejected the request in your wallet.';
    }
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      if (name) return REVERTS[name] ?? `The contract refused: ${name}.`;
      if (revert.reason) return `The contract refused: ${revert.reason}.`;
    }
    return e.shortMessage || e.message;
  }
  return errorMessage(e);
}

const isRejection = (e: unknown) =>
  e instanceof BaseError && !!e.walk((x) => x instanceof UserRejectedRequestError || (x as { code?: number }).code === 4001);

export const PHASE_LABEL: Record<TxPhase, string> = {
  idle: '',
  switching: 'Switch network in your wallet…',
  checking: 'Checking…',
  wallet: 'Confirm in wallet…',
  confirming: 'Waiting for confirmation…',
};

export function useTx() {
  const config = useConfig();
  const { chain } = useSession();
  const [phase, setPhase] = useState<TxPhase>('idle');
  const [label, setLabel] = useState<string | null>(null);

  const run = useCallback(
    async (what: string, simulate: (c: TxContext) => Promise<{ request: unknown }>): Promise<TransactionReceipt> => {
      const conn = getConnection(config);
      if (!conn.address) throw new TxError('Connect your wallet first.');
      let hash: `0x${string}` | undefined;
      setLabel(what);
      try {
        if (conn.chainId !== chain.chainId) {
          setPhase('switching');
          await switchChain(config, { chainId: chain.chainId });
        }
        setPhase('checking');
        const { request } = await simulate({ config, account: conn.address as Address, chainId: chain.chainId });
        setPhase('wallet');
        hash = await writeContract(config, request as Parameters<typeof writeContract>[1]);
        setPhase('confirming');
        const receipt = await waitForTransactionReceipt(config, { hash, chainId: chain.chainId });
        if (receipt.status !== 'success') throw new TxError('The transaction reverted on-chain.', hash, false, true);
        return receipt;
      } catch (e) {
        throw e instanceof TxError ? e : new TxError(txErrorMessage(e), hash, isRejection(e));
      } finally {
        setPhase('idle');
        setLabel(null);
      }
    },
    [config, chain.chainId],
  );

  return { run, phase, label, busy: phase !== 'idle', status: PHASE_LABEL[phase] };
}

/** "0x91c4…7ae0" */
export const shortHash = (h?: string | null) => (h ? `${h.slice(0, 6)}…${h.slice(-4)}` : '—');

/** Explorer link for a transaction, when the chain has an explorer. */
export const txUrl = (explorerUrl: string | null | undefined, hash?: string | null) =>
  explorerUrl && hash ? `${explorerUrl.replace(/\/$/, '')}/tx/${hash}` : undefined;
