import { useState, type FormEvent } from 'react';
import { Edit3, MapPin, Plus, Trash2, X } from 'lucide-react';
import { api } from '../api';
import type {
  AppDatabase,
  LiveStatsResponse,
  TaskPriority,
  TaskRecord,
  TaskStatus,
} from '../types';
import { StatusText } from './StatusText';

interface TaskManagementPageProps {
  db: AppDatabase;
  liveStats: LiveStatsResponse;
  onStateChange: (db: AppDatabase, liveStats: LiveStatsResponse) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export function TaskManagementPage({
  db,
  liveStats,
  onStateChange,
  onNotify,
}: TaskManagementPageProps) {
  const activeEvent = db.events.find((e) => e.id === db.activeEventId) || db.events[0];
  const eventTasks = db.tasks.filter((t) => t.eventId === activeEvent?.id);
  const staffingMap = new Map(liveStats.taskStaffing.map((s) => [s.taskId, s]));

  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [requiredVolunteers, setRequiredVolunteers] = useState(3);
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [location, setLocation] = useState('');
  const [durationHours, setDurationHours] = useState(3);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [status, setStatus] = useState<TaskStatus>('Not Started');

  const openAdd = () => {
    setEditingTask(null);
    setName('');
    setDescription('');
    setRequiredSkills('');
    setRequiredVolunteers(3);
    setPriority('Medium');
    setLocation('');
    setDurationHours(3);
    setStartTime('09:00');
    setEndTime('12:00');
    setStatus('Not Started');
    setShowModal(true);
  };

  const openEdit = (t: TaskRecord) => {
    setEditingTask(t);
    setName(t.name);
    setDescription(t.description);
    setRequiredSkills(t.requiredSkills);
    setRequiredVolunteers(t.requiredVolunteers);
    setPriority(t.priority);
    setLocation(t.location);
    setDurationHours(t.durationHours);
    setStartTime(t.startTime);
    setEndTime(t.endTime);
    setStatus(t.status);
    setShowModal(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        eventId: activeEvent?.id,
        name,
        description,
        requiredSkills,
        requiredVolunteers: Number(requiredVolunteers),
        priority,
        location,
        durationHours: Number(durationHours),
        startTime,
        endTime,
        status,
      };

      if (editingTask) {
        const res = await api.updateTask(editingTask.id, payload);
        onStateChange(res.db, res.liveStats);
        onNotify(`Updated task "${name}".`);
      } else {
        const res = await api.createTask(payload);
        onStateChange(res.db, res.liveStats);
        onNotify(`Created task "${res.task.name}" (${res.task.id}).`);
      }
      setShowModal(false);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const handleDelete = async (id: string, taskName: string) => {
    try {
      const res = await api.deleteTask(id);
      onStateChange(res.db, res.liveStats);
      onNotify(`Deleted task "${taskName}".`);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const handleMarkCompleted = async (t: TaskRecord) => {
    try {
      const res = await api.updateTask(t.id, { status: 'Completed' });
      onStateChange(res.db, res.liveStats);
      onNotify(`Marked "${t.name}" as Completed and released assigned volunteers.`);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Event & Task Management</h2>
          <p className="text-sm text-slate-600">
            Configure tasks, required skills, volunteer headcount, schedules, and locations for{' '}
            <span className="font-medium text-slate-900">{activeEvent?.name}</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Event Task</span>
        </button>
      </div>

      {/* Add / Edit Task Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingTask ? `Edit Task (${editingTask.id})` : 'Create Event Task'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Task Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Registration Management"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description / Instructions
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Task duties and operational instructions..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Required Skills * (comma-separated)
                </label>
                <input
                  type="text"
                  required
                  value={requiredSkills}
                  onChange={(e) => setRequiredSkills(e.target.value)}
                  placeholder="Communication, Data Entry, Crowd Handling"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Volunteers Required *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    required
                    value={requiredVolunteers}
                    onChange={(e) => setRequiredVolunteers(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Duration (hrs) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min={0.5}
                    max={24}
                    required
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Main Atrium"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {editingTask && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Fully Staffed">Fully Staffed</option>
                    <option value="Needs Volunteers">Needs Volunteers</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  {editingTask ? 'Save Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Task ID</th>
                <th className="py-3 px-4">Task & Required Skills</th>
                <th className="py-3 px-4">Location & Schedule</th>
                <th className="py-3 px-4 text-right">Required</th>
                <th className="py-3 px-4 text-right">Assigned</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {eventTasks.map((t) => {
                const staff = staffingMap.get(t.id);
                return (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {t.id}
                    </td>
                    <td className="py-3 px-4 max-w-sm">
                      <div className="font-medium text-slate-900">{t.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{t.description}</div>
                      <div className="text-xs text-blue-700 mt-1">
                        Skills: {t.requiredSkills}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 text-slate-800">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{t.location}</span>
                      </div>
                      <div className="font-mono tabular-nums text-slate-500 mt-0.5">
                        {t.startTime}–{t.endTime} ({t.durationHours}h)
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                      {t.requiredVolunteers}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {staff ? staff.assignedActive : 0}
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={t.priority} />
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={t.status} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {t.status !== 'Completed' && (
                        <button
                          type="button"
                          onClick={() => handleMarkCompleted(t)}
                          className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md mr-1.5"
                        >
                          Complete
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        title="Edit task"
                        className="p-1.5 text-slate-500 hover:text-blue-600 rounded-md hover:bg-blue-50"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t.id, t.name)}
                        title="Delete task"
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 ml-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {eventTasks.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-slate-500">
                    No tasks added to this event yet. Click "Add Event Task" to begin.
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
