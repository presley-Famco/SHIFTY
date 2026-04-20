'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { submitInspectionAction } from '../actions';

const VIA_REDIRECT_URL = process.env.NEXT_PUBLIC_VIA_REDIRECT_URL;
type PhotoLabel = 'front' | 'back' | 'driver_side' | 'passenger_side' | 'selfie';
const PHOTO_LABELS: { key: PhotoLabel; title: string; hint: string }[] = [
  { key: 'front', title: 'Front of vehicle', hint: 'Full front, license plate visible' },
  { key: 'back', title: 'Back of vehicle', hint: 'Full rear, license plate visible' },
  { key: 'driver_side', title: 'Driver side', hint: 'Full side profile' },
  { key: 'passenger_side', title: 'Passenger side', hint: 'Full side profile' },
  { key: 'selfie', title: 'Selfie in uniform', hint: 'Clear view of uniform' },
];

/**
 * Compress image client-side before upload.
 * Rescales to max 1280px on longest side, re-encodes as JPEG ~0.8 quality.
 */
async function compressImage(blob: Blob): Promise<string> {
  const imgBitmap = await createImageBitmap(blob);
  const maxDim = 1280;
  const scale = Math.min(1, maxDim / Math.max(imgBitmap.width, imgBitmap.height));
  const w = Math.round(imgBitmap.width * scale);
  const h = Math.round(imgBitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imgBitmap, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.8);
}

export default function InspectionForm() {
  const [photos, setPhotos] = useState<Partial<Record<PhotoLabel, string>>>({});
  const [busy, setBusy] = useState<PhotoLabel | null>(null);
  const [activeLabel, setActiveLabel] = useState<PhotoLabel | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [handoffPending, setHandoffPending] = useState(false);
  const [isPending, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const allFilled = PHOTO_LABELS.every(({ key }) => photos[key]);

  function openViaApp() {
    if (!VIA_REDIRECT_URL) return;
    setHandoffPending(true);
    window.location.href = VIA_REDIRECT_URL;
    window.setTimeout(() => setHandoffPending(false), 2500);
  }

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraStream]);

  async function openCamera(label: PhotoLabel) {
    setError(null);
    setBusy(label);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera capture is not supported on this device/browser.');
        return;
      }
      cameraStream?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: label === 'selfie' ? 'user' : 'environment' },
        audio: false,
      });
      setCameraStream(stream);
      setActiveLabel(label);
    } catch (e) {
      setError('Could not open the camera. Please allow camera access and try again.');
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!activeLabel || !cameraStream || !videoRef.current) return;
    videoRef.current.srcObject = cameraStream;
  }, [activeLabel, cameraStream]);

  function closeCamera() {
    cameraStream?.getTracks().forEach((t) => t.stop());
    setCameraStream(null);
    setActiveLabel(null);
  }

  async function capturePhoto() {
    if (!activeLabel || !videoRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      setError('Camera is not ready yet. Try again in a moment.');
      return;
    }
    setBusy(activeLabel);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Could not capture photo. Try again.');
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
      });
      if (!blob) {
        setError('Could not capture photo. Try again.');
        return;
      }
      const dataUrl = await compressImage(blob);
      setPhotos((p) => ({ ...p, [activeLabel]: dataUrl }));
      closeCamera();
    } catch {
      setError('Could not process that photo. Try again.');
    } finally {
      setBusy(null);
    }
  }

  function handleSubmit() {
    if (!allFilled) {
      setError('All five photos are required.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await submitInspectionAction(photos as Record<PhotoLabel, string>);
      if (res.error) setError(res.error);
      else if (res.ok) {
        setSuccess(true);
        if (VIA_REDIRECT_URL) {
          openViaApp();
          return;
        }
        // Fallback for environments where no mobile handoff URL is configured.
        window.location.reload();
      }
    });
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {PHOTO_LABELS.map(({ key, title, hint }) => {
          const url = photos[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => openCamera(key)}
              className={`hairline rounded bg-white overflow-hidden cursor-pointer block transition ${
                url ? 'border-[var(--color-ink)]' : ''
              }`}
            >
              <div className="aspect-square bg-[var(--color-line)] relative">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[var(--color-muted)]">
                    {busy === key ? (
                      <span className="font-mono text-xs uppercase">Processing…</span>
                    ) : (
                      <span className="text-4xl font-display">+</span>
                    )}
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="font-mono text-xs uppercase tracking-wider">{title}</div>
                <div className="text-xs text-[var(--color-muted)] mt-1">{hint}</div>
              </div>
            </button>
          );
        })}
      </div>

      {activeLabel && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-md w-full p-4">
            <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">
              Camera capture
            </div>
            <div className="font-display text-2xl mb-3">
              {PHOTO_LABELS.find((x) => x.key === activeLabel)?.title}
            </div>
            <video ref={videoRef} autoPlay playsInline muted className="w-full rounded bg-black mb-4" />
            <div className="flex gap-3">
              <button type="button" className="btn btn-primary" onClick={capturePhoto} disabled={!!busy}>
                {busy ? 'Processing…' : 'Take photo'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={closeCamera}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="text-[var(--color-red)] text-sm mb-4">{error}</div>}
      {success && (
        <div className="hairline rounded bg-white p-4 mb-4">
          <div className="text-[var(--color-green)] text-sm mb-2">
            Inspection submitted successfully.
          </div>
          {VIA_REDIRECT_URL ? (
            <div className="flex items-center gap-3">
              <button type="button" className="btn btn-primary" onClick={openViaApp}>
                {handoffPending ? 'Opening Via app...' : 'Open Via app'}
              </button>
              <span className="text-xs text-[var(--color-muted)]">
                If the app did not open automatically, tap the button.
              </span>
            </div>
          ) : (
            <div className="text-xs text-[var(--color-muted)]">
              Via redirect URL is not configured.
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={handleSubmit}
          className="btn btn-primary"
          disabled={!allFilled || isPending}
        >
          {isPending ? 'Submitting…' : 'Submit inspection'}
        </button>
        <span className="text-sm text-[var(--color-muted)]">
          {PHOTO_LABELS.filter(({ key }) => photos[key]).length} / 5 photos
        </span>
      </div>
    </div>
  );
}
