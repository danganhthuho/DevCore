'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useConfirm, useToast } from '@/components/Feedback';
import { PlusIcon, ScanIcon } from '@/components/Icons';
import { CATEGORIES } from '@/lib/products/constants';
import { STATUSES } from '@/lib/inventory/status';

const COLUMNS = [
    ['name', 'Name'],
    ['category', 'Category'],
    ['quantity', 'Qty', 'num'],
    ['minimum_quantity', 'Min', 'num'],
    ['expiration_date', 'Expires'],
    ['status', 'Status'],
];

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
    const [sort, setSort] = useState({ key: 'name', dir: 1 });
    const [role, setRole] = useState('Staff');
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState('');

    // The dashboard links here with ?status=… or ?scan=1
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (STATUSES.includes(params.get('status'))) setStatus(params.get('status'));
        if (params.get('scan')) setScanning(true);
        fetch('/api/auth/me').then((r) => r.ok && r.json()).then((me) => me && setRole(me.role));
    }, []);

    const load = useCallback(async () => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (category) params.set('category', category);
        if (status) params.set('status', status);

        const res = await fetch('/api/products?' + params);
        if (res.status === 401) return router.push('/login');
        if (!res.ok) return setError('Could not load products.');
        setError('');
        setProducts(await res.json());
        setLoaded(true);
    }, [search, category, status, router]);

    // Wait until the user stops typing for 300 ms before searching
    useEffect(() => {
        const timer = setTimeout(load, 300);
        return () => clearTimeout(timer);
    }, [load]);

    const sorted = useMemo(() => {
        return [...products].sort((a, b) => {
            const x = a[sort.key] ?? '';
            const y = b[sort.key] ?? '';
            return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
        });
    }, [products, sort]);

    function toggleSort(key) {
        setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));
    }

    async function handleDelete(product) {
        const ok = await confirm({
            title: `Delete ${product.name}?`,
            message: 'This removes the product and its sales history. It cannot be undone.',
            confirmLabel: 'Delete',
            danger: true,
        });
        if (!ok) return;

        const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
        if (res.ok) {
            toast(`${product.name} deleted.`);
            return load();
        }
        const body = await res.json().catch(() => ({}));
        toast(body.error || 'Delete failed.', 'error');
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

    const filtered = search || category || status;

    return (
        <main>
        <div className="page-header">
            <div>
                <h1>Inventory</h1>
                <p>Search, filter and update every product in the store.</p>
            </div>
            <div className="page-actions">
                <button className="secondary" onClick={() => setScanning(true)}><ScanIcon size={16} /> Scan</button>
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
                <td className="num">{p.quantity}</td>
                <td className="num">{p.minimum_quantity}</td>
                <td>{p.expiration_date || '—'}</td>
                <td><span className={`badge ${BADGE_CLASS[p.status]}`}>{p.status}</span></td>
                <td>
                    <div className="action-cell">
                    <Link href={`/products/${p.id}/edit`}>Edit</Link>
                    {role === 'Manager' && (
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
