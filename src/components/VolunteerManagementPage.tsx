import { useState } from 'react';
import { Check, RefreshCw, Search, X } from 'lucide-react';
import { api } from '../api';
import type { AppDatabase, LiveStatsResponse, VolunteerStatus } from '../types';
import { StatusText } from './StatusText';

interface VolunteerManagementPageProps {
  db: AppDatabase;
  onStateChange: (db: AppDatabase, liveStats: LiveStatsResponse) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

const STATUS_TABS: Array<'All' | VolunteerStatus> = [
  'All',
  'Available',
  'Assigned',
  'Working',
  'Completed',
  'Reassignment Requested',
  'Unavailable',
];

export function VolunteerManagementPage({
  db,
  onStateChange,
  onNotify,
}: VolunteerManagementPageProps) {
  const [statusTab, setStatusTab] = useState<'All' | VolunteerStatus>('All');
  const [search, setSearch] = useState('');
  const [reassignTargets, setReassignTargets] = useState<Record<string, string>>({});

  const activeTasks = db.tasks.filter(
    (t) => t.eventId === db.activeEventId && t.status !== 'Completed'
  );
  const taskMap = new Map(db.tasks.map((t) => [t.id, t]));

  const reassignmentQueue = db.volunteers.filter(
    (v) => v.status === 'Reassignment Requested'
  );

  const handleAction = async (
    volId: string,
    action:
      | 'check_in'
      | 'complete_task'
      | 'make_available'
      | 'approve_reassignment'
      | 'reject_reassignment'
      | 'report_unavailable',
    targetTaskId?: string
  ) => {
    try {
      const res = await api.volunteerStatusAction(volId, action, { targetTaskId });
      onStateChange(res.db, res.liveStats);
      onNotify(`Updated status for ${volId}.`);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const filtered = db.volunteers.filter((v) => {
    const matchTab = statusTab === 'All' || v.status === statusTab;
    const q = search.trim().toLowerCase();
    if (!q) return matchTab;
    return (
      matchTab &&
      (v.id.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q) ||
        v.skills.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Volunteer Status & Reassignment Management
        </h2>
        <p className="text-sm text-slate-600">
          Monitor active volunteer statuses, approve or reject reassignment requests, and manage live workforce readiness.
        </p>
      </div>

      {/* Reassignment Requests Section */}
      {reassignmentQueue.length > 0 && (
        <div className="bg-white border border-amber-300 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-amber-600" />
            <h3 className="text-base font-semibold text-slate-900">
              Pending Reassignment Requests ({reassignmentQueue.length})
            </h3>
          </div>

          <div className="divide-y divide-slate-100">
            {reassignmentQueue.map((v) => {
              const currentTask = taskMap.get(v.assignedTaskId);
              const selectedTarget = reassignTargets[v.id] || '';
              return (
                <div
                  key={v.id}
                  className="py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-slate-900">
                      {v.name}{' '}
                      <span className="text-xs font-mono text-slate-500">({v.id})</span> ·
                      Currently on{' '}
                      <span className="font-semibold">
                        {currentTask ? currentTask.name : v.assignedTaskId}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Reason: {v.reassignmentReason || 'Volunteer requested reassignment'}
                    </p>
                    <p className="text-xs text-slate-500">Skills: {v.skills}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <select
                      aria-label={`Target task for ${v.name}`}
                      value={selectedTarget}
                      onChange={(e) =>
                        setReassignTargets((prev) => ({ ...prev, [v.id]: e.target.value }))
                      }
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
                    >
                      <option value="">Release to Available Pool</option>
                      {activeTasks
                        .filter((t) => t.id !== v.assignedTaskId)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            Reassign to: {t.name}
                          </option>
                        ))}
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        handleAction(v.id, 'approve_reassignment', selectedTarget || undefined)
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAction(v.id, 'reject_reassignment')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Volunteer Status Directory */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search volunteers by ID, name, or skill..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Showing {filtered.length} of {db.volunteers.length} volunteers
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusTab === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Name & Skills</th>
                <th className="py-3 px-4">Assigned Task</th>
                <th className="py-3 px-4 text-right">Workload</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Status Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((v) => {
                const task = taskMap.get(v.assignedTaskId);
                return (
                  <tr key={v.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {v.id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{v.name}</div>
                      <div className="text-xs text-slate-500">{v.skills}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      {task ? (
                        <div>
                          <div className="font-medium text-slate-900">{task.name}</div>
                          <div className="text-slate-500">{task.location}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {v.currentWorkload.toFixed(1)}h
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={v.status} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {v.status === 'Assigned' && (
                          <button
                            type="button"
                            onClick={() => handleAction(v.id, 'check_in')}
                            className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                          >
                            Check In
                          </button>
                        )}
                        {(v.status === 'Working' || v.status === 'Assigned') && (
                          <button
                            type="button"
                            onClick={() => handleAction(v.id, 'complete_task')}
                            className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md"
                          >
                            Complete Task
                          </button>
                        )}
                        {(v.status === 'Completed' || v.status === 'Unavailable') && (
                          <button
                            type="button"
                            onClick={() => handleAction(v.id, 'make_available')}
                            className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md"
                          >
                            Mark Available
                          </button>
                        )}
                        {v.status !== 'Unavailable' && (
                          <button
                            type="button"
                            onClick={() => handleAction(v.id, 'report_unavailable')}
                            className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md"
                          >
                            Set Unavailable
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                    No volunteers match this filter.
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
