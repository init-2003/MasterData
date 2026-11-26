import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function CarouselSection({ slides }) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef(null);
  if (!slides.length) return null;
  const active = Math.min(index, slides.length - 1);
  const current = slides[active];
  const prev = () => setIndex((active - 1 + slides.length) % slides.length);
  const next = () => setIndex((active + 1) % slides.length);

  return <section className="store-section" aria-label="ภาพสไลด์แนะนำ">
    <div className="store-carousel">
      <img key={current.id} src={current.imageUrl} alt={current.title || 'ภาพสไลด์'}
        referrerPolicy="no-referrer" draggable={false}
        onTouchStart={(event) => { touchStart.current = event.touches[0]; }}
        onTouchCancel={() => { touchStart.current = null; }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start || slides.length < 2) return;
          const end = event.changedTouches[0];
          const dx = end.clientX - start.clientX;
          const dy = end.clientY - start.clientY;
          if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return;
          if (dx < 0) next();
          else prev();
        }} />
      {slides.length > 1 && <>
        <button type="button" className="carousel-nav carousel-prev" onClick={prev} aria-label="สไลด์ก่อนหน้า">
          <ChevronLeft aria-hidden="true" />
        </button>
        <button type="button" className="carousel-nav carousel-next" onClick={next} aria-label="สไลด์ถัดไป">
          <ChevronRight aria-hidden="true" />
        </button>
        <div className="carousel-dots" role="group" aria-label="เลือกสไลด์">
          {slides.map((slide, idx) => (
            <button key={slide.id} type="button" aria-current={idx === active ? 'true' : undefined}
              aria-label={`สไลด์ที่ ${idx + 1}: ${slide.title || ''}`}
              onClick={() => setIndex(idx)} />
          ))}
        </div>
      </>}
    </div>
  </section>;
}
