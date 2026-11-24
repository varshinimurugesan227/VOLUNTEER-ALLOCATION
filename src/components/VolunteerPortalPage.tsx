import { useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { api } from '../api';
import type { AppDatabase, LiveStatsResponse } from '../types';
import { StatusText } from './StatusText';

interface VolunteerPortalPageProps {
  db: AppDatabase;
  onStateChange: (db: AppDatabase, liveStats: LiveStatsResponse) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export function VolunteerPortalPage({
  db,
  onStateChange,
  onNotify,
}: VolunteerPortalPageProps) {
  const [volunteerIdInput, setVolunteerIdInput] = useState('VOL-105');
  const [loggedInId, setLoggedInId] = useState<string>('VOL-105');
  const [loginError, setLoginError] = useState('');
  const [showReassignForm, setShowReassignForm] = useState(false);
  const [reassignReason, setReassignReason] = useState('');
  const [busy, setBusy] = useState(false);

  const volunteer = db.volunteers.find(
    (v) => v.id.toLowerCase() === loggedInId.trim().toLowerCase()
  );

  const assignedTask = volunteer?.assignedTaskId
    ? db.tasks.find((t) => t.id === volunteer.assignedTaskId)
    : undefined;

  const history = volunteer
    ? db.allocations.filter((a) => a.volunteerId === volunteer.id)
    : [];

  const handleSignIn = (e: FormEvent) => {
    e.preventDefault();
    const match = db.volunteers.find(
      (v) => v.id.toLowerCase() === volunteerIdInput.trim().toLowerCase()
    );
    if (!match) {
      setLoginError(`Volunteer ID "${volunteerIdInput}" not found.`);
      return;
    }
    setLoginError('');
    setLoggedInId(match.id);
    setShowReassignForm(false);
  };

  const runAction = async (
    action:
      | 'check_in'
      | 'complete_task'
      | 'make_available'
      | 'request_reassignment'
      | 'report_unavailable',
    reason?: string
  ) => {
    if (!volunteer) return;
    setBusy(true);
    try {
      const res = await api.volunteerStatusAction(volunteer.id, action, { reason });
      onStateChange(res.db, res.liveStats);
      setShowReassignForm(false);
      setReassignReason('');
      onNotify('Your status has been updated in the Live Control Center.');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Volunteer ID Login Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Volunteer Self-Service Portal</h2>
            <p className="text-xs text-slate-500">
              Sign in with your Volunteer ID to view shift instructions, check in, or update availability.
            </p>
          </div>
          {volunteer && (
            <button
              type="button"
              onClick={() => {
                setLoggedInId('');
                setVolunteerIdInput('');
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 self-start sm:self-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch Volunteer</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSignIn} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={volunteerIdInput}
            onChange={(e) => setVolunteerIdInput(e.target.value)}
            placeholder="Enter Volunteer ID (e.g., VOL-101)"
            className="flex-1 px-3 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            aria-label="Quick select registered volunteer"
            value={volunteer?.id || ''}
            onChange={(e) => {
              if (e.target.value) {
                setVolunteerIdInput(e.target.value);
                setLoggedInId(e.target.value);
                setLoginError('');
              }
            }}
            className="px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-700"
          >
            <option value="">Demo Quick Select...</option>
            {db.volunteers.map((v) => (
              <option key={v.id} value={v.id}>
                {v.id} — {v.name} ({v.status})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap"
          >
            <LogIn className="w-4 h-4" />
            <span>Access Portal</span>
          </button>
        </form>

        {loginError && <p className="text-xs text-red-600 font-medium">{loginError}</p>}
      </div>

      {volunteer && (
        <>
          {/* Volunteer Profile Summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-mono">{volunteer.id}</span>
                <span aria-hidden="true">·</span>
                <StatusText status={volunteer.status} />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">{volunteer.name}</h3>
              <p className="text-xs text-slate-600">
                Skills: {volunteer.skills} · Preferred Slot: {volunteer.preferredSlot}
              </p>
            </div>
            <div className="sm:text-right">
              <div className="text-xs text-slate-500">Logged Workload</div>
              <div className="text-2xl font-semibold font-mono tabular-nums text-blue-700">
                {volunteer.currentWorkload.toFixed(1)} hrs
              </div>
            </div>
          </div>

          {/* Assigned Task & Live Shift Actions */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-base font-semibold text-slate-900">Current Assignment</h4>
              {assignedTask && <StatusText status={assignedTask.priority} />}
            </div>

            {assignedTask ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-mono text-slate-500">{assignedTask.id}</div>
                  <h5 className="text-lg font-semibold text-slate-900 mt-0.5">
                    {assignedTask.name}
                  </h5>
                  <p className="text-sm text-slate-600 mt-1">{assignedTask.description}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                  <div className="flex items-center gap-2 text-slate-700">
                    <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      Location: <strong>{assignedTask.location}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 font-mono tabular-nums text-xs sm:text-sm">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      Shift: {assignedTask.startTime} – {assignedTask.endTime} (
                      {assignedTask.durationHours}h)
                    </span>
                  </div>
                </div>

                {/* Mobile-Friendly Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {volunteer.status === 'Assigned' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runAction('check_in')}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Check In (Start Working)</span>
                    </button>
                  )}

                  {(volunteer.status === 'Working' || volunteer.status === 'Assigned') && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runAction('complete_task')}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Mark Task Completed</span>
                    </button>
                  )}

                  {volunteer.status !== 'Reassignment Requested' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setShowReassignForm((s) => !s)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Request Reassignment</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction('report_unavailable')}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Report Unavailability</span>
                  </button>
                </div>

                {volunteer.status === 'Reassignment Requested' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                    Reassignment request submitted: "{volunteer.reassignmentReason}". Waiting for organizer review.
                  </div>
                )}

                {showReassignForm && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      runAction('request_reassignment', reassignReason);
                    }}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
                  >
                    <label className="block text-xs font-medium text-slate-700">
                      Reason for Reassignment Request
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={reassignReason}
                      onChange={(e) => setReassignReason(e.target.value)}
                      placeholder="Explain schedule conflict or preferred area..."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowReassignForm(false)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={busy}
                        className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                      >
                        Submit Request
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="py-6 text-center space-y-3">
                <p className="text-sm text-slate-600">
                  {volunteer.status === 'Unavailable'
                    ? 'You are currently marked as Unavailable.'
                    : volunteer.status === 'Completed'
                      ? 'You have completed your previous task and are free for new assignments.'
                      : 'You are currently in the Available pool waiting for task assignment.'}
                </p>
                {volunteer.status === 'Unavailable' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction('make_available')}
                    className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    Mark Myself Available
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction('report_unavailable')}
                    className="px-4 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg"
                  >
                    Report Unavailability
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Personal Task History */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h4 className="text-base font-semibold text-slate-900">Your Task History</h4>
            </div>
            <div className="divide-y divide-slate-100">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm"
                >
                  <div>
                    <div className="font-medium text-slate-900">
                      {item.taskName}{' '}
                      <span className="font-mono text-xs text-slate-400">({item.taskId})</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.eventName} · Compatibility {item.compatibilityScore.toFixed(0)}% ·{' '}
                      Workload {item.previousWorkload.toFixed(1)}h →{' '}
                      {item.updatedWorkload.toFixed(1)}h
                    </div>
                  </div>
                  <StatusText status={item.status} />
                </div>
              ))}
              {history.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">
                  No task allocation history recorded yet.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
