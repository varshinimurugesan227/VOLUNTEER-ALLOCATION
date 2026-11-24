import fs from 'node:fs';
import path from 'node:path';
import { initialSeedDatabase } from './seedData.ts';
import type {
  AllocationRecord,
  AppDatabase,
  AvailabilityType,
  EventRecord,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  VolunteerRecord,
  VolunteerStatus,
} from '../src/types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadDatabase(): AppDatabase {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const seeded = structuredClone(initialSeedDatabase);
    saveDatabase(seeded);
    return seeded;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as AppDatabase;
    if (!parsed || !Array.isArray(parsed.events) || !Array.isArray(parsed.volunteers)) {
      throw new Error('Corrupt db');
    }
    const defaultEventId = parsed.events[0]?.id || 'EVT-2026';
    for (const v of parsed.volunteers) {
      if (!v.eventId) {
        v.eventId = defaultEventId;
      }
    }
    return parsed;
  } catch {
    const seeded = structuredClone(initialSeedDatabase);
    saveDatabase(seeded);
    return seeded;
  }
}

export function saveDatabase(db: AppDatabase): void {
  ensureDataDir();
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

export function resetDatabaseToSeed(): AppDatabase {
  const seeded = structuredClone(initialSeedDatabase);
  saveDatabase(seeded);
  return seeded;
}

export function syncTaskStatuses(db: AppDatabase): void {
  for (const task of db.tasks) {
    if (task.status === 'Completed') continue;

    const assigned = db.volunteers.filter(
      (v) =>
        v.eventId === task.eventId &&
        v.assignedTaskId === task.id &&
        (v.status === 'Assigned' ||
          v.status === 'Working' ||
          v.status === 'Reassignment Requested')
    );
    const workingCount = assigned.filter((v) => v.status === 'Working').length;

    if (workingCount > 0 && assigned.length >= task.requiredVolunteers) {
      task.status = 'In Progress';
    } else if (assigned.length >= task.requiredVolunteers) {
      task.status = 'Fully Staffed';
    } else if (assigned.length > 0) {
      task.status = 'Needs Volunteers';
    } else if (task.status !== 'Not Started') {
      task.status = 'Needs Volunteers';
    }
  }
}

export function validateAvailability(val: unknown): AvailabilityType {
  if (val === 'Available' || val === 'Limited' || val === 'Unavailable') {
    return val;
  }
  return 'Available';
}

export function validateVolunteerStatus(val: unknown): VolunteerStatus {
  const allowed: VolunteerStatus[] = [
    'Available',
    'Assigned',
    'Working',
    'Completed',
    'Unavailable',
    'Reassignment Requested',
  ];
  if (typeof val === 'string' && allowed.includes(val as VolunteerStatus)) {
    return val as VolunteerStatus;
  }
  return 'Available';
}

export function validateTaskPriority(val: unknown): TaskPriority {
  if (val === 'High' || val === 'Medium' || val === 'Low') return val;
  return 'Medium';
}

export function validateTaskStatus(val: unknown): TaskStatus {
  const allowed: TaskStatus[] = [
    'Not Started',
    'In Progress',
    'Fully Staffed',
    'Needs Volunteers',
    'Completed',
  ];
  if (typeof val === 'string' && allowed.includes(val as TaskStatus)) {
    return val as TaskStatus;
  }
  return 'Not Started';
}

export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field.trim());
        field = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(field.trim());
        if (row.some((c) => c.length > 0)) rows.push(row);
        row = [];
        field = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field.trim());
        if (row.some((c) => c.length > 0)) rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }

  row.push(field.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);

  return rows;
}

export function nextSequentialId(prefix: string, existingIds: string[]): string {
  let maxNum = 100;
  for (const id of existingIds) {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(id);
    if (match) {
      const n = Number.parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `${prefix}-${maxNum + 1}`;
}

export function createEventRecord(
  db: AppDatabase,
  payload: Partial<EventRecord>
): EventRecord {
  const id = nextSequentialId(
    'EVT',
    db.events.map((e) => e.id)
  );
  return {
    id,
    name: String(payload.name || 'Untitled Event').trim(),
    date: String(payload.date || new Date().toISOString().slice(0, 10)),
    venue: String(payload.venue || 'Main Campus').trim(),
    organizer: String(payload.organizer || 'Event Organizing Committee').trim(),
    description: String(payload.description || '').trim(),
    status: payload.status === 'Completed' || payload.status === 'Live' ? payload.status : 'Upcoming',
    createdAt: new Date().toISOString(),
  };
}

export function createTaskRecord(
  db: AppDatabase,
  payload: Partial<TaskRecord>
): TaskRecord {
  const id =
    payload.id && String(payload.id).trim()
      ? String(payload.id).trim()
      : nextSequentialId(
          'TSK',
          db.tasks.map((t) => t.id)
        );
  const reqVol = Math.max(1, Math.min(200, Number(payload.requiredVolunteers) || 1));
  const dur = Math.max(0.5, Math.min(24, Number(payload.durationHours) || 2));

  return {
    id,
    eventId: String(payload.eventId || db.activeEventId),
    name: String(payload.name || 'Untitled Task').trim(),
    description: String(payload.description || '').trim(),
    requiredSkills: String(payload.requiredSkills || 'Communication').trim(),
    requiredVolunteers: reqVol,
    priority: validateTaskPriority(payload.priority),
    location: String(payload.location || 'Main Campus').trim(),
    durationHours: dur,
    startTime: String(payload.startTime || '09:00'),
    endTime: String(payload.endTime || '12:00'),
    status: validateTaskStatus(payload.status),
  };
}

export function createVolunteerRecord(
  db: AppDatabase,
  payload: Partial<VolunteerRecord>
): VolunteerRecord {
  const targetEventId = String(payload.eventId || db.activeEventId);
  const eventVolunteers = db.volunteers.filter((v) => v.eventId === targetEventId);
  const id =
    payload.id && String(payload.id).trim()
      ? String(payload.id).trim()
      : nextSequentialId(
          'VOL',
          eventVolunteers.map((v) => v.id)
        );
  const avail = validateAvailability(payload.availability);
  const status =
    avail === 'Unavailable'
      ? 'Unavailable'
      : validateVolunteerStatus(payload.status || 'Available');

  return {
    id,
    eventId: targetEventId,
    name: String(payload.name || '').trim(),
    email: String(payload.email || '').trim(),
    contact: String(payload.contact || '').trim(),
    preferredTasks: String(payload.preferredTasks || '').trim(),
    skills: String(payload.skills || '').trim(),
    experience: String(payload.experience || '0 events').trim(),
    availability: avail,
    preferredSlot: String(payload.preferredSlot || 'Full Day').trim(),
    status,
    assignedTaskId: String(payload.assignedTaskId || '').trim(),
    currentWorkload: Math.max(0, Number(payload.currentWorkload) || 0),
    reassignmentReason: payload.reassignmentReason ? String(payload.reassignmentReason).trim() : undefined,
  };
}

export function recordAllocation(
  db: AppDatabase,
  alloc: Omit<AllocationRecord, 'id' | 'createdAt'>
): AllocationRecord {
  const id = nextSequentialId(
    'ALC',
    db.allocations.map((a) => a.id)
  );
  const item: AllocationRecord = {
    ...alloc,
    id,
    createdAt: new Date().toISOString(),
  };
  db.allocations.unshift(item);
  return item;
}
