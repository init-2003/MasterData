import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';

export function ProductThumbnail({ id, version, large = false }) {
  const [slot, setSlot] = useState(1);
  const [slots, setSlots] = useState({ 1: 'loading', 2: 'loading' });
  const slotUrl = (targetSlot) => `./api.php?${new URLSearchParams({ action: 'product-image', id, slot: String(targetSlot), v: String(version) })}`;

  useEffect(() => {
    if (typeof Image === 'undefined') return undefined;
    let active = true;
    const probe = new Image();
    probe.onload = () => { if (active) setSlots((prev) => ({ ...prev, 2: 'loaded' })); };
    probe.onerror = () => { if (active) setSlots((prev) => ({ ...prev, 2: 'failed' })); };
    probe.src = slotUrl(2);
    return () => { active = false; };
  }, [id, version]);

  const hasTwoImages = slots[1] === 'loaded' && slots[2] === 'loaded';

  if (!large) {
    if (hasTwoImages) {
      return <span className="catalog-thumbnails" aria-hidden="true">
        <span className="catalog-thumbnail"><img src={slotUrl(1)} alt="" loading="lazy" /></span>
        <span className="catalog-thumbnail"><img src={slotUrl(2)} alt="" loading="lazy" /></span>
      </span>;
    }
    const primarySlot = slots[1] === 'failed' && slots[2] === 'loaded' ? 2 : 1;
    const failed = slots[primarySlot] === 'failed';
    return <span className="catalog-thumbnail" aria-hidden="true">{failed ? <ImageOff /> : <img src={slotUrl(primarySlot)} alt="" loading="lazy" onLoad={() => setSlots((prev) => ({ ...prev, [primarySlot]: 'loaded' }))} onError={() => setSlots((prev) => ({ ...prev, [primarySlot]: 'failed' }))} />}</span>;
  }
  const activeSlot = !hasTwoImages && slots[1] === 'failed' && slots[2] === 'loaded' ? 2 : slot;
  const failed = slots[activeSlot] === 'failed';
  const toggleSlot = () => setSlot((current) => (current === 1 ? 2 : 1));

  return <div className="catalog-thumbnail catalog-thumbnail-large">
    {failed ? <ImageOff aria-hidden="true" /> : <img key={activeSlot} src={slotUrl(activeSlot)} alt="" loading="lazy" onLoad={() => setSlots((prev) => ({ ...prev, [activeSlot]: 'loaded' }))} onError={() => setSlots((prev) => ({ ...prev, [activeSlot]: 'failed' }))} />}
    {hasTwoImages && <>
      <button type="button" className="thumbnail-nav thumbnail-prev" onClick={toggleSlot} aria-label="ดูรูปก่อนหน้า"><ChevronLeft aria-hidden="true" /></button>
      <button type="button" className="thumbnail-nav thumbnail-next" onClick={toggleSlot} aria-label="ดูรูปถัดไป"><ChevronRight aria-hidden="true" /></button>
      <span className="thumbnail-indicator" aria-hidden="true">{activeSlot}/2</span>
    </>}
  </div>;
}
