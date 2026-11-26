import { createImageDraftToken } from '../../utils/image-draft-token.js';

// State that the product store parts share but the view never reads.
export function createProductContext() {
  let draftWrites = Promise.resolve();
  let draftToken;
  try {
    draftToken = sessionStorage.getItem('sptc.image-draft-tab');
    if (!draftToken) {
      const token = createImageDraftToken();
      sessionStorage.setItem('sptc.image-draft-tab', token);
      draftToken = token;
    }
  } catch { /* Draft persistence is unavailable. */ }

  const pageSizeKey = 'sptc.page-size';
  let initialPageSize = 50;
  try {
    const savedSize = Number.parseInt(sessionStorage.getItem(pageSizeKey) || '', 10);
    if (Number.isInteger(savedSize) && savedSize >= 1 && savedSize <= 500) initialPageSize = savedSize;
  } catch { /* Storage may be unavailable. */ }

  const detailStorageKey = 'sptc.open-product';
  const editStorageKey = 'sptc.product-edit';

  return {
    requests: { products: undefined, types: undefined, units: undefined, images: undefined, note: undefined, shortNote: undefined },
    detailTrigger: undefined,
    imageFiles: new Map(),
    imageInputs: new Map(),
    draftToken,
    pageSizeKey,
    initialPageSize,
    detailStorageKey,
    editStorageKey,
    draftKey: (user, id, slot) => JSON.stringify([draftToken, user, id, slot]),
    queueDraft(operation, onFailure = () => {}) { draftWrites = draftWrites.catch(() => {}).then(operation).catch(onFailure); },
    waitForDrafts: () => draftWrites,
    clearSavedEdit() { try { sessionStorage.removeItem(editStorageKey); } catch { /* Storage may be unavailable. */ } },
    clearSavedDetail() { try { sessionStorage.removeItem(detailStorageKey); } catch { /* Storage may be unavailable. */ } },
  };
}
