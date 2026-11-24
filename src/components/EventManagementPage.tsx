import { useState, type FormEvent } from 'react';
import { Calendar, Check, MapPin, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '../api';
import type { AppDatabase, EventRecord, LiveStatsResponse } from '../types';
import { StatusText } from './StatusText';

interface EventManagementPageProps {
  db: AppDatabase;
  onStateChange: (db: AppDatabase, liveStats: LiveStatsResponse) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export function EventManagementPage({
  db,
  onStateChange,
  onNotify,
}: EventManagementPageProps) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [venue, setVenue] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<EventRecord['status']>('Upcoming');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.createEvent({
        name,
        date,
        venue,
        organizer,
        description,
        status,
        setActive: true,
      });
      onStateChange(res.db, res.liveStats);
      setName('');
      setVenue('');
      setOrganizer('');
      setDescription('');
      onNotify(`Created and activated event "${res.event.name}".`);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      const res = await api.activateEvent(id);
      onStateChange(res.db, res.liveStats);
      onNotify('Active event switched.');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const handleStatusUpdate = async (id: string, nextStatus: EventRecord['status']) => {
    try {
      const res = await api.updateEvent(id, { status: nextStatus });
      onStateChange(res.db, res.liveStats);
      onNotify(`Event status updated to ${nextStatus}.`);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const handleDelete = async (id: string, evName: string) => {
    try {
      const res = await api.deleteEvent(id);
      onStateChange(res.db, res.liveStats);
      onNotify(`Deleted event "${evName}".`);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const handleResetDemo = async () => {
    try {
      const res = await api.resetDemo();
      onStateChange(res.db, res.liveStats);
      onNotify('Restored Tech Symposium 2026 sample dataset.');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Event Management</h2>
          <p className="text-sm text-slate-600">
            Create college symposiums, switch the active workspace event, or update event status.
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetDemo}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Demo Dataset</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Event Form */}
        <form
          onSubmit={handleCreate}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
        >
          <h3 className="text-base font-semibold text-slate-900">Create New Event</h3>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Event Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Annual Tech Fest 2026"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EventRecord['status'])}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Upcoming">Upcoming</option>
                <option value="Live">Live</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Venue</label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Main Auditorium & Labs"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Organizing Department
            </label>
            <input
              type="text"
              value={organizer}
              onChange={(e) => setOrganizer(e.target.value)}
              placeholder="CSE Department"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope and volunteer operational overview..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{submitting ? 'Creating...' : 'Create Event'}</span>
          </button>
        </form>

        {/* Event Directory */}
        <div className="lg:col-span-2 space-y-4">
          {db.events.map((ev) => {
            const isActive = ev.id === db.activeEventId;
            const taskCount = db.tasks.filter((t) => t.eventId === ev.id).length;
            const allocCount = db.allocations.filter((a) => a.eventId === ev.id).length;

            return (
              <div
                key={ev.id}
                className={`bg-white border rounded-xl p-5 transition-colors ${
                  isActive ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono tabular-nums">{ev.id}</span>
                      <span aria-hidden="true">·</span>
                      <StatusText status={ev.status} />
                      {isActive && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-blue-700 font-semibold">Active Workspace</span>
                        </>
                      )}
                    </div>
                    <h4 className="text-lg font-semibold text-slate-900">{ev.name}</h4>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {ev.date}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {ev.venue}
                      </span>
                      <span className="font-mono tabular-nums">
                        {taskCount} tasks · {allocCount} allocations
                      </span>
                    </div>
                    {ev.description && (
                      <p className="text-sm text-slate-600 pt-2">{ev.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      aria-label="Event status"
                      value={ev.status}
                      onChange={(e) =>
                        handleStatusUpdate(ev.id, e.target.value as EventRecord['status'])
                      }
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
                    >
                      <option value="Upcoming">Upcoming</option>
                      <option value="Live">Live</option>
                      <option value="Completed">Completed</option>
                    </select>

                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => handleActivate(ev.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Set Active</span>
                      </button>
                    )}

                    {db.events.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDelete(ev.id, ev.name)}
                        title="Delete event"
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
