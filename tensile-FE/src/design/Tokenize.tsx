/* Tokenize material (F-1). Built from Tokenize.dc.html (same markup and classes), driven by /mint:
 *   /tokenize                 start a request; your open drafts and requests are listed alongside
 *   /tokenize?draft=<id>      steps 1-2 (material details, evidence) are an off-chain draft; "Submit for review"
 *                             freezes it and signs MintingController.requestMint from the owner's wallet
 *   /tokenize?request=<id>    steps 3-7 of a mint request: automated review, inspection, custody, reserve, mint.
 *                             The owner signs finalizeMint; risk staff can override a low review or reject.
 */
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useSession } from '../state/session';
import DraftView from './tokenize/DraftView';
import RequestView from './tokenize/RequestView';
import './Tokenize.css';

export default function Tokenize() {
  const [params] = useSearchParams();
  const requestId = Number(params.get('request')) || undefined;
  const draftId = params.get('draft') ?? undefined;
  const { chain } = useSession();
  // a chain switch makes ids from the other chain meaningless: remount
  const key = useMemo(() => `${chain.chainId}:${requestId ?? ''}:${draftId ?? 'new'}`, [chain.chainId, requestId, draftId]);
  return requestId ? <RequestView key={key} id={requestId} /> : <DraftView key={key} draftId={draftId} />;
}
