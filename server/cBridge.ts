import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  AnalyticsResponse,
  AppDatabase,
  CSourceFile,
  CTestSuiteResponse,
  LiveStatsResponse,
  OptimizeResponse,
  RecommendResponse,
} from '../src/types.ts';

const execFileAsync = promisify(execFile);

const ROOT_DIR = process.cwd();
const C_ENGINE_DIR = path.resolve(ROOT_DIR, 'c_engine');
const ENGINE_BIN = path.resolve(C_ENGINE_DIR, 'volunteer_engine');
const TEST_BIN = path.resolve(C_ENGINE_DIR, 'test_runner');

const ALLOWED_SOURCE_FILES: Array<{
  filename: string;
  language: 'c' | 'h' | 'makefile';
  role: string;
}> = [
  { filename: 'main.c', language: 'c', role: 'CLI dispatcher & stream entrypoint' },
  { filename: 'volunteer.h', language: 'h', role: 'Volunteer Singly Linked List header' },
  { filename: 'volunteer.c', language: 'c', role: 'Volunteer Linked List CRUD & traversal' },
  { filename: 'task.h', language: 'h', role: 'Task Singly Linked List header' },
  { filename: 'task.c', language: 'c', role: 'Task Linked List CRUD & status updates' },
  { filename: 'queue.h', language: 'h', role: 'FIFO Linked Queue header' },
  { filename: 'queue.c', language: 'c', role: 'FIFO Queue enqueue, dequeue, front, rear' },
  { filename: 'allocation.h', language: 'h', role: 'Allocation List & matching algorithms header' },
  { filename: 'allocation.c', language: 'c', role: 'Skill matching, weighted score, Bubble Sort & Greedy selection' },
  { filename: 'event.h', language: 'h', role: 'Event context & JSON output header' },
  { filename: 'event.c', language: 'c', role: 'Workload balancer, FIFO task processor & live stats' },
  { filename: 'test_cases.c', language: 'c', role: 'Automated test suite (TC01–TC05)' },
  { filename: 'Makefile', language: 'makefile', role: 'GCC build configuration (-Wall -Wextra -Werror)' },
];

function sanitizeField(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\|/g, '/').replace(/[\r\n]+/g, ' ').trim();
}

export async function ensureCCompiled(): Promise<void> {
  if (fs.existsSync(ENGINE_BIN) && fs.existsSync(TEST_BIN)) {
    return;
  }
  await execFileAsync('make', ['-C', C_ENGINE_DIR], { timeout: 15000 });
}

function serializeStateForC(db: AppDatabase, eventId: string): string {
  const event = db.events.find((e) => e.id === eventId) ?? db.events[0];
  const lines: string[] = [];

  if (event) {
    lines.push(`EVENT|${sanitizeField(event.id)}|${sanitizeField(event.name)}`);
  } else {
    lines.push(`EVENT|${sanitizeField(eventId)}|Event`);
  }

  for (const v of db.volunteers) {
    lines.push(
      [
        'VOL',
        sanitizeField(v.id),
        sanitizeField(v.name),
        sanitizeField(v.email),
        sanitizeField(v.contact),
        sanitizeField(v.preferredTasks),
        sanitizeField(v.skills),
        sanitizeField(v.experience),
        sanitizeField(v.availability),
        sanitizeField(v.preferredSlot),
        sanitizeField(v.status),
        sanitizeField(v.assignedTaskId),
        String(Number.isFinite(v.currentWorkload) ? v.currentWorkload : 0),
      ].join('|')
    );
  }

  for (const t of db.tasks) {
    if (event && t.eventId !== event.id) continue;
    lines.push(
      [
        'TASK',
        sanitizeField(t.id),
        sanitizeField(t.eventId),
        sanitizeField(t.name),
        sanitizeField(t.description),
        sanitizeField(t.requiredSkills),
        String(t.requiredVolunteers),
        '0',
        '0',
        sanitizeField(t.priority),
        sanitizeField(t.location),
        String(t.durationHours),
        sanitizeField(t.startTime),
        sanitizeField(t.endTime),
        sanitizeField(t.status),
      ].join('|')
    );
  }

  for (const a of db.allocations) {
    if (event && a.eventId !== event.id) continue;
    lines.push(
      [
        'ALLOC',
        sanitizeField(a.id),
        sanitizeField(a.eventId),
        sanitizeField(a.volunteerId),
        sanitizeField(a.taskId),
        String(a.compatibilityScore),
        String(a.finalScore),
        String(a.previousWorkload),
        String(a.updatedWorkload),
        sanitizeField(a.matchedSkills),
        sanitizeField(a.status),
      ].join('|')
    );
  }

  return lines.join('\n') + '\n';
}

