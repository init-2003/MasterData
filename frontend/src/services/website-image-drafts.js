import { imageDrafts } from './image-drafts.js';
import { createImageDraftToken } from '../utils/image-draft-token.js';

const fileOperations = new Map();
const storageKey = (username, menu) => JSON.stringify(['sptc.website-image-editor', username, menu]);
const fileKey = (token) => `sptc.website-image-editor.${token}`;

export function readWebsiteImageDraft(username, menu) {
  try {
    const draft = JSON.parse(sessionStorage.getItem(storageKey(username, menu)));
    if (typeof draft?.token === 'string' && draft.item && typeof draft.fields?.title === 'string'
      && typeof draft.fields.active === 'boolean') {
      const fallbackMode = draft.item.sourceType === 'url' ? 'url' : 'upload';
      const mode = draft.fields.mode === 'url' || draft.fields.mode === 'upload' ? draft.fields.mode : fallbackMode;
      const imageUrl = typeof draft.fields.imageUrl === 'string'
        ? draft.fields.imageUrl
        : (draft.item.sourceType === 'url' ? (draft.item.imageUrl ?? '') : '');
      return {
        ...draft,
        fields: {
          title: draft.fields.title,
          active: draft.fields.active,
          mode,
          imageUrl,
        },
      };
    }
  } catch { /* Unavailable storage or an unreadable draft. */ }
  return null;
}

export function newWebsiteImageDraft(item) {
  const token = createImageDraftToken();
  const mode = item.sourceType === 'url' ? 'url' : 'upload';
  return {
    token,
    item,
    fields: {
      title: item.title ?? '',
      active: Boolean(item.active),
      mode,
      imageUrl: mode === 'url' ? (item.imageUrl ?? '') : '',
    },
    fileName: null,
  };
}

export function saveWebsiteImageDraft(username, menu, draft) {
  try {
    sessionStorage.setItem(storageKey(username, menu), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function readWebsiteDraftFile(token) {
  return imageDrafts.get(fileKey(token));
}

export function writeWebsiteDraftFile(token, file) {
  const key = fileKey(token);
  const previous = fileOperations.get(key) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(() => file ? imageDrafts.put(key, file) : imageDrafts.remove(key));
  fileOperations.set(key, pending);
  const release = () => { if (fileOperations.get(key) === pending) fileOperations.delete(key); };
  pending.then(release, release);
  return pending;
}

export function clearWebsiteImageDraft(username, menu, token) {
  const stored = readWebsiteImageDraft(username, menu);
  if (stored?.token === token) {
    try { sessionStorage.removeItem(storageKey(username, menu)); } catch { /* Storage is unavailable. */ }
  }
  if (stored?.fileName || fileOperations.has(fileKey(token))) {
    void writeWebsiteDraftFile(token, null).catch(() => {});
  }
}
