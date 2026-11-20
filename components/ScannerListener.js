'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm, useToast } from '@/components/Feedback';
import { isScannerBurst, SCANNER_MAX_GAP_MS } from '@/lib/barcode';

// USB / Bluetooth barcode scanners act like a keyboard: they "type" the
// code very fast and press Enter. This listens on every page (except while
// you're typing in a field) and opens the scanned product, or offers to add
// it if it's new.

export default function ScannerListener() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const keys = useRef([]);
  const busy = useRef(false);

  useEffect(() => {
    async function lookup(code) {
      busy.current = true;
      const res = await fetch(`/api/products/barcode/${encodeURIComponent(code)}`);
      if (res.ok) {
        const product = await res.json();
        toast(`Scanned ${product.name}.`, 'info');
        router.push(`/products/${product.id}/edit`);
      } else if (res.status === 404) {
        const add = await confirm({
          title: 'New barcode',
          message: `No product has barcode ${code}. Add it as a new product?`,
          confirmLabel: 'Add product',
        });
        if (add) router.push(`/products/new?barcode=${encodeURIComponent(code)}`);
      } else {
        toast('Barcode lookup failed.', 'error');
      }
      busy.current = false;
    }

    function onKeyDown(e) {
      const target = e.target;
      // Typing in a field (e.g. the product form's barcode box): leave it alone.
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const now = performance.now();
      const last = keys.current[keys.current.length - 1];
      if (last && now - last.at > SCANNER_MAX_GAP_MS) keys.current = [];

      if (e.key === 'Enter') {
        const burst = keys.current;
        keys.current = [];
        if (!busy.current && isScannerBurst(burst)) {
          e.preventDefault();
          lookup(burst.map((k) => k.key).join(''));
        }
      } else if (e.key.length === 1 && /[0-9A-Za-z\-]/.test(e.key)) {
        keys.current.push({ key: e.key, at: now });
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router, toast, confirm]);

  return null;
}
