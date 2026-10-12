/* Tokenize steps 1-2: the off-chain draft (material details, evidence). "Submit for review" freezes the evidence
 * (POST .../prepare) and signs MintingController.requestMint from the owner's wallet. */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { erc20Abi, parseEventLogs } from 'viem';
import { simulateContract } from 'wagmi/actions';

import { MintingControllerAbi } from '../../abis/MintingController';
import { tonnes, utc } from '../../lib/format';
import { TxError, useTx } from '../../lib/tx';
import type { EvidenceFile, MintConfigOut, MintDraft, MintDraftIn, MintPrepareOut, MintStepKey } from '../../lib/types';
import { openEvidenceFile, useDraftActions, useMintConfig, useMintDraft, useRefreshMint } from '../../state/minting';
import { usePrices } from '../../state/protocol';
import { errorMessage, useSession } from '../../state/session';
import {
  Alert, Badge, CERT_RE, Columns, fileSize, Head, Nav, NextCard, Page, parseTonnes, shortSha, SignInCard, STEP_LABELS, Stepper,
  Summary, usd, usdc, YourRequests, type StepState,
} from './shared';

interface Form {
  material: string;
  warehouseId: number;
  qty: string;
  cert: string;
  receipt: string;
}
const EMPTY: Form = { material: '', warehouseId: 0, qty: '', cert: '', receipt: '' };
const stores = (materials: string[], code: string) => !materials.length || materials.includes(code);

