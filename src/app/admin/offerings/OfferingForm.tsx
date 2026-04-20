'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type WeekDate = { date: string; label: string; dow: string };

const PRESETS: { label: string; start: string; end: string }[] = [
  { label: 'Early AM', start: '04:00', end: '08:00' },
  { label: 'Morning', start: '06:00', end: '10:00' },
  { label: 'Midday', start: '11:00', end: '14:00' },
  { label: 'Evening', start: '17:00', end: '22:00' },
  { label: 'Late night', start: '21:00', end: '02:00' },
];

export default function OfferingForm({ weekDates }: { weekDates: WeekDate[] }) {
  const router = useRouter();
  const [date, setDate] = useState(weekDates[0]?.date || '');
  const [start, setStart] = useState('04:00');
  const [end, setEnd] = useState('08:00');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await fetch('/api/admin/offerings', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date,
              start_time: start,
              end_time: end,
              label,
              notes,
            }),
          });
          let message = '';
          try {
            const data = (await res.json()) as { error?: string };
            message = data.error || '';
          } catch {
            message = res.statusText || `HTTP ${res.status}`;
          }
          if (!res.ok || message) {
            setError(message || `Could not post shift (HTTP ${res.status}).`);
            return;
          }
          setLabel('');
          setNotes('');
          router.refresh();
        });
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider mb-1">Day</label>
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((d) => (
            <button
              type="button"
              key={d.date}
              onClick={() => setDate(d.date)}
              className={`shift-cell text-center ${date === d.date ? 'selected' : ''}`}
            >
              <div className="text-xs font-mono">{d.dow}</div>
              <div className="text-xs">{d.label.split(' ')[1]}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-mono uppercase tracking-wider mb-1">Quick preset</label>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="shift-cell text-xs"
              onClick={() => {
                setStart(p.start);
                setEnd(p.end);
                if (!label) setLabel(p.label);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider mb-1">Start</label>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider mb-1">End</label>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-mono uppercase tracking-wider mb-1">Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Early AM — Partner A"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-mono uppercase tracking-wider mb-1">Notes (optional)</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && <div className="text-[var(--color-red)] text-sm">{error}</div>}
      <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
        {isPending ? 'Posting…' : 'Post shift'}
      </button>
    </form>
  );
}
