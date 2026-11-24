import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../api';
import type { AnalyticsResponse, AppDatabase } from '../types';
import { StatusText } from './StatusText';

interface WorkloadAnalyticsPageProps {
  db: AppDatabase;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export function WorkloadAnalyticsPage({ db, onNotify }: WorkloadAnalyticsPageProps) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.getAnalytics(db.activeEventId);
      setData(res);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.activeEventId, db.volunteers, db.tasks, db.allocations]);

  const summary = data?.summary;
  const maxTaskCap = Math.max(
    1,
    ...(data?.taskDistribution.map((t) => Math.max(t.required, t.assigned)) || [1])
  );
  const maxVolunteerHours = Math.max(
    12,
    ...(data?.volunteerWorkloads.map((v) =>
      Math.max(v.currentWorkload, v.beforeAllocationWorkload)
    ) || [12])
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Workload Analytics</h2>
          <p className="text-sm text-slate-600">
            Computed in C via Workload Balancing traversal: Underutilized (&lt;4h), Balanced (4–9h), Overloaded (≥10h).
          </p>
        </div>
        <button
          type="button"
          onClick={loadAnalytics}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh C Analytics</span>
        </button>
      </div>

      {/* Category KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Average Workload</div>
          <div className="mt-1.5 text-3xl font-semibold text-slate-900 font-mono tabular-nums">
            {summary ? summary.averageWorkload.toFixed(2) : '0.00'}h
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            Across {summary?.totalVolunteers ?? 0} volunteers
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Underutilized (&lt; 4 hrs)</div>
          <div className="mt-1.5 text-3xl font-semibold text-blue-700 font-mono tabular-nums">
            {summary?.underutilizedCount ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">Available for extra shifts</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Balanced (4 – 9 hrs)</div>
          <div className="mt-1.5 text-3xl font-semibold text-emerald-700 font-mono tabular-nums">
            {summary?.balancedCount ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">Optimal workload range</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Overloaded (≥ 10 hrs)</div>
          <div className="mt-1.5 text-3xl font-semibold text-red-700 font-mono tabular-nums">
            {summary?.overloadedCount ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">Needs load redistribution</div>
        </div>
      </div>

      {/* Task-Wise Distribution & Workload Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task-wise Volunteer Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900">
              Task-Wise Volunteer Distribution
            </h3>
            <p className="text-xs text-slate-500">
              Assigned active volunteers (blue) vs required capacity (slate)
            </p>
          </div>

          <div className="space-y-3.5">
            {data?.taskDistribution.map((t) => {
              const reqWidth = Math.round((t.required / maxTaskCap) * 100);
              const assWidth = Math.round((t.assigned / maxTaskCap) * 100);
              return (
                <div key={t.taskId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{t.taskName}</span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {t.assigned} / {t.required} ({t.durationHours}h)
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-400 rounded-full"
                        style={{ width: `${reqWidth}%` }}
                      />
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          t.assigned < t.required
                            ? 'bg-amber-500'
                            : t.assigned > t.required
                              ? 'bg-blue-600'
                              : 'bg-emerald-600'
                        }`}
                        style={{ width: `${assWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {data && data.taskDistribution.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-500">
                No tasks configured for this event yet.
              </p>
            )}
          </div>
        </div>

        {/* Workload Threshold Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900">
              Before vs. After Allocation Summary
            </h3>
            <p className="text-xs text-slate-500">
              Comparing prior volunteer hours against updated allocation hours
            </p>
          </div>

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {data?.volunteerWorkloads.map((v) => {
              const beforePct = Math.min(
                100,
                Math.round((v.beforeAllocationWorkload / maxVolunteerHours) * 100)
              );
              const afterPct = Math.min(
                100,
                Math.round((v.currentWorkload / maxVolunteerHours) * 100)
              );
              return (
                <div key={v.volunteerId} className="space-y-1 pb-2 border-b border-slate-50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-900">
                      {v.name}{' '}
                      <span className="font-mono text-slate-400">({v.volunteerId})</span>
                    </span>
                    <div className="flex items-center gap-3 font-mono tabular-nums">
                      <span className="text-slate-500">
                        {v.beforeAllocationWorkload.toFixed(1)}h → {v.currentWorkload.toFixed(1)}h
                      </span>
                      <StatusText status={v.category} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-400 rounded-full"
                        style={{ width: `${beforePct}%` }}
                      />
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          v.category === 'Overloaded'
                            ? 'bg-red-600'
                            : v.category === 'Balanced'
                              ? 'bg-emerald-600'
                              : 'bg-blue-600'
                        }`}
                        style={{ width: `${afterPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {data && data.volunteerWorkloads.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-500">
                No volunteers registered for this event yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Individual Volunteer Workload Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">
            Individual Volunteer Workload Breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Volunteer ID</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Current Status</th>
                <th className="py-3 px-4 text-right">Before Allocation</th>
                <th className="py-3 px-4 text-right">Current Workload</th>
                <th className="py-3 px-4 text-right">Delta</th>
                <th className="py-3 px-4">Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {data?.volunteerWorkloads.map((v) => {
                const delta = v.currentWorkload - v.beforeAllocationWorkload;
                return (
                  <tr key={v.volunteerId} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">
                      {v.volunteerId}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{v.name}</td>
                    <td className="py-3 px-4">
                      <StatusText status={v.status} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                      {v.beforeAllocationWorkload.toFixed(1)}h
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {v.currentWorkload.toFixed(1)}h
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-blue-700">
                      {delta >= 0 ? `+${delta.toFixed(1)}h` : `${delta.toFixed(1)}h`}
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={v.category} />
                    </td>
                  </tr>
                );
              })}
              {data && data.volunteerWorkloads.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                    No volunteer workload records exist for this event yet.
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
