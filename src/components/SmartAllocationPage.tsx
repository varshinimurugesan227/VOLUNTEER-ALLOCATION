import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Cpu, Layers, RefreshCw, Sparkles } from 'lucide-react';
import { api } from '../api';
import type {
  AppDatabase,
  LiveStatsResponse,
  OptimizeResponse,
  RecommendResponse,
} from '../types';
import { StatusText } from './StatusText';

interface SmartAllocationPageProps {
  db: AppDatabase;
  liveStats: LiveStatsResponse;
  initialTaskId?: string;
  onStateChange: (db: AppDatabase, liveStats: LiveStatsResponse) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export function SmartAllocationPage({
  db,
  liveStats,
  initialTaskId,
  onStateChange,
  onNotify,
}: SmartAllocationPageProps) {
  const eventTasks = db.tasks.filter(
    (t) => t.eventId === db.activeEventId && t.status !== 'Completed'
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    initialTaskId || eventTasks[0]?.id || ''
  );
  const [mode, setMode] = useState<'matching' | 'optimizer'>('matching');

  const [recData, setRecData] = useState<RecommendResponse | null>(null);
  const [optData, setOptData] = useState<OptimizeResponse | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [loadingOpt, setLoadingOpt] = useState(false);
  const [allocatingId, setAllocatingId] = useState<string | null>(null);

  useEffect(() => {
    if (initialTaskId) {
      setSelectedTaskId(initialTaskId);
      setMode('matching');
    }
  }, [initialTaskId]);

  useEffect(() => {
    if (!eventTasks.some((t) => t.id === selectedTaskId)) {
      setSelectedTaskId(eventTasks[0]?.id || '');
      setRecData(null);
    }
  }, [db.activeEventId, eventTasks, selectedTaskId]);

  const fetchRecommendations = async (taskId: string) => {
    if (!taskId) return;
    setLoadingRec(true);
    try {
      const res = await api.recommendForTask(taskId, db.activeEventId);
      setRecData(res);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setLoadingRec(false);
    }
  };

  const fetchOptimization = async () => {
    setLoadingOpt(true);
    try {
      const res = await api.optimizeWorkforce(db.activeEventId);
      setOptData(res);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setLoadingOpt(false);
    }
  };

  useEffect(() => {
    if (mode === 'matching' && selectedTaskId) {
      fetchRecommendations(selectedTaskId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskId, mode, db.volunteers, db.allocations]);

  useEffect(() => {
    if (mode === 'optimizer') {
      fetchOptimization();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, db.volunteers, db.tasks, db.allocations]);

  const handleApproveAllocation = async (volunteerId: string, taskId: string) => {
    setAllocatingId(`${volunteerId}:${taskId}`);
    try {
      const res = await api.allocateVolunteer(volunteerId, taskId);
      onStateChange(res.db, res.liveStats);
      onNotify(`Approved allocation: ${volunteerId} assigned to ${taskId}.`);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setAllocatingId(null);
    }
  };

  const selectedTask = eventTasks.find((t) => t.id === selectedTaskId);
  const selectedStaff = liveStats.taskStaffing.find((s) => s.taskId === selectedTaskId);
  const assignedToSelectedTask = db.volunteers.filter(
    (v) => v.eventId === db.activeEventId && v.assignedTaskId === selectedTaskId
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Smart Allocation & Workload Optimization
          </h2>
          <p className="text-sm text-slate-600">
            Executed directly by the compiled C binary (<span className="font-mono text-xs">volunteer_engine</span>) using Linked Lists, FIFO Queue, Weighted Scoring, and Bubble Sort.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit shrink-0">
          <button
            type="button"
            onClick={() => setMode('matching')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              mode === 'matching'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Module 1: Skill-Based Matching
          </button>
          <button
            type="button"
            onClick={() => setMode('optimizer')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              mode === 'optimizer'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Module 2: Real-Time Redistribution
          </button>
        </div>
      </div>

      {/* MODULE 1: SKILL-BASED VOLUNTEER MATCHING */}
      {mode === 'matching' && (
        <div className="space-y-6">
          {/* Task Selector + Scoring Formula Reference */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Event Task to Staff
                </label>
                <select
                  value={selectedTaskId}
                  disabled={eventTasks.length === 0}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 disabled:bg-slate-100"
                >
                  {eventTasks.length === 0 ? (
                    <option value="">No tasks available in this event</option>
                  ) : (
                    eventTasks.map((t) => {
                      const st = liveStats.taskStaffing.find((x) => x.taskId === t.id);
                      const needLabel =
                        st && st.needed > 0 ? ` — Needs ${st.needed}` : ' — Staffed';
                      return (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.id}){needLabel}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>

              {selectedTask && selectedStaff && (
                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Required Skills</span>
                    <span className="font-medium text-slate-900 text-right max-w-[60%]">
                      {selectedTask.requiredSkills}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Headcount</span>
                    <span className="font-mono tabular-nums text-slate-900">
                      {selectedStaff.assignedActive} / {selectedStaff.required} assigned
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duration & Location</span>
                    <span className="font-mono tabular-nums text-slate-900">
                      {selectedTask.durationHours}h · {selectedTask.location}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Status</span>
                    <StatusText status={selectedStaff.staffingState} />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-700 mb-1">
                  C Weighted Scoring Formula
                </div>
                <div className="text-xs font-mono text-slate-600 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                  <div>Compatibility = (Matched / Required) × 100</div>
                  <div>Load Pref = 100 / (1 + Current Workload)</div>
                  <div className="text-blue-700 font-semibold">
                    Final = (0.7 × Compat) + (0.3 × Load Pref)
                  </div>
                </div>
              </div>
            </div>

            {/* Top 3 Candidates from C Engine */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Top 3 Recommended Volunteers
                    </h3>
                    <p className="text-xs text-slate-500">
                      Ranked in C via Skill Matching, Weighted Scoring & Bubble Sort
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fetchRecommendations(selectedTaskId)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRec ? 'animate-spin' : ''}`} />
                  <span>Re-run C Match</span>
                </button>
              </div>

              {loadingRec && (
                <div className="py-10 text-center text-sm text-slate-500">
                  Executing C matching engine...
                </div>
              )}

              {!selectedTaskId && (
                <div className="py-8 px-4 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    No tasks configured for this event yet
                  </p>
                  <p className="text-xs text-slate-600">
                    Add tasks in Task Management and register volunteers for this event to run C Skill-Based Matching.
                  </p>
                </div>
              )}

              {!loadingRec && selectedTaskId && recData && recData.candidates.length === 0 && (
                <div className="py-8 px-4 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    No matching available volunteers found
                  </p>
                  <p className="text-xs text-slate-600">
                    The C Skill Matching Algorithm excluded volunteers who are unavailable, already assigned, or lack any required skill ({selectedTask?.requiredSkills}).
                  </p>
                </div>
              )}

              {!loadingRec && recData && recData.candidates.length > 0 && (
                <div className="space-y-3">
                  {recData.candidates.map((cand) => {
                    const busy = allocatingId === `${cand.volunteerId}:${recData.taskId}`;
                    return (
                      <div
                        key={cand.volunteerId}
                        className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-blue-300 transition-colors"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono font-semibold text-blue-700">
                              Rank #{cand.rank}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{cand.volunteerId}</span>
                            {cand.preferredMatch && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-emerald-700 font-medium">
                                  Preferred Task Match
                                </span>
                              </>
                            )}
                          </div>

                          <div className="text-base font-semibold text-slate-900">
                            {cand.volunteerName}
                          </div>

                          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono tabular-nums text-slate-700">
                            <span>
                              Final Score:{' '}
                              <strong className="text-blue-700">
                                {cand.finalScore.toFixed(2)}
                              </strong>
                            </span>
                            <span>Compatibility: {cand.compatibilityScore.toFixed(1)}%</span>
                            <span>Load Pref: {cand.loadPreference.toFixed(1)}</span>
                            <span>Current Load: {cand.currentWorkload.toFixed(1)}h</span>
                          </div>

                          <p className="text-xs text-slate-600 pt-1">{cand.explanation}</p>
                        </div>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            handleApproveAllocation(cand.volunteerId, recData.taskId)
                          }
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{busy ? 'Allocating...' : 'Approve Allocation'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Currently Assigned Volunteers on Selected Task */}
              {assignedToSelectedTask.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-semibold text-slate-600 mb-2">
                    Currently Assigned to {selectedTask?.name} ({assignedToSelectedTask.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {assignedToSelectedTask.map((v) => (
                      <div
                        key={v.id}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-medium text-slate-900">{v.name}</span>{' '}
                          <span className="font-mono text-slate-400">({v.id})</span>
                        </div>
                        <StatusText status={v.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODULE 2: WORKLOAD OPTIMIZATION & REAL-TIME TASK DISTRIBUTION */}
      {mode === 'optimizer' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <Layers className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  FIFO Task Queue & Real-Time Redistribution Engine
                </h3>
                <p className="text-xs text-slate-600">
                  The C program enqueues all understaffed tasks into a FIFO Linked Queue, dequeues each shortage, and recommends top available volunteers without interrupting ongoing workers.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={fetchOptimization}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOpt ? 'animate-spin' : ''}`} />
              <span>Run C Optimizer</span>
            </button>
          </div>

          {loadingOpt && (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              Running C FIFO Queue & Workload Balancing Algorithm...
            </div>
          )}

          {!loadingOpt && optData && (
            <div className="space-y-6">
              {/* Understaffed Tasks Processed via FIFO Queue */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900">
                  Understaffed Tasks in FIFO Queue ({optData.understaffedRecommendations.length})
                </h4>

                {optData.understaffedRecommendations.length === 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-emerald-700 font-medium">
                    All active tasks are currently staffed at or above required capacity.
                  </div>
                )}

                {optData.understaffedRecommendations.map((item, idx) => (
                  <div
                    key={item.taskId}
                    className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono font-semibold text-blue-700">
                            Queue Position #{idx + 1}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{item.taskId}</span>
                          <span aria-hidden="true">·</span>
                          <StatusText status={item.priority} />
                        </div>
                        <h5 className="text-base font-semibold text-slate-900 mt-0.5">
                          {item.taskName}
                        </h5>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                        <span className="text-slate-600">
                          Required: <strong>{item.required}</strong>
                        </span>
                        <span className="text-blue-700">
                          Working: <strong>{item.currentlyWorking}</strong>
                        </span>
                        <span className="text-red-700 font-semibold">
                          Needed: {item.needed}
                        </span>
                      </div>
                    </div>

                    {item.recommendedVolunteers.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {item.recommendedVolunteers.map((rv) => {
                          const busy = allocatingId === `${rv.volunteerId}:${item.taskId}`;
                          return (
                            <div
                              key={rv.volunteerId}
                              className="border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between gap-3 bg-slate-50/50"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-mono">
                                  <span className="text-blue-700 font-semibold">
                                    #{rv.rank} · {rv.volunteerId}
                                  </span>
                                  <span className="text-slate-700 font-semibold">
                                    Score {rv.finalScore.toFixed(1)}
                                  </span>
                                </div>
                                <div className="text-sm font-semibold text-slate-900">
                                  {rv.volunteerName}
                                </div>
                                <div className="text-xs text-slate-600">
                                  Matched: {rv.matchedSkills} ({rv.compatibilityScore.toFixed(0)}%)
                                </div>
                                <div className="text-xs text-slate-500 font-mono tabular-nums">
                                  Current Workload: {rv.currentWorkload.toFixed(1)}h
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  handleApproveAllocation(rv.volunteerId, item.taskId)
                                }
                                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>{busy ? 'Assigning...' : 'Approve Assignment'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        No free volunteers currently match the required skills for this task.
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Overstaffed Tasks Advisory */}
              {optData.overstaffedTasks.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <h4 className="text-sm font-semibold text-slate-900">
                      Overstaffed Tasks (Organizer Advisory)
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600">
                    Volunteers on ongoing tasks are never automatically removed. You may inspect and reassign volunteers manually if needed.
                  </p>
                  <div className="divide-y divide-slate-100">
                    {optData.overstaffedTasks.map((ov) => (
                      <div
                        key={ov.taskId}
                        className="py-2.5 flex items-center justify-between text-sm"
                      >
                        <span className="font-medium text-slate-900">
                          {ov.taskName}{' '}
                          <span className="font-mono text-xs text-slate-400">({ov.taskId})</span>
                        </span>
                        <span className="text-xs font-mono tabular-nums text-blue-700">
                          {ov.assignedActive}/{ov.required} assigned (+{ov.excess} excess)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
