import { ArrowRight, AlertTriangle, CheckCircle2, ClipboardList, Users } from 'lucide-react';
import type { AppDatabase, LiveStatsResponse } from '../types';
import { StatusText } from './StatusText';

interface OverviewPageProps {
  db: AppDatabase;
  liveStats: LiveStatsResponse;
  onNavigate: (tab: string) => void;
}

export function OverviewPage({ db, liveStats, onNavigate }: OverviewPageProps) {
  const activeEvent = db.events.find((e) => e.id === db.activeEventId) || db.events[0];
  const s = liveStats.summary;
  const eventTasks = db.tasks.filter((t) => t.eventId === activeEvent?.id);
  const reassignmentRequests = db.volunteers.filter(
    (v) => v.eventId === activeEvent?.id && v.status === 'Reassignment Requested'
  );
  const recentAllocations = db.allocations
    .filter((a) => a.eventId === activeEvent?.id)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Active Event Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Active Event</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{activeEvent?.id}</span>
            <span aria-hidden="true">·</span>
            <StatusText status={activeEvent?.status || 'Live'} />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">
            {activeEvent?.name || 'No Event Selected'}
          </h2>
          <p className="text-sm text-slate-600">
            {activeEvent?.date} · {activeEvent?.venue} · {activeEvent?.organizer}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('live-control')}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
          >
            Open Live Control Center
          </button>
          <button
            type="button"
            onClick={() => onNavigate('smart-allocation')}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            Run Smart Allocation
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Registered Volunteers</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-slate-900 font-mono tabular-nums">
            {s.totalRegisteredVolunteers}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {s.currentlyWorking} working · {s.availableVolunteers + s.completedVolunteers} free
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Event Tasks</span>
            <ClipboardList className="w-4 h-4 text-blue-600" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-slate-900 font-mono tabular-nums">
            {eventTasks.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {s.fullyStaffedTasks} fully staffed · {s.tasksCompleted} completed
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Volunteers Still Needed</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-amber-700 font-mono tabular-nums">
            {s.totalVolunteersNeeded}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            Across {s.tasksRequiringVolunteers} understaffed tasks
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Reassignment Requests</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-slate-900 font-mono tabular-nums">
            {reassignmentRequests.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {reassignmentRequests.length > 0
              ? 'Pending organizer review'
              : 'All staffing requests resolved'}
          </p>
        </div>
      </div>

      {/* Two-Column Summary: Staffing Snapshot + Recent Allocations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Task Staffing Snapshot</h3>
              <p className="text-xs text-slate-500">
                Computed by C Linked List traversal on live volunteer status
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('live-control')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              <span>Full Monitor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {liveStats.taskStaffing.slice(0, 6).map((row) => {
              const pct =
                row.required > 0
                  ? Math.min(100, Math.round((row.assignedActive / row.required) * 100))
                  : 100;
              return (
                <div key={row.taskId} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {row.taskName}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-slate-600 shrink-0">
                        {row.assignedActive}/{row.required}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          row.needed > 0
                            ? 'bg-amber-500'
                            : row.excess > 0
                              ? 'bg-blue-600'
                              : 'bg-emerald-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-28 text-right shrink-0">
                    <StatusText status={row.staffingState} />
                  </div>
                </div>
              );
            })}
            {liveStats.taskStaffing.length === 0 && (
              <p className="py-8 text-sm text-slate-500 text-center">
                No tasks configured for this event yet.
              </p>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Recent Allocation History</h3>
              <p className="text-xs text-slate-500">
                Latest assignments verified by the C Allocation Linked List
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              <span>View Reports</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {recentAllocations.map((a) => (
              <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {a.volunteerName}{' '}
                    <span className="text-xs font-mono text-slate-400">({a.volunteerId})</span>
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {a.taskName} · Score {a.finalScore.toFixed(1)} · Compat{' '}
                    {a.compatibilityScore.toFixed(0)}%
                  </p>
                </div>
                <StatusText status={a.status} />
              </div>
            ))}
            {recentAllocations.length === 0 && (
              <p className="py-8 text-sm text-slate-500 text-center">
                No allocations recorded yet for this event.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
