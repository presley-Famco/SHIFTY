'use client';

import { useEffect, useMemo, useState } from 'react';

function formatDuration(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

type Props = {
  shiftLabel: string;
  windowOpensInSeconds: number;
};

export default function InspectionCountdown({ shiftLabel, windowOpensInSeconds }: Props) {
  const [remaining, setRemaining] = useState(windowOpensInSeconds);

  useEffect(() => {
    setRemaining(windowOpensInSeconds);
  }, [windowOpensInSeconds]);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = window.setInterval(() => {
      setRemaining((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [remaining]);

  const countdown = useMemo(() => formatDuration(remaining), [remaining]);

  if (remaining <= 0) {
    return (
      <div className="hairline rounded bg-white p-6 mb-6">
        <div className="pill pill-approved mb-3 inline-flex">Inspection window open</div>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          Your approved shift ({shiftLabel}) is now within the submission window.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="hairline rounded bg-white p-6 mb-6">
      <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">
        Upcoming approved shift
      </div>
      <div className="font-display text-2xl mb-2">{shiftLabel}</div>
      <p className="text-sm mb-2">
        Inspection window opens 30 minutes before your shift. Time remaining:
      </p>
      <div className="font-mono text-3xl">{countdown}</div>
    </div>
  );
}