export default function DraftView({ draftId }: { draftId?: string }) {
  const navigate = useNavigate();
  const { chain, signedIn, me, setError } = useSession();
  const cfg = useMintConfig();
  const draftQ = useMintDraft(draftId);
  const draft = draftQ.data;
  const actions = useDraftActions();
  const prices = usePrices();
  const tx = useTx();
  const refresh = useRefreshMint();
  const [step, setStep] = useState<0 | 1>(draftId ? 1 : 0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const loaded = useRef<string | null>(null);

  const c = cfg.data;
  const materials = c?.materials ?? [];
  const warehouses = c?.warehouses ?? [];
  const verified = !!me?.identity.verified;

  // fill the form from the saved draft, or pick defaults for a new one
  useEffect(() => {
    if (draft && loaded.current !== draft.id) {
      loaded.current = draft.id;
      setForm({
        material: draft.material ?? '', warehouseId: draft.warehouseId ?? 0, qty: draft.quantityKg ? tonnes(draft.quantityKg).replace(/,/g, '') : '',
        cert: draft.certificateId ?? '', receipt: draft.receiptNo ?? '',
      });
    } else if (!draftId && c && !form.material && materials.length) {
      const m = materials[0].code;
      const w = warehouses.find((x) => x.eligible && stores(x.materials, m));
      setForm((f) => ({ ...f, material: m, warehouseId: w?.warehouseId ?? 0 }));
    }
  }, [draft, c]); // eslint-disable-line react-hooks/exhaustive-deps

  // the request has been indexed: follow it
  useEffect(() => {
    if (draft?.status === 'requested' && draft.requestId) navigate(`/tokenize?request=${draft.requestId}`, { replace: true });
  }, [draft?.status, draft?.requestId, navigate]);

  const mat = materials.find((m) => m.code === form.material);
  const options = warehouses.filter((w) => w.eligible && stores(w.materials, form.material));
  const unavailable = warehouses.filter((w) => !w.eligible && stores(w.materials, form.material));
  const wh = warehouses.find((w) => w.warehouseId === form.warehouseId);
  const qtyKg = parseTonnes(form.qty);
  const minLot = c?.minLotKg ?? 5000;
  const errors = {
    qty: !qtyKg ? 'Enter the net weight in tonnes.' : qtyKg < minLot ? `The minimum lot is ${tonnes(minLot)} t.` : null,
    cert: CERT_RE.test(form.cert.trim()) ? null : 'Letters, digits, spaces and . _ / - (3 to 64 characters).',
    warehouse: wh && wh.eligible && stores(wh.materials, form.material) ? null : 'Choose a warehouse that stores this material.',
  };
  const valid = !errors.qty && !errors.cert && !errors.warehouse && !!mat;
  const body: MintDraftIn = {
    material: form.material, warehouseId: form.warehouseId, quantityKg: qtyKg ?? 0, certificateId: form.cert.trim(),
    receiptNo: form.receipt.trim() || null,
  };
  const dirty = !draft || draft.material !== body.material || draft.warehouseId !== body.warehouseId || draft.quantityKg !== body.quantityKg
    || draft.certificateId !== body.certificateId || (draft.receiptNo ?? null) !== body.receiptNo;
  const editable = !draft || draft.status === 'draft';
  const submitted = draft?.status === 'submitted';

  // indicative value before the draft is saved (the API values the saved draft, with the borrow capacity)
  const price = prices.data?.prices.find((p) => p.material === form.material && p.region === wh?.region)?.priceUsdPerTonne ?? null;
  const value = draft && !dirty ? draft.indicativeValueUsd : qtyKg && price ? (qtyKg / 1000) * price : null;
  const capacity = draft && !dirty ? draft.borrowCapacityUsdc : null;

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const pickMaterial = (code: string) => {
    const keep = wh && wh.eligible && stores(wh.materials, code);
    set({ material: code, warehouseId: keep ? form.warehouseId : warehouses.find((x) => x.eligible && stores(x.materials, code))?.warehouseId ?? 0 });
  };

  const saving = actions.create.isPending || actions.update.isPending;
  const saveDetails = async () => {
    if (draft && (!editable || !dirty)) return setStep(1); // nothing to save (or no longer editable): just move on
    setTouched(true);
    if (!valid) return;
    try {
      if (draft) {
        await actions.update.mutateAsync({ id: draft.id, body });
        setStep(1);
      } else {
        const d = await actions.create.mutateAsync(body);
        navigate(`/tokenize?draft=${d.id}`);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const submit = async () => {
    if (!draft) return;
    setNote(null);
    let p: MintPrepareOut;
    try {
      p = await actions.prepare.mutateAsync(draft.id);
    } catch (e) {
      return setError(errorMessage(e));
    }
    if (p.warnings.length) setNote(p.warnings.join(' '));
    const { controller, feeToken, mintFee } = p;
    try {
      if (p.allowanceNeeded && feeToken) {
        await tx.run('Approve the mint fee', (x) =>
          simulateContract(x.config, { address: feeToken, abi: erc20Abi, functionName: 'approve', args: [controller, BigInt(mintFee)], account: x.account, chainId: x.chainId }));
      }
      const receipt = await tx.run('Submit mint request', (x) =>
        simulateContract(x.config, {
          address: controller, abi: MintingControllerAbi, functionName: 'requestMint',
          args: [p.warehouseId, p.materialCode, BigInt(p.quantityKg), p.certHash, p.evidenceUri], account: x.account, chainId: x.chainId,
        }));
      const [ev] = parseEventLogs({ abi: MintingControllerAbi, logs: receipt.logs, eventName: 'MintRequested' });
      refresh();
      if (ev) navigate(`/tokenize?request=${ev.args.requestId}`, { state: { tx: receipt.transactionHash } });
      else draftQ.refetch();
    } catch (e) {
      const err = e instanceof TxError ? e : null;
      // never sent, or mined and failed: back to editing. Sent but unconfirmed: keep waiting for the indexer.
      if (!err?.hash || err.reverted) actions.reopen.mutate(draft.id);
      setError(err?.rejected ? 'You rejected the request in your wallet. The draft is editable again.' : errorMessage(e));
    }
  };

  const discard = async () => {
    if (!draft || !window.confirm('Discard this draft and its uploaded evidence?')) return;
    try {
      await actions.discard.mutateAsync(draft.id);
      navigate('/tokenize');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const title = mat && qtyKg ? `Tokenize ${tonnes(qtyKg)} t ${mat.family.toLowerCase()}` : 'Tokenize material';
  const sub = draft
    ? <>Draft · saved {utc(draft.updatedAt)}{submitted ? ' · submitted, waiting for the network' : ''}</>
    : 'New request · nothing is written on-chain until you submit';
  const missingTitles = (draft?.missing ?? []).map((k) => c?.docKinds.find((d) => d.kind === k)?.title ?? k);
  const busy = tx.busy ? tx.status : actions.prepare.isPending ? 'Preparing…' : null;
  const sel: MintStepKey = step === 0 ? 'details' : 'evidence';
  const steps = STEP_LABELS.map(([key, label], i) => ({
    key, label,
    state: (i < step ? 'done' : i === step ? 'current' : 'next') as StepState,
    disabled: i > 1 || (i === 1 && !draft),
    title: i > 1 ? 'Starts once the request is submitted' : i === 1 && !draft ? 'Save the material details first' : undefined,
  }));

  if (draftId && draftQ.error) {
    return (
      <Page crumb="Draft">
        <Head title="Tokenize material" sub="Draft" status="DRAFT" />
        <Alert tone="danger" title="This draft is not available" action={<a href="/tokenize" className="t-btn t-btn-sm t-btn-secondary">Start a new request</a>}>
          {errorMessage(draftQ.error)}
        </Alert>
      </Page>
    );
  }

  const nextCopy = submitted
    ? 'Your request is on its way. This page moves on by itself once the network has it.'
    : step === 0
      ? 'Add evidence next. The automated review starts as soon as the request is submitted.'
      : missingTitles.length
        ? `Upload ${missingTitles.join(' and ')}, then submit: your wallet signs the mint request.`
        : 'Submit for review: your wallet signs the mint request and the automated review starts within a minute.';

  return (
    <Page crumb={draft ? 'Draft' : 'New request'}>
      <Head title={title} sub={sub} status={submitted ? 'SUBMITTING' : draft ? 'DRAFT' : 'NEW'} />
      <Stepper steps={steps} sel={sel} onPick={(k) => (k === 'details' ? setStep(0) : k === 'evidence' ? saveDetails() : undefined)} />
      <Columns
        main={
          <>
            {!signedIn || !verified ? <SignInCard /> : null}
            {step === 0 ? (
              <div className="t-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="t-stack" style={{ gap: '4px' }}>
                  <span className="t-h3">Material details</span>
                  <span className="t-sm t-sec">Describe the metal exactly as it appears on the certificate of analysis.</span>
                </div>
                <div className="t-field">
                  <span className="t-label">Material class</span>
                  <div style={{ display: 'grid', gridTemplateColumns: materials.length > 4 ? 'repeat(auto-fill, minmax(150px, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
                    {cfg.isLoading ? [0, 1, 2, 3].map((i) => <div key={i} className="t-skel" style={{ height: '78px' }} />) : null}
                    {materials.map((m) => {
                      const on = m.code === form.material;
                      return (
                        <button
                          key={m.code}
                          disabled={!editable}
                          onClick={() => pickMaterial(m.code)}
                          aria-pressed={on}
                          style={{ textAlign: 'left', padding: '12px', borderRadius: '12px', cursor: editable ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text)', background: on ? 'var(--brand-subtle)' : 'var(--bg-sunken)', border: `1px solid ${on ? 'var(--brand-border)' : 'var(--border)'}` }}
                        >
                          <span className="t-mono-sm t-muted">{m.code}</span>
                          <span className="t-sm" style={{ fontWeight: '500' }}>{m.family}</span>
                          <span className="t-cap">{m.grade}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '20px' }}>
                  <label className="t-field">
                    <span className="t-label">Quantity</span>
                    <span style={{ position: 'relative' }}>
                      <input className="t-input" inputMode="decimal" placeholder="25.000" value={form.qty} disabled={!editable}
                        onChange={(e) => set({ qty: e.target.value })} onBlur={() => qtyKg && set({ qty: tonnes(qtyKg).replace(/,/g, '') })}
                        style={{ paddingRight: '40px', fontVariantNumeric: 'tabular-nums' }} />
                      <span className="t-sm t-muted" style={{ position: 'absolute', right: '12px', top: '10px' }}>t</span>
                    </span>
                    <span className="t-help" style={touched && errors.qty ? { color: 'var(--danger-text)' } : undefined}>
                      {touched && errors.qty ? errors.qty : `Net weight, 3 decimals. Minimum lot ${tonnes(minLot)} t.`}
                    </span>
                  </label>
                  <label className="t-field">
                    <span className="t-label">Certificate identifier</span>
                    <input className="t-input" placeholder="COA-RTM-2026-118204" value={form.cert} disabled={!editable} maxLength={64}
                      onChange={(e) => set({ cert: e.target.value })} style={{ fontFamily: 'var(--mono)', fontSize: '13px' }} />
                    <span className="t-help" style={touched && errors.cert ? { color: 'var(--danger-text)' } : undefined}>
                      {touched && errors.cert ? errors.cert : 'As printed on the certificate of analysis.'}
                    </span>
                  </label>
                  <label className="t-field">
                    <span className="t-label">Warehouse</span>
                    <select className="t-input t-select" value={form.warehouseId || ''} disabled={!editable} onChange={(e) => set({ warehouseId: Number(e.target.value) })}>
                      {!options.length ? <option value="">No eligible warehouse stores this material</option> : null}
                      {wh && !options.includes(wh) ? <option value={wh.warehouseId}>{wh.name} · {wh.code} (unavailable)</option> : null}
                      {options.map((w) => <option key={w.warehouseId} value={w.warehouseId}>{w.name} · {w.code ?? `#${w.warehouseId}`}</option>)}
                    </select>
                    <span className="t-help" style={touched && errors.warehouse ? { color: 'var(--danger-text)' } : undefined}>
                      {touched && errors.warehouse
                        ? errors.warehouse
                        : `Only warehouses with a healthy reserve feed are listed.${unavailable.length ? ' ' + unavailable.map((w) => `${w.name}: ${(w.reason ?? 'unavailable').toLowerCase()}.`).join(' ') : ''}`}
                    </span>
                  </label>
                  <label className="t-field">
                    <span className="t-label">Region</span>
                    <input className="t-input" value={wh ? [wh.region, wh.place].filter(Boolean).join(' · ') : ''} readOnly style={{ color: 'var(--text-secondary)' }} />
                    <span className="t-help">Set by the warehouse.</span>
                  </label>
                  <label className="t-field">
                    <span className="t-label">Warehouse receipt number</span>
                    <input className="t-input" placeholder="Optional" value={form.receipt} disabled={!editable} maxLength={64}
                      onChange={(e) => set({ receipt: e.target.value })} style={{ fontFamily: 'var(--mono)', fontSize: '13px' }} />
                    <span className="t-help">The inspector and the warehouse check it against the receipt.</span>
                  </label>
                  {wh && qtyKg && qtyKg > wh.headroomKg ? (
                    <div className="t-reason" style={{ alignSelf: 'center' }}>
                      {wh.name} has {tonnes(wh.headroomKg)} t of attested headroom. You can submit; minting waits until the reserve covers this lot.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : draft ? (
              <EvidenceStep cfg={c} draft={draft} editable={editable && !tx.busy && !actions.prepare.isPending} />
            ) : null}

            {submitted && step === 1 ? (
              <Alert
                tone="info"
                title="Submitted · waiting for the network"
                action={
                  <>
                    <button className="t-btn t-btn-sm t-btn-secondary" disabled={!!busy} onClick={submit}>Submit again</button>
                    <button className="t-btn t-btn-sm t-btn-ghost" disabled={!!busy || actions.reopen.isPending} onClick={() => actions.reopen.mutate(draft!.id)}>Back to editing</button>
                  </>
                }
              >
                If your wallet sent the transaction, this page moves on by itself once the request is indexed (a few seconds).
                If it did not, submit again or go back to editing.
              </Alert>
            ) : null}
            {note ? <Alert tone="warning" title="Heads up">{note}</Alert> : null}

            {step === 0 ? (
              <Nav hint="Step 1 of 7" next={saveDetails} nextLabel="Continue to evidence" nextDisabled={!signedIn || (touched && !valid)} busy={saving ? 'Saving…' : null} />
            ) : (
              <Nav
                back={() => setStep(0)}
                hint={!verified ? 'Verify your wallet to submit' : missingTitles.length ? `Upload: ${missingTitles.join(', ')}` : busy ?? 'Step 2 of 7'}
                next={submitted ? undefined : submit}
                nextLabel="Submit for review"
                nextDisabled={!editable || !!missingTitles.length || !verified}
                busy={busy}
              />
            )}
          </>
        }
        aside={
          <>
            <Summary
              rows={[
                ['Material', mat?.name ?? '—'],
                ['Code', mat?.code ?? '—', true],
                ['Quantity', qtyKg ? `${tonnes(qtyKg)} t` : '—'],
                ['Warehouse', wh?.code ?? '—', true],
                ['Indicative value', usd(value)],
                ['Borrow capacity once minted', capacity != null ? usdc(capacity) : <span className="t-muted">After saving</span>],
              ]}
            />
            <NextCard copy={nextCopy} />
            {draft && editable ? (
              <div className="t-card t-card-dense t-stack" style={{ gap: '8px' }}>
                <span className="t-label">Discard draft</span>
                <span className="t-cap">Nothing has been written on-chain yet. Discarding deletes the draft and its uploaded files.</span>
                <button className="t-btn t-btn-sm t-btn-danger-outline" style={{ alignSelf: 'flex-start' }} disabled={actions.discard.isPending} onClick={discard}>Discard draft</button>
              </div>
            ) : null}
            {c && c.mintFee !== '0' ? (
              <div className="t-card t-card-dense t-stack" style={{ gap: '8px' }}>
                <span className="t-label">Request fee</span>
                <span className="t-cap">
                  {(Number(c.mintFee) / 10 ** (c.feeTokenDecimals ?? 6)).toLocaleString('en-US')} {c.feeTokenSymbol ?? 'tokens'} is charged when you submit, on {chain.name}.
                </span>
              </div>
            ) : null}
            <YourRequests currentDraft={draft?.id} />
          </>
        }
      />
    </Page>
  );
}

function EvidenceStep({ cfg, draft, editable }: { cfg: MintConfigOut | undefined; draft: MintDraft; editable: boolean }) {
  const { chain, setError } = useSession();
  const actions = useDraftActions();
  const kinds = cfg?.docKinds ?? [];
  const firstMissing = draft.missing[0] ?? kinds.find((k) => !k.required)?.kind ?? 'certificate';
  const [dropKind, setDropKind] = useState(firstMissing);
  const [over, setOver] = useState(false);
  const [pending, setPending] = useState<{ key: string; name: string; kind: string; size: number; error?: string }[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const pickKind = useRef(dropKind);
  useEffect(() => setDropKind((k) => (draft.missing.includes(k) || !draft.missing.length ? k : draft.missing[0])), [draft.missing.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxMb = cfg?.maxFileMb ?? 25;
  // one at a time: each upload rewrites the draft's document list
  const upload = async (kind: string, list: File[]) => {
    const k = kinds.find((x) => x.kind === kind);
    const files = k?.multiple ? list : list.slice(0, 1);
    const items = files.map((file, i) => ({ key: `${Date.now()}-${i}`, name: file.name, kind, size: file.size, file }));
    setPending((p) => [...p, ...items.map(({ file: _f, ...r }) => r)]);
    for (const it of items) {
      try {
        if (it.size > maxMb * 1024 * 1024) throw new Error(`${it.name} is larger than ${maxMb} MB`);
        await actions.upload.mutateAsync({ id: draft.id, kind, file: it.file });
        setPending((p) => p.filter((x) => x.key !== it.key));
      } catch (e) {
        setPending((p) => p.map((x) => (x.key === it.key ? { ...x, error: errorMessage(e) } : x)));
      }
    }
  };
  const browse = (kind: string) => {
    pickKind.current = kind;
    if (input.current) {
      input.current.multiple = !!kinds.find((x) => x.kind === kind)?.multiple;
      input.current.click();
    }
  };
  const remove = (f: EvidenceFile) =>
    actions.removeDocument.mutateAsync({ id: draft.id, fileId: f.id }).catch((e) => setError(errorMessage(e)));
  const open = (f: EvidenceFile) => openEvidenceFile(chain.chainId, f.id).catch((e) => setError(errorMessage(e)));

  const nameStyle = { maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;
  const btn = (label: string, onClick: () => void) => (
    <button key={label} className="t-btn t-btn-sm t-btn-secondary" disabled={!editable} onClick={onClick}>{label}</button>
  );
  const drop = (label: string, onClick: () => void) => (
    <button key={label} className="t-btn t-btn-sm t-btn-ghost" disabled={!editable} onClick={onClick} aria-label={label} title={label} style={{ width: '30px', padding: '0' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  );

  return (
    <div className="t-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="t-stack" style={{ gap: '4px' }}>
        <span className="t-h3">Evidence</span>
        <span className="t-sm t-sec">
          Files are content-addressed (SHA-256) and frozen when you submit. Reviewers see exactly what you upload; nothing can be changed afterwards.
        </span>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) upload(pickKind.current, files);
        }}
      />
      {editable ? (
        <div
          className="tk-drop"
          data-over={over}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const files = Array.from(e.dataTransfer.files ?? []);
            if (files.length) upload(dropKind, files);
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" /></svg>
          <span className="t-sm">Drop files or <button className="tk-link" onClick={() => browse(dropKind)}>browse</button></span>
          <span className="t-row t-cap" style={{ gap: '8px' }}>
            Adds them as
            <select className="t-input t-select" value={dropKind} onChange={(e) => setDropKind(e.target.value)} style={{ height: '28px', fontSize: '12px', width: 'auto', padding: '0 28px 0 10px' }}>
              {kinds.map((k) => <option key={k.kind} value={k.kind}>{k.title}</option>)}
            </select>
          </span>
          <span className="t-cap">PDF, JPG, PNG up to {maxMb} MB each</span>
        </div>
      ) : null}
      <div className="t-table-wrap">
        <table className="t-table t-dense">
          <thead>
            <tr><th>Document</th><th>Evidence reference</th><th className="t-right">Size</th><th>Status</th>{editable ? <th className="t-right" /> : null}</tr>
          </thead>
          <tbody>
            {kinds.flatMap((k) => {
              const files = draft.documents.filter((d) => d.kind === k.kind);
              const rows = files.map((f, i) => (
                <tr key={f.id}>
                  <td>
                    <span className="t-stack" style={{ minWidth: '0' }}>
                      <button className="tk-row-link t-sm" style={{ fontWeight: '500' }} onClick={() => open(f)} title={`Open ${f.filename}`}>{k.title}</button>
                      <span className="t-cap" style={nameStyle} title={f.filename}>{f.filename}</span>
                    </span>
                  </td>
                  <td><span className="t-mono t-sec" title={`sha256 ${f.sha256}`}>{shortSha(f.sha256)}</span></td>
                  <td className="t-right"><span className="t-num">{fileSize(f.size)}</span></td>
                  <td><Badge word tone="t-success">Stored</Badge></td>
                  {editable ? (
                    <td className="t-right"><span className="t-row" style={{ gap: '6px', justifyContent: 'flex-end' }}>
                      {k.multiple ? (i === 0 ? btn('Add', () => browse(k.kind)) : null) : btn('Replace', () => browse(k.kind))}
                      {drop(`Remove ${f.filename}`, () => remove(f))}
                    </span></td>
                  ) : null}
                </tr>
              ));
              const waiting = pending.filter((p) => p.kind === k.kind);
              if (!files.length && !waiting.length) {
                rows.push(
                  <tr key={k.kind}>
                    <td><span className="t-stack"><span className="t-sm" style={{ fontWeight: '500' }}>{k.title}</span><span className="t-cap" style={nameStyle} title={k.detail}>{k.detail}</span></span></td>
                    <td><span className="t-mono t-sec">—</span></td>
                    <td className="t-right"><span className="t-num">—</span></td>
                    <td>{k.required ? <Badge word tone="t-warning">Required</Badge> : <Badge word tone="t-neutral">Optional</Badge>}</td>
                    {editable ? <td className="t-right">{btn('Upload', () => browse(k.kind))}</td> : null}
                  </tr>,
                );
              }
              for (const p of waiting) {
                rows.push(
                  <tr key={p.key}>
                    <td><span className="t-stack"><span className="t-sm" style={{ fontWeight: '500' }}>{k.title}</span><span className="t-cap" style={nameStyle}>{p.name}</span></span></td>
                    <td><span className="t-mono t-sec">—</span></td>
                    <td className="t-right"><span className="t-num">{fileSize(p.size)}</span></td>
                    <td>{p.error ? <span title={p.error}><Badge word tone="t-danger">Failed</Badge></span> : <Badge word pulse tone="t-info">Uploading</Badge>}</td>
                    {editable ? <td className="t-right">{p.error ? drop('Dismiss', () => setPending((x) => x.filter((y) => y.key !== p.key))) : null}</td> : null}
                  </tr>,
                );
              }
              return rows;
            })}
          </tbody>
        </table>
      </div>
      {pending.some((p) => p.error) ? <span className="t-reason">{pending.filter((p) => p.error).map((p) => p.error).join(' · ')}</span> : null}
      {draft.evidenceUri ? <span className="t-cap">Evidence bundle <span className="t-mono">{draft.evidenceUri}</span></span> : null}
    </div>
  );
}
