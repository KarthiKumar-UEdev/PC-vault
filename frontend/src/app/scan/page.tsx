'use client';

import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/card';

/** Pull the QR token out of a scanned URL like {FRONTEND}/pc/qr?t=TOKEN
 *  (also accepts a bare token for hand-typed codes). */
function extractToken(decoded: string): string | null {
  try {
    const url = new URL(decoded);
    const t = url.searchParams.get('t');
    if (t) return t;
    // legacy path style /pc/qr/TOKEN
    const match = url.pathname.match(/\/pc\/qr\/([^/]+)/);
    if (match) return match[1];
    return null;
  } catch {
    // not a URL — treat as raw token
    return /^[0-9a-f-]{36}$/i.test(decoded.trim()) ? decoded.trim() : null;
  }
}

export default function ScanPage() {
  const router = useRouter();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [state, setState] = useState<'idle' | 'scanning' | 'error' | 'found'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const stop = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch {
        /* already stopped */
      }
    }
  };

  const start = async () => {
    setMessage(null);
    setState('scanning');
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          const token = extractToken(decoded);
          if (token) {
            setState('found');
            void stop();
            router.push(`/pc/qr?t=${encodeURIComponent(token)}`);
          } else {
            setMessage('QR recognized, but it is not a PC Vault code.');
          }
        },
        () => {
          /* per-frame decode misses are normal */
        },
      );
    } catch (err) {
      setState('error');
      setMessage(
        err instanceof Error
          ? err.message
          : 'Camera unavailable. Grant permission and use HTTPS (or localhost).',
      );
    }
  };

  useEffect(() => {
    return () => {
      void stop();
    };
  }, []);

  return (
    <div className="mx-auto max-w-md">
      <header className="mb-6 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-100">
          QR <span className="neon-text">Scanner</span>
        </h1>
        <p className="mt-1 font-mono text-xs text-slate-500">
          // point at a PC Vault label to open its dossier
        </p>
      </header>

      <GlassCard className="overflow-hidden p-3">
        <div className="relative">
          <div id="qr-reader" className="min-h-64 overflow-hidden rounded-xl bg-panel-2" />
          {state !== 'scanning' && (
            <div className="absolute inset-0 grid place-items-center rounded-xl bg-panel-2/95">
              {state === 'error' ? (
                <div className="p-6 text-center">
                  <CameraOff size={32} className="mx-auto text-neon-red" />
                  <p className="mt-3 text-sm text-neon-red">{message}</p>
                  <p className="mt-2 font-mono text-[10px] text-slate-500">
                    camera requires HTTPS on mobile devices
                  </p>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <Camera size={32} className="mx-auto text-neon-cyan" />
                  <p className="mt-3 text-sm text-slate-400">
                    {state === 'found' ? 'Code locked. Redirecting…' : 'Camera is off.'}
                  </p>
                </div>
              )}
            </div>
          )}
          {/* scan frame corners */}
          {state === 'scanning' && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="relative h-56 w-56">
                {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2',
                  'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'].map((pos) => (
                  <span key={pos} className={`absolute h-8 w-8 border-neon-cyan ${pos}`} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-center gap-3">
          {state === 'scanning' ? (
            <Button variant="danger" onClick={() => { void stop(); setState('idle'); }}>
              <CameraOff size={15} /> Stop
            </Button>
          ) : (
            <Button variant="solid" onClick={() => void start()}>
              <Camera size={15} /> Start scanning
            </Button>
          )}
        </div>
        {message && state === 'scanning' && (
          <p className="mt-3 text-center text-xs text-neon-amber">{message}</p>
        )}
      </GlassCard>
    </div>
  );
}
