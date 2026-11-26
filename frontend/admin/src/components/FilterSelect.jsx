import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export function FilterSelect({ id, label, value, options, placeholder, disabled, describedBy, onChange }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);

  // Options are plain strings (value = label) or { value, label } pairs.
  const items = [{ value: '', label: placeholder }, ...options.map((item) => (typeof item === 'string' ? { value: item, label: item } : item))];
  const selectedIndex = Math.max(0, items.findIndex((item) => item.value === value));
  const selectedLabel = items[selectedIndex]?.label ?? placeholder;
  const listboxId = `${id}-listbox`;

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const openMenu = (index = selectedIndex) => {
    if (disabled) return;
    setActiveIndex(index);
    setOpen(true);
  };

  const selectOption = (nextValue) => {
    setOpen(false);
    if (nextValue !== value) onChange(nextValue);
    triggerRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if (disabled) return;
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openMenu(selectedIndex);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + items.length) % items.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(items.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectOption(items[activeIndex]?.value ?? '');
    }
  };

  return <div className="type-select-wrap" ref={wrapRef} onKeyDown={onKeyDown}>
    <button
      ref={triggerRef}
      id={id}
      type="button"
      className={`type-select filter-select-trigger${open ? ' is-open' : ''}`}
      aria-label={`${label}: ${selectedLabel}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => (open ? setOpen(false) : openMenu(selectedIndex))}
    >
      <span className="filter-select-label">{selectedLabel}</span>
      <ChevronDown aria-hidden="true" />
    </button>
    {open && <ul id={listboxId} className="filter-select-menu" role="listbox" aria-label={label} aria-activedescendant={`${id}-option-${activeIndex}`}>
      {items.map((item, index) => {
        const selected = item.value === value;
        const active = index === activeIndex;
        return <li
          key={item.value || '__all__'}
          id={`${id}-option-${index}`}
          ref={(element) => { optionRefs.current[index] = element; }}
          role="option"
          aria-selected={selected}
          className={`filter-select-option${selected ? ' is-selected' : ''}${active ? ' is-active' : ''}`}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => selectOption(item.value)}
        >
          <span>{item.label}</span>
          {selected && <Check aria-hidden="true" />}
        </li>;
      })}
    </ul>}
  </div>;
}
