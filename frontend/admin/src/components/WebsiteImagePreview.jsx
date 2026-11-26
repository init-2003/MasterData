import React, { useState } from 'react';
import { resolveApiUrl } from '../../../shared/utils/api-base.js';

export function WebsiteImagePreview({ src, alt, external = false, onLoad, onError }) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveApiUrl(src);
  const isExternal = external || /^https?:\/\//i.test(src || '');
  return resolved && !failed
    ? <img className="website-image-preview" src={resolved} alt={alt} loading="lazy"
      referrerPolicy={isExternal ? 'no-referrer' : undefined}
      onLoad={() => onLoad?.()}
      onError={() => { setFailed(true); onError?.(); }} />
    : <div className="website-image-preview website-image-unavailable">ไม่มีภาพตัวอย่าง</div>;
}
