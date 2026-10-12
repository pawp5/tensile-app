/* Tokenize steps 3-7: one mint request, from the automated review to the passport. The owner signs finalizeMint
 * (or cancelRequest); risk staff can override a low review or reject; anyone can close an expired request. */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { stringToHex } from 'viem';
import { simulateContract } from 'wagmi/actions';

import { MintingControllerAbi } from '../../abis/MintingController';
import { ApiError } from '../../lib/api';
import { utc } from '../../lib/format';
import { shortHash, txUrl, useTx } from '../../lib/tx';
import type { Address, MintStepKey } from '../../lib/types';
import { shortAddress } from '../../lib/web3';
import { useMintRequest, useRefreshMint } from '../../state/minting';
import { errorMessage, useSession } from '../../state/session';
import { CustodyPanel, DetailsPanel, EvidencePanel, InspectionPanel, PassportPanel, ReservePanel, ReviewPanel } from './panels';
import {
  Alert, Badge, CardHead, Columns, Head, mrId, Nav, NEXT_LABEL, NextCard, Page, REJECT_REASONS, SignInCard, STEP_LABELS, Stepper,
  Summary, t3, usd, usdc, what, YourRequests, type StepState,
} from './shared';

export default function RequestView({ id }: { id: number }) {
  const location = useLocation();
  const sentTx = (location.state as { tx?: string } | null)?.tx;
  const { chain, signedIn, address, setError } = useSession();
  const q = useMintRequest(id);
  const d = q.data && q.data.request.requestId === id ? q.data : undefined;
  const tx = useTx();
  const refresh = useRefreshMint();
  const [picked, setPicked] = useState<MintStepKey | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0][0]);
  const [sent, setSent] = useState<{ label: string; hash: string; mark: string } | null>(null);
  const mark = d ? `${d.request.status}|${d.steps.map((s) => s.state).join()}` : '';
  useEffect(() => setPicked(null), [d?.currentStep]);
  // the "confirmed" note goes once the indexed data differs from what it was before the transaction
  useEffect(() => { if (sent && sent.mark !== mark) setSent(null); }, [mark, sent]);

  const controller = chain.addresses.MintingController as Address | undefined;
  const act = async (label: string, functionName: 'finalizeMint' | 'cancelRequest' | 'expireRequest' | 'overrideAi' | 'rejectRequest') => {
    if (!controller) return setError('MintingController is not deployed on this network');
    try {
      const receipt = await tx.run(label, (x) =>
        functionName === 'rejectRequest'
          ? simulateContract(x.config, { address: controller, abi: MintingControllerAbi, functionName, args: [BigInt(id), stringToHex(reason, { size: 32 })], account: x.account, chainId: x.chainId })
          : simulateContract(x.config, { address: controller, abi: MintingControllerAbi, functionName, args: [BigInt(id)], account: x.account, chainId: x.chainId }));
      setSent({ label, hash: receipt.transactionHash, mark });
      setConfirmCancel(false);
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (!signedIn) {
    return (
      <Page crumb={`Mint request ${mrId(id)}`}>
        <Head title={`Mint request ${mrId(id)}`} sub="Sign in to follow this request" status="NEW" />
        <SignInCard />
      </Page>
    );
  }

  if (!d) {
    const notYet = q.error instanceof ApiError && q.error.status === 404;
    return (
      <Page crumb={`Mint request ${mrId(id)}`}>
        <Head title={`Mint request ${mrId(id)}`} sub={notYet ? (sentTx ? 'Submitted · waiting for the network' : 'Looking for this request…') : 'Loading…'} status={notYet && sentTx ? 'SUBMITTING' : 'NEW'} />
        <Stepper steps={STEP_LABELS.map(([key, label], i) => ({ key, label, state: (!sentTx ? 'next' : i < 2 ? 'done' : i === 2 ? 'current' : 'next') as StepState, disabled: true }))} sel={sentTx ? 'review' : 'details'} onPick={() => undefined} />
        {q.error && !notYet ? (
          <Alert tone="danger" title="This request is not available" action={<a href="/tokenize" className="t-btn t-btn-sm t-btn-secondary">Back to tokenize</a>}>{errorMessage(q.error)}</Alert>
        ) : notYet && sentTx ? (
          <Alert tone="info" title={`${mrId(id)} is on-chain`}>
            Sent in transaction <a href={txUrl(chain.explorerUrl, sentTx)} target="_blank" rel="noreferrer" className="t-mono">{shortHash(sentTx)}</a>.
            It shows here as soon as the indexer has it, usually within a few seconds.
          </Alert>
        ) : notYet ? (
          <Alert tone="warning" title={`No ${mrId(id)} on ${chain.name} yet`} action={<a href="/tokenize" className="t-btn t-btn-sm t-btn-secondary">Back to tokenize</a>}>
            A request that was just submitted appears within a few seconds. Otherwise check the link, or switch to the network it was made on.
          </Alert>
        ) : (
          <div className="t-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="t-skel" style={{ height: '18px', width: '40%' }} /><div className="t-skel" style={{ height: '14px', width: '70%' }} /><div className="t-skel" style={{ height: '14px', width: '55%' }} />
          </div>
        )}
      </Page>
    );
  }

  const r = d.request;
  const open = r.status === 'REQUESTED';
  const sel = picked ?? d.currentStep;
  const idx = STEP_LABELS.findIndex(([k]) => k === sel);
  const owner = address?.toLowerCase() === r.owner.toLowerCase();
  const steps = d.steps.map((s) => ({ key: s.key, label: s.label, state: s.state as StepState, title: s.detail ?? undefined }));
  const stepBy = (k: MintStepKey) => d.steps.find((s) => s.key === k)!;
  const expires = open && d.expiresAt ? ` · expires ${utc(d.expiresAt)}` : '';
  const go = (k: MintStepKey) => setPicked(k);
  const busy = tx.busy ? tx.status : null;

  const nextCopy: string = !open
    ? r.status === 'FINALIZED'
      ? 'The passport is live. Borrow against it, list it, or hold it.'
      : r.status === 'REJECTED'
        ? 'The request was rejected. The certificate is free again: fix what was wrong and start a new request.'
        : 'The request is closed and the certificate is free again. You can start a new request with it.'
    : ({
      details: '', evidence: '',
      review: 'The automated review checks your evidence for consistency. It usually finishes within a minute.',
      inspection: `An independent inspector will weigh, sample and seal the material at ${d.warehouse?.name ?? 'the warehouse'}, normally within 2 days.`,
      custody: `${d.custody.operatorName ?? 'The warehouse operator'} confirms custody of the sealed bundles.`,
      reserve: 'The reserve check runs against the latest warehouse attestation.',
      mint: d.actions.canFinalize ? `Every check has passed. Minting issues the passport to ${shortAddress(r.owner)}; you pay only the network fee.` : d.actions.finalizeMessage ?? 'If the reserve covers the lot, you can mint the passport.',
    } as Record<MintStepKey, string>)[d.currentStep];

  return (
    <Page crumb={`Mint request ${r.displayId}`}>
      <Head title={d.title} sub={<>Mint request <span className="t-mono">{r.displayId}</span> · opened {utc(r.createdAt)}{expires}</>} status={r.status} />
      <Stepper steps={steps} sel={sel} onPick={go} />
      <Columns
        main={
          <>
            {r.status === 'REJECTED' ? (
              <Alert tone="danger" title="Mint request rejected">
                {d.rejectReason ? <>Reason: <span className="t-mono">{d.rejectReason}</span>. </> : null}The certificate is free again; no passport was issued.
              </Alert>
            ) : r.status === 'CANCELLED' || r.status === 'EXPIRED' ? (
              <Alert tone="warning" title={`Mint request ${r.status.toLowerCase()}`}>The certificate is free again; no passport was issued. The evidence stays on record.</Alert>
            ) : null}
            {sent ? (
              <Alert tone="info" title={`${sent.label} · confirmed`}>
                Transaction <a href={txUrl(chain.explorerUrl, sent.hash)} target="_blank" rel="noreferrer" className="t-mono">{shortHash(sent.hash)}</a> is confirmed. This page updates once the network has indexed it.
              </Alert>
            ) : null}

            {sel === 'details' ? <DetailsPanel d={d} /> : null}
            {sel === 'evidence' ? <EvidencePanel d={d} /> : null}
            {sel === 'review' ? <ReviewPanel d={d} /> : null}
            {sel === 'inspection' ? <InspectionPanel d={d} /> : null}
            {sel === 'custody' ? <CustodyPanel d={d} /> : null}
            {sel === 'reserve' ? <ReservePanel d={d} /> : null}
            {sel === 'mint' ? (
              r.status === 'FINALIZED' ? <PassportPanel d={d} /> : (
                <div className="t-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <CardHead title="Mint the material passport" sub="Every check below is final. Minting issues a passport to the owner's verified address; the lot is FREE and can be borrowed against, sold or redeemed." />
                  <div className="t-kv">
                    {(['evidence', 'review', 'inspection', 'custody', 'reserve'] as MintStepKey[]).map((k) => {
                      const s = stepBy(k);
                      const [word, tone] = s.state === 'done' ? ['Passed', 't-success'] : s.state === 'failed' ? ['Failed', 't-danger'] : s.state === 'blocked' ? ['Blocked', 't-warning'] : ['Waiting', 't-neutral'];
                      return (
                        <div key={k} className="t-kv-row">
                          <span className="t-kv-k">{s.label}</span>
                          <span className="t-kv-v t-row" style={{ gap: '8px', justifyContent: 'flex-end' }}>
                            <span className="t-sm t-sec">{s.detail}</span>
                            <Badge word tone={tone}>{word}</Badge>
                          </span>
                        </div>
                      );
                    })}
                    <div className="t-kv-row">
                      <span className="t-kv-k">Identity</span>
                      <span className="t-kv-v t-row" style={{ gap: '8px', justifyContent: 'flex-end' }}>
                        <span className="t-sm t-sec">{d.actions.finalizeBlocker === 'NotVerified' ? "The owner's verification has lapsed" : 'Checked when minting'}</span>
                        {d.actions.finalizeBlocker === 'NotVerified' ? <Badge word tone="t-danger">Failed</Badge> : <Badge word tone="t-neutral">{open ? 'Live check' : '—'}</Badge>}
                      </span>
                    </div>
                  </div>
                  {open ? (
                    <>
                      {busy && tx.label === 'Mint passport' ? (
                        <button className="t-btn t-btn-primary t-btn-lg t-btn-block" aria-disabled="true" style={{ background: 'var(--primary)', color: 'var(--on-primary)', opacity: '.8' }}><span className="t-spinner" />{busy}</button>
                      ) : (
                        <button className="t-btn t-btn-primary t-btn-lg t-btn-block" disabled={!d.actions.canFinalize || !!busy} onClick={() => act('Mint passport', 'finalizeMint')}>
                          Mint passport for {what(d.title)}
                        </button>
                      )}
                      <span className="t-cap" style={{ textAlign: 'center' }}>
                        {d.actions.canFinalize ? 'Network fee only · no protocol fee to mint' : d.actions.finalizeMessage ?? 'Waiting for the checks above'}
                      </span>
                    </>
                  ) : null}
                </div>
              )
            ) : null}

            {sel !== 'mint' ? (
              <Nav
                back={idx > 0 ? () => go(STEP_LABELS[idx - 1][0]) : undefined}
                hint={stepBy(sel).state === 'blocked' || stepBy(sel).state === 'failed' ? stepBy(sel).detail : `Step ${idx + 1} of 7`}
                next={() => go(STEP_LABELS[idx + 1][0])}
                nextLabel={NEXT_LABEL[sel] ?? 'Continue'}
              />
            ) : null}
          </>
        }
        aside={
          <>
            <Summary
              rows={[
                ['Material', d.materialName ?? '—'],
                ['Code', r.material ?? '—', true],
                ['Quantity', `${t3(r.quantityKg)} t`],
                ['Warehouse', d.warehouse?.code ?? `#${r.warehouseId}`, true],
                ['Owner', d.ownerName ?? shortAddress(r.owner)],
                ['Indicative value', usd(d.indicativeValueUsd)],
                [r.status === 'FINALIZED' ? 'Borrow capacity' : 'Borrow capacity once minted', usdc(d.borrowCapacityUsdc)],
              ]}
            />
            <NextCard copy={nextCopy} />
            {d.actions.canInspect ? (
              <div className="t-card t-card-dense t-stack" style={{ gap: '8px' }}>
                <span className="t-label">Inspection</span>
                <span className="t-cap">You hold the inspector role on {chain.name}. Record the inspection from the inspector workspace.</span>
                <a href={`/inspections?ref=${r.displayId}`} className="t-btn t-btn-sm t-btn-secondary" style={{ alignSelf: 'flex-start' }}>Record inspection</a>
              </div>
            ) : null}
            {d.actions.canOverride || d.actions.canReject ? (
              <div className="t-card t-card-dense t-stack" style={{ gap: '10px' }}>
                <span className="t-label">Risk review</span>
                {d.actions.canOverride ? (
                  <>
                    <span className="t-cap">The automated review scored {d.review?.score ?? '—'} against a threshold of {d.minAiScore}. Overriding lets the mint proceed once inspection and custody are in.</span>
                    <button className="t-btn t-btn-sm t-btn-secondary" style={{ alignSelf: 'flex-start' }} disabled={!!busy} onClick={() => act('Override review', 'overrideAi')}>
                      {busy && tx.label === 'Override review' ? busy : 'Override automated review'}
                    </button>
                  </>
                ) : null}
                {d.actions.canReject ? (
                  <>
                    <span className="t-cap">Rejecting closes the request and frees the certificate. The reason is written on-chain.</span>
                    <select className="t-input t-select" value={reason} onChange={(e) => setReason(e.target.value)} style={{ height: '32px', fontSize: '13px' }}>
                      {REJECT_REASONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                    </select>
                    <button className="t-btn t-btn-sm t-btn-danger-outline" style={{ alignSelf: 'flex-start' }} disabled={!!busy} onClick={() => act('Reject request', 'rejectRequest')}>
                      {busy && tx.label === 'Reject request' ? busy : 'Reject request'}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
            {open && (d.actions.canCancel || d.actions.canExpire) ? (
              <div className="t-card t-card-dense t-stack" style={{ gap: '8px' }}>
                <span className="t-label">{d.actions.canExpire ? 'Request expired' : 'Cancel request'}</span>
                <span className="t-cap">
                  {d.actions.canExpire
                    ? 'This request is past its time limit. Closing it frees the certificate; anyone can do this.'
                    : 'You can cancel until the passport is minted. Uploaded evidence stays on record. The request becomes CANCELLED.'}
                </span>
                {d.actions.canExpire ? (
                  <button className="t-btn t-btn-sm t-btn-secondary" style={{ alignSelf: 'flex-start' }} disabled={!!busy} onClick={() => act('Close expired request', 'expireRequest')}>
                    {busy && tx.label === 'Close expired request' ? busy : 'Close expired request'}
                  </button>
                ) : confirmCancel ? (
                  <span className="t-row" style={{ gap: '8px' }}>
                    <button className="t-btn t-btn-sm t-btn-danger-outline" disabled={!!busy} onClick={() => act('Cancel request', 'cancelRequest')}>
                      {busy && tx.label === 'Cancel request' ? busy : `Cancel ${r.displayId}`}
                    </button>
                    <button className="t-btn t-btn-sm t-btn-ghost" disabled={!!busy} onClick={() => setConfirmCancel(false)}>Keep it</button>
                  </span>
                ) : (
                  <button className="t-btn t-btn-sm t-btn-danger-outline" style={{ alignSelf: 'flex-start' }} disabled={!!busy} onClick={() => setConfirmCancel(true)}>Cancel request</button>
                )}
              </div>
            ) : null}
            {owner ? <YourRequests currentRequest={id} /> : null}
          </>
        }
      />
    </Page>
  );
}
