'use client';

type ShiftExportRow = {
  date: string;
  start_time: string;
  end_time: string;
  label: string;
  status: string;
  decision_reason: string;
  claimed_at: string;
  decided_at: string;
};

type InspectionExportRow = {
  date: string;
  submitted_at: string;
  photo_count: number;
  labels: string;
};

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const lines = [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DriverDetailExport({
  driverSlug,
  shifts,
  inspections,
}: {
  driverSlug: string;
  shifts: ShiftExportRow[];
  inspections: InspectionExportRow[];
}) {
  const safeSlug = driverSlug.replace(/[^\w\-]+/g, '_').slice(0, 80) || 'driver';

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        className="btn btn-ghost text-sm"
        onClick={() =>
          downloadCsv(
            `${safeSlug}_shift_history.csv`,
            [
              'date',
              'start_time',
              'end_time',
              'shift_label',
              'status',
              'decision_reason',
              'claimed_at',
              'decided_at',
            ],
            shifts.map((s) => [
              s.date,
              s.start_time,
              s.end_time,
              s.label,
              s.status,
              s.decision_reason,
              s.claimed_at,
              s.decided_at,
            ]),
          )
        }
      >
        Export shift history (CSV)
      </button>
      <button
        type="button"
        className="btn btn-ghost text-sm"
        onClick={() =>
          downloadCsv(
            `${safeSlug}_inspections.csv`,
            ['date', 'submitted_at', 'photo_count', 'photo_labels'],
            inspections.map((i) => [
              i.date,
              i.submitted_at,
              String(i.photo_count),
              i.labels,
            ]),
          )
        }
      >
        Export inspections (CSV)
      </button>
    </div>
  );
}
