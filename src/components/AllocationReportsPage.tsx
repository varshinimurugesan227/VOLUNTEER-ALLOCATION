import { Download, Printer } from 'lucide-react';
import type { AppDatabase, LiveStatsResponse } from '../types';
import { StatusText } from './StatusText';

interface AllocationReportsPageProps {
  db: AppDatabase;
  liveStats: LiveStatsResponse;
}

function csvEscape(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatTimestamp(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AllocationReportsPage({ db, liveStats }: AllocationReportsPageProps) {
  const activeEvent = db.events.find((e) => e.id === db.activeEventId) || db.events[0];
  const eventAllocations = db.allocations.filter((a) => a.eventId === activeEvent?.id);

  const completedCount = eventAllocations.filter((a) => a.status === 'Completed').length;
  const workingCount = eventAllocations.filter((a) => a.status === 'Working').length;
  const avgCompat =
    eventAllocations.length > 0
      ? eventAllocations.reduce((acc, a) => acc + a.compatibilityScore, 0) /
        eventAllocations.length
      : 0;

  const handleDownloadCsv = () => {
    const headers = [
      'Event Name',
      'Volunteer ID',
      'Volunteer Name',
      'Assigned Task',
      'Required Skills',
      'Matched Skills',
      'Compatibility Score (%)',
      'Previous Workload (hrs)',
      'Updated Workload (hrs)',
      'Check-in Time',
      'Completion Time',
      'Allocation Status',
    ];

    const rows = eventAllocations.map((a) => [
      a.eventName,
      a.volunteerId,
      a.volunteerName,
      a.taskName,
      a.requiredSkills,
      a.matchedSkills,
      a.compatibilityScore.toFixed(2),
      a.previousWorkload.toFixed(1),
      a.updatedWorkload.toFixed(1),
      a.checkInTime || 'Not checked in',
      a.completionTime || 'Pending',
      a.status,
    ]);

    const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(activeEvent?.name || 'event').replace(/\s+/g, '_').toLowerCase()}_allocation_report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Allocation Reports</h2>
          <p className="text-sm text-slate-600">
            Auditable allocation history, skill compatibility scores, workload transitions, and timestamps for{' '}
            <span className="font-medium text-slate-900">{activeEvent?.name}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 no-print">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Event Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Event Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
          <div>
            <div className="text-slate-500">Event Name</div>
            <div className="mt-1 font-semibold text-slate-900">{activeEvent?.name}</div>
          </div>
          <div>
            <div className="text-slate-500">Total Allocations</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 font-mono tabular-nums">
              {eventAllocations.length}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Avg. Skill Compatibility</div>
            <div className="mt-1 text-lg font-semibold text-blue-700 font-mono tabular-nums">
              {avgCompat.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-slate-500">Working / Completed</div>
            <div className="mt-1 text-lg font-semibold text-emerald-700 font-mono tabular-nums">
              {workingCount} / {completedCount}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Remaining Deficit</div>
            <div className="mt-1 text-lg font-semibold text-amber-700 font-mono tabular-nums">
              {liveStats.summary.totalVolunteersNeeded} volunteers
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Report Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-3">Event</th>
                <th className="py-3 px-3">Volunteer ID</th>
                <th className="py-3 px-3">Volunteer Name</th>
                <th className="py-3 px-3">Assigned Task</th>
                <th className="py-3 px-3">Required Skills</th>
                <th className="py-3 px-3">Matched Skills</th>
                <th className="py-3 px-3 text-right">Compat. Score</th>
                <th className="py-3 px-3 text-right">Prev. Load</th>
                <th className="py-3 px-3 text-right">Updated Load</th>
                <th className="py-3 px-3">Check-In</th>
                <th className="py-3 px-3">Completion</th>
                <th className="py-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {eventAllocations.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-3 text-slate-700 whitespace-nowrap">{a.eventName}</td>
                  <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                    {a.volunteerId}
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-900 whitespace-nowrap">
                    {a.volunteerName}
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-900 whitespace-nowrap">
                    {a.taskName}
                  </td>
                  <td className="py-3 px-3 text-slate-600 max-w-[160px]">{a.requiredSkills}</td>
                  <td className="py-3 px-3 text-blue-700 max-w-[160px]">{a.matchedSkills}</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {a.compatibilityScore.toFixed(1)}%
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                    {a.previousWorkload.toFixed(1)}h
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {a.updatedWorkload.toFixed(1)}h
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                    {formatTimestamp(a.checkInTime)}
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                    {formatTimestamp(a.completionTime)}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <StatusText status={a.status} />
                  </td>
                </tr>
              ))}
              {eventAllocations.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-sm text-slate-500">
                    No allocation records available for this event.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
