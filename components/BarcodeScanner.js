'use client';

import { useEffect, useId, useState } from 'react';

// Camera barcode scanner with a manual-entry fallback (SFDS 4.1.8).
// The camera only works on https:// or http://localhost.

export default function BarcodeScanner({ onDetected, onClose }) {
    const elementId = 'scanner-'+ useId().replace(/:/g, '');
    const [cameraError, setCameraError] = useState('');
    const [manual, setManual] = useState('');

    useEffect(() => {
        let scanner;
        let done = false;

        const started = import('html5-qrcode').then(({ Html5Qrcode }) => {
            scanner = new Html5Qrcode(elementId);
            return scanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 260, height: 140 } },
                (code) => {
                    if (done) return;
                    done = true;
                    onDetected(code);
                },
                () => {} // no barcode in this frame; keep scanning
            );
        }).catch(() => {
            setCameraError('Camera not available. Type the barcode below instead.');
        });

        return () => {
            done = true;
            started.then(() => scanner?.stop()).catch(() => {});
        };
    }, [elementId, onDetected]);

    function submitManual(e) {
        e.preventDefault();
        if (manual.trim()) onDetected(manual.trim())
    }

    return (
        <div className="card" style={{ marginBottom: 16 }}>
            <div id={elementId} style={{ maxWidth: 400 }} />
            {cameraError && <p className="notice">{cameraError}</p>}

            <form onSubmit={submitManual} className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
                <input aria-label="Barcode" placeholder="Or type a barcode"
                    value={manual} onChange={(e) => setManual(e.target.value)} />
                <button type="submit" disabled={!manual.trim()}>Look up</button>
                <button type="button" className="secondary" onClick={onClose}>Close</button>
            </form>
        </div>
    );
}