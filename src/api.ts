import type {
  AnalyticsResponse,
  AppDatabase,
  CSourceFile,
  CTestSuiteResponse,
  EventRecord,
  LiveStatsResponse,
  OptimizeResponse,
  RecommendResponse,
  TaskRecord,
  VolunteerRecord,
} from './types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export interface StatePayload {
  db: AppDatabase;
  liveStats: LiveStatsResponse;
}

export const api = {
  getState: (eventId?: string) =>
    request<StatePayload>(eventId ? `/api/state?eventId=${encodeURIComponent(eventId)}` : '/api/state'),

  resetDemo: () => request<StatePayload>('/api/reset-demo', { method: 'POST' }),

  createEvent: (payload: Partial<EventRecord> & { setActive?: boolean }) =>
    request<StatePayload & { event: EventRecord }>('/api/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  activateEvent: (id: string) =>
    request<StatePayload>(`/api/events/${encodeURIComponent(id)}/activate`, { method: 'POST' }),

  updateEvent: (id: string, payload: Partial<EventRecord>) =>
    request<StatePayload>(`/api/events/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteEvent: (id: string) =>
    request<StatePayload>(`/api/events/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  createVolunteer: (payload: Partial<VolunteerRecord>) =>
    request<StatePayload & { volunteer: VolunteerRecord }>('/api/volunteers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  importVolunteersCsv: (csvText: string) =>
    request<StatePayload & { imported: { added: number; updated: number; skipped: number } }>(
      '/api/volunteers/import-csv',
      {
        method: 'POST',
        body: JSON.stringify({ csvText }),
      }
    ),

  updateVolunteer: (id: string, payload: Partial<VolunteerRecord>) =>
    request<StatePayload>(`/api/volunteers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteVolunteer: (id: string) =>
    request<StatePayload>(`/api/volunteers/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  volunteerStatusAction: (
    id: string,
    action:
      | 'check_in'
      | 'complete_task'
      | 'make_available'
      | 'request_reassignment'
      | 'approve_reassignment'
      | 'reject_reassignment'
      | 'report_unavailable',
    extra?: { reason?: string; targetTaskId?: string }
  ) =>
    request<StatePayload>(`/api/volunteers/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      body: JSON.stringify({ action, ...extra }),
    }),

  createTask: (payload: Partial<TaskRecord>) =>
    request<StatePayload & { task: TaskRecord }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTask: (id: string, payload: Partial<TaskRecord>) =>
    request<StatePayload>(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteTask: (id: string) =>
    request<StatePayload>(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  recommendForTask: (taskId: string, eventId?: string) =>
    request<RecommendResponse>(
      `/api/c-engine/recommend/${encodeURIComponent(taskId)}${
        eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''
      }`
    ),

  allocateVolunteer: (volunteerId: string, taskId: string) =>
    request<StatePayload>('/api/c-engine/allocate', {
      method: 'POST',
      body: JSON.stringify({ volunteerId, taskId }),
    }),

  optimizeWorkforce: (eventId?: string) =>
    request<OptimizeResponse>(
      `/api/c-engine/optimize${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''}`
    ),

  getAnalytics: (eventId?: string) =>
    request<AnalyticsResponse>(
      `/api/c-engine/analytics${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ''}`
    ),

  getCSources: () => request<{ files: CSourceFile[] }>('/api/c-engine/sources'),

  runCTests: () => request<CTestSuiteResponse>('/api/c-engine/run-tests', { method: 'POST' }),
};
