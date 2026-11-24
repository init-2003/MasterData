import React, { useState } from 'react';

export function WebsiteImagePreview({ src, alt, external = false, onLoad, onError }) {
  const [failed, setFailed] = useState(false);
  const isExternal = external || /^https?:\/\//i.test(src || '');
  return src && !failed
    ? <img className="website-image-preview" src={src} alt={alt} loading="lazy"
      referrerPolicy={isExternal ? 'no-referrer' : undefined}
      onLoad={() => onLoad?.()}
      onError={() => { setFailed(true); onError?.(); }} />
    : <div className="website-image-preview website-image-unavailable">ไม่มีภาพตัวอย่าง</div>;
}
