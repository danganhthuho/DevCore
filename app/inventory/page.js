'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import BarcodeScanner from '@/components/BarcodeScanner';
import { CATEGORIES } from '@/lib/products/constants';
import { STATUSES } from '@/lib/inventory/status';

const COLUMNS = [
    ['name', 'Name'],
    ['category', 'Category'],
    ['quantity', 'Qty'],
    ['minimum_quantity', 'Min'],
    ['expiration_date', 'Expires'],
    ['status', 'Status'],
];

const BADGE_CLASS = { 'In stock': 'in-stock', 'Low stock': 'low-stock', Expired: 'expired' };

export default function InventoryPage() {
    const router = useRouter();
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [status, setStatus] = useState('');
    const [sort, setSort] = useState({ key: 'name', dir: 1 });
    const [role, setRole] = useState('Staff');
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
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
        setSort((s) => ({ key, dir: s.key === key ? -s.dir: 1 }));
    }

    async function handleDelete(product) {
        if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

        const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
        if (res.ok) return load();
        const body = await res.json().catch(() => ({}));
        alert(body.error || 'Delete failed.');
    }

    const handleScane = useCallback(async (code) => {
        setScanning(false);
        const res = await fetch(`/api/products/barcode/${encodeURIComponent(code)}`);
        if (res.ok) {
            const product = await res.json();
            router.push(`/products/${product.id}/edit`);
        } else if (res.status === 404) {
            if (confirm(`No product has barcode ${code}. Add a new product?`)) {
                router.push(`/products/new?barcode=${encodeURIComponent(code)}`);
            }
        } else {
            setError('Barcode lookup failed.');
        }
    }, [router]);

    return (
        <main>
        <h1>Inventory</h1>

        <div className="toolbar">
            <input aria-label="Search products" placeholder="Search products…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
            <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Category: All</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Status: All</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <button className="secondary" onClick={() => setScanning(true)}>Scan</button>
            <Link className="button" href="/products/new">+ Add Product</Link>
        </div>

        {scanning && <BarcodeScanner onDetected={handleScan} onClose={() => setScanning(false)} />}
        {error && <p className="error" role="alert">{error}</p>}

        <table>
            <thead>
            <tr>
                {COLUMNS.map(([key, label]) => (
                <th key={key} className="sortable" onClick={() => toggleSort(key)}>
                    {label} {sort.key === key ? (sort.dir === 1 ? '▲' : '▼') : ''}
                </th>
                ))}
                <th>Actions</th>
            </tr>
            </thead>
            <tbody>
            {sorted.map((p) => (
                <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.category || '—'}</td>
                <td>{p.quantity}</td>
                <td>{p.minimum_quantity}</td>
                <td>{p.expiration_date || '—'}</td>
                <td><span className={`badge ${BADGE_CLASS[p.status]}`}>{p.status}</span></td>
                <td>
                    <Link href={`/products/${p.id}/edit`}>Edit</Link>
                    {role === 'Manager' && (
                    <> | <button className="link-button" onClick={() => handleDelete(p)}>Delete</button></>
                    )}
                </td>
                </tr>
            ))}
            </tbody>
        </table>
        <p>Showing {sorted.length} products</p>
        </main>
    );
}