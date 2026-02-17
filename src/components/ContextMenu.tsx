import { useEffect, useRef } from 'react';

interface ContextMenuItem {
  label: string;
  icon: string;
  action: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) {
      el.style.top = Math.max(4, window.innerHeight - rect.height - 4) + 'px';
    }
    if (rect.right > window.innerWidth) {
      el.style.left = Math.max(4, window.innerWidth - rect.width - 4) + 'px';
    }
  }, [x, y]);

  return (
    <>
      <div className="context-menu__backdrop" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="context-menu" ref={ref} style={{ left: x, top: y }}>
        {items.map((item, i) => (
          <button
            key={i}
            className={`context-menu__item ${item.danger ? 'context-menu__item--danger' : ''}`}
            onClick={() => { item.action(); onClose(); }}
          >
            <span className="context-menu__icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
