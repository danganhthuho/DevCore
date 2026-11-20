'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LINKS } from '@/components/NavBar';
import { PlusIcon, ScanIcon, SearchIcon, UploadIcon } from '@/components/Icons';
import { hasRole } from '@/lib/auth/roles';
import { SETTINGS_TABS } from '@/components/settings/tabs';

const ACTIONS = [
  { label: 'Add a product', href: '/products/new', Icon: PlusIcon },
  { label: 'Scan a barcode', href: '/inventory?scan=1', Icon: ScanIcon },
  { label: 'Import products from CSV', href: '/products/import', Icon: UploadIcon },
];

// ⌘K / Ctrl+K anywhere (or the sidebar's Search button): jump to a product,
// a page or a common action.
export default function CommandPalette({ role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-palette', onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setProducts([]);
    setSelected(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Product search, 200 ms after typing stops.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) return setProducts([]);
    const timer = setTimeout(async () => {
      const isBarcode = /^\d{6,}$/.test(q);
      const res = await fetch(isBarcode
        ? `/api/products/barcode/${encodeURIComponent(q)}`
        : `/api/products?search=${encodeURIComponent(q)}`);
      if (!res.ok) return setProducts([]);
      const body = await res.json();
      setProducts((isBarcode ? [body] : body).slice(0, 8));
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (label) => !q || label.toLowerCase().includes(q);
    const list = [];
    for (const p of products) {
      list.push({ group: 'Products', label: p.name, hint: `${p.quantity} in stock · ${p.status}`, href: `/products/${p.id}/edit` });
    }
    for (const [href, label, Icon, minRole] of LINKS) {
      if ((minRole === 'Staff' || hasRole(role, minRole)) && matches(label)) list.push({ group: 'Pages', label, href, Icon });
    }
    for (const t of SETTINGS_TABS) {
      const label = `Settings: ${t.label}`;
      if (hasRole(role, t.role) && (matches(label) || matches(t.title))) list.push({ group: 'Settings', label, href: `/settings?tab=${t.id}`, Icon: t.Icon });
    }
    for (const a of ACTIONS) if (matches(a.label)) list.push({ group: 'Actions', ...a });
    if (/^\d{6,}$/.test(q) && products.length === 0) {
      list.push({ group: 'Actions', label: `Add a product with barcode ${q}`, href: `/products/new?barcode=${q}`, Icon: PlusIcon });
    }
    return list;
  }, [products, query, role]);

  useEffect(() => { setSelected(0); }, [items.length]);

  function go(item) {
    setOpen(false);
    router.push(item.href);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && items[selected]) { e.preventDefault(); go(items[selected]); }
  }

  if (!open) return null;

  let lastGroup = null;
  return (
    <div className="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown}
          placeholder="Search products, barcodes or pages…" aria-label="Search"
          role="combobox" aria-expanded="true" aria-controls="palette-results"
          aria-activedescendant={items[selected] ? `palette-${selected}` : undefined} />
        <ul id="palette-results" role="listbox">
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? <li key={`g-${item.group}`} className="group" role="presentation">{item.group}</li> : null;
            lastGroup = item.group;
            const Icon = item.Icon ?? SearchIcon;
            return [
              header,
              <li key={`${item.group}-${item.href}-${i}`} id={`palette-${i}`} role="option" aria-selected={i === selected}
                onMouseEnter={() => setSelected(i)} onMouseDown={(e) => { e.preventDefault(); go(item); }}>
                <Icon size={16} /> {item.label} {item.hint && <small>{item.hint}</small>}
              </li>,
            ];
          })}
          {items.length === 0 && <li className="group" role="presentation">No matches</li>}
        </ul>
        <div className="hint"><kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close</div>
      </div>
    </div>
  );
}
