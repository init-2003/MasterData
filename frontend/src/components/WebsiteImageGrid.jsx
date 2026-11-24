import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { WebsiteImageSwitch } from './WebsiteImageSwitch.jsx';

export function WebsiteImageGrid({ items, view, disabled, togglePending, onMove, onEdit, onDelete, onToggleActive, renderImage, editingOrder }) {
  const grid = useRef(null);
  const pointer = useRef(null);
  const frame = useRef(null);
  const [target, setTarget] = useState(null);
  const [source, setSource] = useState(null);

  function resetDrag() {
    const drag = pointer.current;
    pointer.current = null;
    cancelAnimationFrame(frame.current);
    if (drag) {
      drag.element.style.removeProperty('translate');
      drag.element.classList.remove('is-moving');
    }
  }

  useEffect(() => resetDrag, []);
  useEffect(() => {
    resetDrag();
    setSource(null);
    setTarget(null);
  }, [editingOrder, view]);

  function cardAt(x, y, drag) {
    const list = grid.current;
    const hit = document.elementFromPoint(x, y);
    if (!list?.contains(hit)) return null;
    const card = hit.closest('[data-website-image-id]');
    if (card) return card.dataset.websiteImageId;

    const { left, right, top, bottom } = drag.startBounds;
    const originY = y + drag.scroll.scrollTop - drag.startScroll;
    if (x >= left && x <= right && originY >= top && originY <= bottom) return drag.id;

    // A release in a grid gap can still land on the adjacent card.
    let closest = null;
    let minDistance = parseFloat(getComputedStyle(list).gap);
    for (const candidate of list.children) {
      const { websiteImageId } = candidate.dataset;
      if (websiteImageId === drag.id) continue;
      const { left, right, top, bottom } = candidate.getBoundingClientRect();
      const distance = Math.hypot(Math.max(left - x, x - right, 0), Math.max(top - y, y - bottom, 0));
      if (distance <= minDistance) {
        closest = websiteImageId;
        minDistance = distance;
      }
    }
    return closest;
  }

  function trackPointer() {
    const drag = pointer.current;
    if (!drag) return;
    const { x, y, scroll, viewport } = drag;
    if (drag.moved) {
      const bounds = viewport?.getBoundingClientRect();
      const top = bounds?.top ?? 0;
      const bottom = bounds?.bottom ?? window.innerHeight;
      if (y >= top && y < top + 56) scroll.scrollTop -= 12;
      if (y <= bottom && y > bottom - 56) scroll.scrollTop += 12;
      const deltaY = y - drag.startY + scroll.scrollTop - drag.startScroll;
      drag.element.classList.add('is-moving');
      drag.element.style.translate = `${x - drag.startX}px ${deltaY}px`;
      setTarget(cardAt(x, y, drag));
    }
    frame.current = requestAnimationFrame(trackPointer);
  }

  function start(event, id) {
    if (event.button !== 0 || pointer.current || event.target.closest('button')) return;
    event.preventDefault();
    const main = grid.current.closest('main');
    const viewport = getComputedStyle(main).overflowY === 'auto' ? main : null;
    const element = event.currentTarget;
    const scroll = viewport ?? document.scrollingElement;
    element.setPointerCapture(event.pointerId);
    pointer.current = {
      id, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      startX: event.clientX, startY: event.clientY, moved: false,
      viewport, scroll, element, startScroll: scroll.scrollTop, startBounds: element.getBoundingClientRect(),
    };
    setSource(id);
    frame.current = requestAnimationFrame(trackPointer);
  }

  function move(event) {
    const drag = pointer.current;
    if (drag?.pointerId !== event.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.moved ||= Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 5;
  }

  function stop(event, drop = false) {
    const drag = pointer.current;
    if (drag?.pointerId !== event.pointerId) return;
    const destination = drop && drag.moved ? cardAt(event.clientX, event.clientY, drag) : null;
    resetDrag();
    setSource(null);
    setTarget(null);
    if (destination && destination !== drag.id) onMove(drag.id, destination);
  }

  return <ul ref={grid} className="website-image-grid" data-view={view}>
    {items.map((item, index) => {
      const name = item.title || 'ภาพไม่มีชื่อ';
      return <li key={item.id} data-website-image-id={item.id} data-reorderable={editingOrder && !disabled || undefined}
        data-drag-source={source === item.id || undefined}
        data-drop-target={source !== item.id && target === item.id || undefined}
        onPointerDown={editingOrder && !disabled ? (event) => start(event, item.id) : undefined}
        onPointerMove={move} onPointerUp={(event) => stop(event, true)}
        onPointerCancel={(event) => stop(event)} onLostPointerCapture={(event) => stop(event)}
        onDragStart={editingOrder ? (event) => event.preventDefault() : undefined}>
        {editingOrder && <div className="website-image-order-controls">
          <span className="website-image-grip" aria-hidden="true">
            <GripVertical />
          </span>
          <button type="button" aria-label={'เลื่อนขึ้น ' + name} disabled={disabled}
            aria-disabled={index === 0} onClick={() => { if (index > 0) onMove(item.id, items[index - 1].id); }}>
            <ArrowUp aria-hidden="true" />
          </button>
          <button type="button" aria-label={'เลื่อนลง ' + name} disabled={disabled}
            aria-disabled={index === items.length - 1} onClick={() => { if (index < items.length - 1) onMove(item.id, items[index + 1].id); }}>
            <ArrowDown aria-hidden="true" />
          </button>
        </div>}
        {renderImage(item)}
        <h2>{name}</h2>
        <WebsiteImageSwitch checked={item.active} disabled={disabled || editingOrder}
          aria-disabled={togglePending || undefined} aria-label={'การแสดงภาพ ' + name}
          onChange={(event) => onToggleActive(item, event.currentTarget.checked)} />
        {!editingOrder && <div className="website-image-buttons website-image-card-actions">
          <button type="button" disabled={disabled} onClick={(event) => onEdit(item, event.currentTarget)} aria-label={'แก้ไขภาพ ' + name}>แก้ไข</button>
          <button type="button" className="website-image-delete" disabled={disabled}
            onClick={() => onDelete(item)} aria-label={'ลบภาพ ' + name}>ลบภาพ</button>
        </div>}
      </li>;
    })}
  </ul>;
}
