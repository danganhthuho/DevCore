'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useConfirm, useToast } from '@/components/Feedback';
import { PlusIcon, ScanIcon, UploadIcon } from '@/components/Icons';
import { CATEGORIES } from '@/lib/products/constants';
import { STATUSES } from '@/lib/inventory/status';
import { isManager } from '@/lib/auth/roles';

const COLUMNS = [
    ['name', 'Name'],
    ['category', 'Category'],
    ['quantity', 'Qty', 'num'],
    ['minimum_quantity', 'Min', 'num'],
    ['expiration_date', 'Expires'],
    ['status', 'Status'],
];

const VIEW_KEY = 'inventory-view'; // remembered search, filters and sort (this browser only)
const UNDO_MS = 6000;

function readSavedView() {
    try { return JSON.parse(localStorage.getItem(VIEW_KEY)) ?? {}; } catch { return {}; }
}

const BADGE_CLASS = {
    'In stock': 'in-stock',
    'Low stock': 'low-stock',
    'Almost Expired': 'almost-expired',
    Expired: 'expired',
};

export default function InventoryPage() {
    const router = useRouter();
    const toast = useToast();
    const confirm = useConfirm();
    const [products, setProducts] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [status, setStatus] = useState('');
    const [supplier, setSupplier] = useState('');
    const [expiresBy, setExpiresBy] = useState('');
    const [suppliers, setSuppliers] = useState([]);
    const [sort, setSort] = useState({ key: 'name', dir: 1 });
    const [role, setRole] = useState('Staff');
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState('');
    const [viewReady, setViewReady] = useState(false);
    const [hidden, setHidden] = useState(() => new Set()); // deleted, but can still be undone
    const pendingQty = useRef({}); // product id -> clicks still being saved

    // Restore the last search/filters/sort. The dashboard links here with
    // ?status=… or ?scan=1, which win over the saved view.
    useEffect(() => {
        const saved = readSavedView();
        const params = new URLSearchParams(window.location.search);
        setSearch(saved.search ?? '');
        setCategory(saved.category ?? '');
        setSupplier(saved.supplier ?? '');
        setExpiresBy(saved.expiresBy ?? '');
        if (saved.sort?.key) setSort(saved.sort);
        if (params.get('status')) setStatus(STATUSES.includes(params.get('status')) ? params.get('status') : '');
        else setStatus(saved.status ?? '');
        setViewReady(true);
        if (params.get('scan')) setScanning(true);
        fetch('/api/auth/me').then((r) => r.ok && r.json()).then((me) => me && setRole(me.role));
        fetch('/api/suppliers').then((r) => r.ok && r.json()).then((list) => list && setSuppliers(list));
    }, []);

    const load = useCallback(async () => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (category) params.set('category', category);
        if (status) params.set('status', status);
        if (supplier) params.set('supplier', supplier);
        if (expiresBy) params.set('expires_by', expiresBy);

        const res = await fetch('/api/products?' + params);
        if (res.status === 401) return router.push('/login');
        if (!res.ok) return setError('Could not load products.');
        setError('');
        setProducts(await res.json());
        setLoaded(true);
    }, [search, category, status, supplier, expiresBy, router]);

    // Wait until the user stops typing for 300 ms before searching
    useEffect(() => {
        if (!viewReady) return;
        const timer = setTimeout(load, 300);
        return () => clearTimeout(timer);
    }, [load, viewReady]);

    useEffect(() => {
        if (!viewReady) return;
        try {
            localStorage.setItem(VIEW_KEY, JSON.stringify({ search, category, status, supplier, expiresBy, sort }));
        } catch { /* private window: just don't remember */ }
    }, [viewReady, search, category, status, supplier, expiresBy, sort]);

    const sorted = useMemo(() => {
        return products.filter((p) => !hidden.has(p.id)).sort((a, b) => {
            const x = a[sort.key] ?? '';
            const y = b[sort.key] ?? '';
            return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
        });
    }, [products, sort, hidden]);

    function toggleSort(key) {
        setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));
    }

    // + / − buttons: show the new number straight away, then save. If the
    // save fails, put the old number back.
    async function changeQuantity(product, change) {
        const id = product.id;
        if (product.quantity + change < 0) return;
        setProducts((list) => list.map((p) => (p.id === id ? { ...p, quantity: p.quantity + change } : p)));
        pendingQty.current[id] = (pendingQty.current[id] ?? 0) + 1;

        const res = await fetch(`/api/products/${id}/quantity`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ change }),
        });
        const body = await res.json().catch(() => ({}));
        pendingQty.current[id] -= 1;

        if (!res.ok) {
            setProducts((list) => list.map((p) => (p.id === id ? { ...p, quantity: p.quantity - change } : p)));
            return toast(body.errors?.quantity || body.error || 'Could not update the stock.', 'error');
        }
        // Use the server's numbers (and new status badge) once all clicks are saved.
        if (pendingQty.current[id] === 0) {
            setProducts((list) => list.map((p) => (p.id === id ? body : p)));
        }
    }

    // Delete with a few seconds to undo: the row disappears at once, and the
    // product is only really deleted when the undo time runs out.
    async function handleDelete(product) {
        const ok = await confirm({
            title: `Delete ${product.name}?`,
            message: 'This removes the product and its sales history. You can undo for a few seconds.',
            confirmLabel: 'Delete',
            danger: true,
        });
        if (!ok) return;

        let undone = false;
        setHidden((h) => new Set(h).add(product.id));
        const unhide = () => setHidden((h) => { const next = new Set(h); next.delete(product.id); return next; });

        toast(`${product.name} deleted.`, 'success', {
            duration: UNDO_MS,
            action: { label: 'Undo', onClick: () => { undone = true; unhide(); } },
        });

        setTimeout(async () => {
            if (undone) return;
            const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
            if (res.ok) {
                setProducts((list) => list.filter((p) => p.id !== product.id));
                unhide();
                return;
            }
            unhide();
            const body = await res.json().catch(() => ({}));
            toast(body.error || `Could not delete ${product.name}.`, 'error');
        }, UNDO_MS);
    }

    const handleScan = useCallback(async (code) => {
        setScanning(false);
        const res = await fetch(`/api/products/barcode/${encodeURIComponent(code)}`);
        if (res.ok) {
            const product = await res.json();
            router.push(`/products/${product.id}/edit`);
        } else if (res.status === 404) {
            const add = await confirm({
                title: 'Product not found',
                message: `No product has barcode ${code}. Add it as a new product?`,
                confirmLabel: 'Add product',
            });
            if (add) router.push(`/products/new?barcode=${encodeURIComponent(code)}`);
        } else {
            setError('Barcode lookup failed.');
        }
    }, [router, confirm]);

    const filtered = search || category || status || supplier || expiresBy;

    return (
        <main>
        <div className="page-header">
            <div>
                <h1>Inventory</h1>
                <p>Search, filter and update every product in the store.</p>
            </div>
            <div className="page-actions">
                <button className="secondary" onClick={() => setScanning(true)}><ScanIcon size={16} /> Scan</button>
                <Link className="button secondary" href="/products/import"><UploadIcon size={16} /> Import</Link>
                <Link className="button" href="/products/new"><PlusIcon size={16} /> Add product</Link>
            </div>
        </div>

        <div className="toolbar">
            <input className="search" aria-label="Search products" placeholder="Search products by name…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
            <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select aria-label="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            <option value="">All suppliers</option>
            {suppliers.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
            <input type="date" aria-label="Expires on or before" title="Expires on or before"
            value={expiresBy} onChange={(e) => setExpiresBy(e.target.value)} />
            {filtered && (
            <button className="secondary" onClick={() => {
                setSearch(''); setCategory(''); setStatus(''); setSupplier(''); setExpiresBy('');
            }}>Clear filters</button>
            )}
        </div>

        {scanning && <BarcodeScanner onDetected={handleScan} onClose={() => setScanning(false)} />}
        {error && <p className="error" role="alert">{error}</p>}

        <div className="table-wrap">
        <table>
            <thead>
            <tr>
                {COLUMNS.map(([key, label, align]) => (
                <th key={key} className={`sortable ${align ?? ''}`} onClick={() => toggleSort(key)}
                    aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                    {label} {sort.key === key ? (sort.dir === 1 ? '▲' : '▼') : ''}
                </th>
                ))}
                <th>Actions</th>
            </tr>
            </thead>
            <tbody>
            {sorted.map((p) => (
                <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td>{p.category || '—'}</td>
                <td className="num">
                    <span className="stepper">
                    <button type="button" aria-label={`Remove one ${p.name}`} disabled={p.quantity <= 0}
                        onClick={() => changeQuantity(p, -1)}>−</button>
                    <span className="value">{p.quantity}</span>
                    <button type="button" aria-label={`Add one ${p.name}`} onClick={() => changeQuantity(p, 1)}>+</button>
                    </span>
                </td>
                <td className="num">{p.minimum_quantity}</td>
                <td>{p.expiration_date || '—'}</td>
                <td><span className={`badge ${BADGE_CLASS[p.status]}`}>{p.status}</span></td>
                <td>
                    <div className="action-cell">
                    <Link href={`/products/${p.id}/edit`}>Edit</Link>
                    {isManager(role) && (
                        <button className="link-button danger" onClick={() => handleDelete(p)}>Delete</button>
                    )}
                    </div>
                </td>
                </tr>
            ))}
            {loaded && sorted.length === 0 && (
                <tr><td colSpan={COLUMNS.length + 1} className="empty">
                    {filtered ? 'No products match these filters.' : 'No products yet. Add your first one.'}
                </td></tr>
            )}
            </tbody>
        </table>
        </div>
        <p className="table-footer">Showing {sorted.length} products</p>
        </main>
    );
}