async function runCEngineCommand<T>(
  args: string[],
  stdinData: string
): Promise<T> {
  await ensureCCompiled();

  return new Promise<T>((resolve, reject) => {
    const child = spawn(ENGINE_BIN, args, {
      cwd: C_ENGINE_DIR,
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('C engine execution timed out'));
    }, 10000);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `C engine exited with code ${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as T;
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Invalid JSON from C engine: ${(err as Error).message}`));
      }
    });

    child.stdin.write(stdinData, 'utf8');
    child.stdin.end();
  });
}

export async function getLiveStatsFromC(
  db: AppDatabase,
  eventId: string
): Promise<LiveStatsResponse> {
  const input = serializeStateForC(db, eventId);
  return runCEngineCommand<LiveStatsResponse>(['live_stats'], input);
}

export async function getRecommendationsFromC(
  db: AppDatabase,
  eventId: string,
  taskId: string
): Promise<RecommendResponse> {
  const safeTaskId = sanitizeField(taskId);
  const input = serializeStateForC(db, eventId);
  return runCEngineCommand<RecommendResponse>(['recommend', safeTaskId], input);
}

export async function verifyAllocationWithC(
  db: AppDatabase,
  eventId: string,
  volunteerId: string,
  taskId: string
): Promise<{
  allowed: boolean;
  reason?: string;
  volunteerId?: string;
  volunteerName?: string;
  taskId?: string;
  taskName?: string;
  matchedSkills?: string;
  compatibilityScore?: number;
  loadPreference?: number;
  finalScore?: number;
  previousWorkload?: number;
  updatedWorkload?: number;
}> {
  const input = serializeStateForC(db, eventId);
  return runCEngineCommand(
    ['allocate_check', sanitizeField(volunteerId), sanitizeField(taskId)],
    input
  );
}

export async function getOptimizationFromC(
  db: AppDatabase,
  eventId: string
): Promise<OptimizeResponse> {
  const input = serializeStateForC(db, eventId);
  return runCEngineCommand<OptimizeResponse>(['optimize'], input);
}

export async function getAnalyticsFromC(
  db: AppDatabase,
  eventId: string
): Promise<AnalyticsResponse> {
  const input = serializeStateForC(db, eventId);
  return runCEngineCommand<AnalyticsResponse>(['analytics'], input);
}

export async function runCTestSuite(): Promise<CTestSuiteResponse> {
  await ensureCCompiled();
  try {
    const { stdout } = await execFileAsync(TEST_BIN, [], {
      cwd: C_ENGINE_DIR,
      timeout: 10000,
    });
    return JSON.parse(stdout) as CTestSuiteResponse;
  } catch (err) {
    const execErr = err as { stdout?: string; message?: string };
    if (execErr.stdout) {
      return JSON.parse(execErr.stdout) as CTestSuiteResponse;
    }
    throw new Error(execErr.message || 'Failed to execute C test suite');
  }
}

export function readCSourceFiles(): CSourceFile[] {
  return ALLOWED_SOURCE_FILES.map((entry) => {
    const resolved = path.resolve(C_ENGINE_DIR, entry.filename);
    if (!resolved.startsWith(C_ENGINE_DIR + path.sep)) {
      throw new Error('Invalid source file path');
    }
    const content = fs.readFileSync(resolved, 'utf8');
    return {
      filename: entry.filename,
      language: entry.language,
      role: entry.role,
      content,
    };
  });
}
