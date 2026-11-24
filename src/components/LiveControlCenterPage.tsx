import { AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import type { LiveStatsResponse } from '../types';
import { StatusText } from './StatusText';

interface LiveControlCenterPageProps {
  liveStats: LiveStatsResponse;
  onRefresh: () => void;
  onSelectTaskForAllocation: (taskId: string) => void;
}

export function LiveControlCenterPage({
  liveStats,
  onRefresh,
  onSelectTaskForAllocation,
}: LiveControlCenterPageProps) {
  const s = liveStats.summary;
  const understaffedList = liveStats.taskStaffing.filter((t) => t.needed > 0);
  const overstaffedList = liveStats.taskStaffing.filter((t) => t.excess > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Live Event Control Center
          </h2>
          <p className="text-sm text-slate-600">
            Real-time staffing telemetry computed by the C Linked List Engine for{' '}
            <span className="font-medium text-slate-900">{liveStats.eventName}</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Recalculate from C Engine</span>
        </button>
      </div>

      {/* 7 Required Live Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Registered Volunteers</div>
          <div className="mt-1.5 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
            {s.totalRegisteredVolunteers}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Currently Working</div>
          <div className="mt-1.5 text-2xl font-semibold text-blue-700 font-mono tabular-nums">
            {s.currentlyWorking}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Available Volunteers</div>
          <div className="mt-1.5 text-2xl font-semibold text-emerald-700 font-mono tabular-nums">
            {s.availableVolunteers + s.completedVolunteers}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Tasks Completed</div>
          <div className="mt-1.5 text-2xl font-semibold text-emerald-700 font-mono tabular-nums">
            {s.tasksCompleted}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Tasks In Progress</div>
          <div className="mt-1.5 text-2xl font-semibold text-blue-700 font-mono tabular-nums">
            {s.tasksInProgress}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Tasks Needing Staff</div>
          <div className="mt-1.5 text-2xl font-semibold text-amber-700 font-mono tabular-nums">
            {s.tasksRequiringVolunteers}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Total Staff Needed</div>
          <div className="mt-1.5 text-2xl font-semibold text-red-700 font-mono tabular-nums">
            {s.totalVolunteersNeeded}
          </div>
        </div>
      </div>

      {/* Warning Banner when tasks require additional volunteers */}
      {understaffedList.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-950">
                Staffing Shortage Alert: {s.totalVolunteersNeeded} additional volunteers needed
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Tasks requiring immediate allocation:{' '}
                {understaffedList.map((t) => `${t.taskName} (+${t.needed})`).join(', ')}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectTaskForAllocation(understaffedList[0].taskId)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap shrink-0"
          >
            <span>Assign Next Shortage</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Staffing Classification Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">Fully Staffed Tasks</span>
          <span className="text-sm font-semibold text-emerald-700 font-mono tabular-nums">
            {s.fullyStaffedTasks}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">Understaffed Tasks</span>
          <span className="text-sm font-semibold text-amber-700 font-mono tabular-nums">
            {s.understaffedTasks}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">Overstaffed Tasks</span>
          <span className="text-sm font-semibold text-blue-700 font-mono tabular-nums">
            {s.overstaffedTasks}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">Unassigned Tasks</span>
          <span className="text-sm font-semibold text-red-700 font-mono tabular-nums">
            {s.unassignedTasks}
          </span>
        </div>
      </div>

      {/* Live Task Staffing Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Live Task Staffing Matrix</h3>
            <p className="text-xs text-slate-500">
              Additional Volunteers Needed = Required Volunteers − Currently Assigned Active Volunteers
            </p>
          </div>
          {overstaffedList.length > 0 && (
            <span className="text-xs text-blue-700 font-medium">
              {overstaffedList.length} task(s) have excess volunteers
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Task</th>
                <th className="py-3 px-4">Location & Priority</th>
                <th className="py-3 px-4 text-right">Required</th>
                <th className="py-3 px-4 text-right">Working</th>
                <th className="py-3 px-4 text-right">Assigned Active</th>
                <th className="py-3 px-4 text-right">Additional Needed</th>
                <th className="py-3 px-4 w-44">Coverage</th>
                <th className="py-3 px-4">Staffing State</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {liveStats.taskStaffing.map((row) => {
                const pct =
                  row.required > 0
                    ? Math.min(100, Math.round((row.assignedActive / row.required) * 100))
                    : 100;

                return (
                  <tr key={row.taskId} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{row.taskName}</div>
                      <div className="text-xs font-mono text-slate-400">{row.taskId}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      <div>{row.location}</div>
                      <div className="mt-0.5">
                        <StatusText status={row.priority} />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {row.required}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-blue-700">
                      {row.working}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      {row.assignedActive}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {row.needed > 0 ? (
                        <span className="text-red-700">{row.needed}</span>
                      ) : row.excess > 0 ? (
                        <span className="text-blue-700">+{row.excess} excess</span>
                      ) : (
                        <span className="text-emerald-700">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              row.staffingState === 'Completed' ||
                              row.staffingState === 'Fully Staffed'
                                ? 'bg-emerald-600'
                                : row.staffingState === 'Unassigned'
                                  ? 'bg-red-600'
                                  : row.staffingState === 'Overstaffed'
                                    ? 'bg-blue-600'
                                    : 'bg-amber-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono tabular-nums text-slate-600 w-9 text-right">
                          {pct}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={row.staffingState} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {row.needed > 0 ? (
                        <button
                          type="button"
                          onClick={() => onSelectTaskForAllocation(row.taskId)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                        >
                          Find Volunteers
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectTaskForAllocation(row.taskId)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          Inspect
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {liveStats.taskStaffing.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-slate-500">
                    No tasks found for this event.
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
