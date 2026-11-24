import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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
const DEFAULT_ENGINE_BIN = path.resolve(C_ENGINE_DIR, 'volunteer_engine');
const DEFAULT_TEST_BIN = path.resolve(C_ENGINE_DIR, 'test_runner');

const FALLBACK_BIN_DIR = path.resolve(os.tmpdir(), 'campuscrew_c_engine');
const FALLBACK_ENGINE_BIN = path.resolve(FALLBACK_BIN_DIR, 'volunteer_engine');
const FALLBACK_TEST_BIN = path.resolve(FALLBACK_BIN_DIR, 'test_runner');

let activeEngineBin = DEFAULT_ENGINE_BIN;
let activeTestBin = DEFAULT_TEST_BIN;

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

function isExecutable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK | fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function trySetExecutable(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  try {
    fs.chmodSync(filePath, 0o755);
  } catch {
    // Ignore chmod failures on read-only/unowned files; caller will recompile if needed.
  }
  return isExecutable(filePath);
}

async function verifyBinaryRuns(binPath: string, args: string[]): Promise<boolean> {
  if (!isExecutable(binPath)) return false;
  try {
    await execFileAsync(binPath, args, { cwd: C_ENGINE_DIR, timeout: 5000 });
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // EACCES / ENOEXEC means binary cannot execute in this runtime environment
    if (code === 'EACCES' || code === 'ENOEXEC' || code === 'ENOENT') {
      return false;
    }
    // Non-zero exit with valid execution (e.g. CLI usage exit) still proves it executes
    return true;
  }
}

async function compileToFallbackTmp(): Promise<void> {
  fs.mkdirSync(FALLBACK_BIN_DIR, { recursive: true });
  const coreSources = [
    'volunteer.c',
    'task.c',
    'queue.c',
    'allocation.c',
    'event.c',
  ].map((f) => path.resolve(C_ENGINE_DIR, f));

  const cflags = ['-Wall', '-Wextra', '-Werror', '-std=c11', '-O2', `-I${C_ENGINE_DIR}`];

  await execFileAsync(
    'gcc',
    [...cflags, ...coreSources, path.resolve(C_ENGINE_DIR, 'main.c'), '-o', FALLBACK_ENGINE_BIN, '-lm'],
    { cwd: C_ENGINE_DIR, timeout: 15000 }
  );
  await execFileAsync(
    'gcc',
    [...cflags, ...coreSources, path.resolve(C_ENGINE_DIR, 'test_cases.c'), '-o', FALLBACK_TEST_BIN, '-lm'],
    { cwd: C_ENGINE_DIR, timeout: 15000 }
  );

  fs.chmodSync(FALLBACK_ENGINE_BIN, 0o755);
  fs.chmodSync(FALLBACK_TEST_BIN, 0o755);
}

export async function ensureCCompiled(): Promise<void> {
  // 1. Check existing binaries and restore +x permissions if stripped (e.g., 0644 after snapshot restore)
  const engineReady =
    trySetExecutable(DEFAULT_ENGINE_BIN) && (await verifyBinaryRuns(DEFAULT_ENGINE_BIN, []));
  const testReady = trySetExecutable(DEFAULT_TEST_BIN);

  if (engineReady && testReady) {
    activeEngineBin = DEFAULT_ENGINE_BIN;
    activeTestBin = DEFAULT_TEST_BIN;
    return;
  }

  // 2. Try rebuilding in c_engine/ with make clean && make
  try {
    await execFileAsync('make', ['-C', C_ENGINE_DIR, 'clean'], { timeout: 15000 });
    await execFileAsync('make', ['-C', C_ENGINE_DIR], { timeout: 15000 });
    trySetExecutable(DEFAULT_ENGINE_BIN);
    trySetExecutable(DEFAULT_TEST_BIN);

    if (
      isExecutable(DEFAULT_ENGINE_BIN) &&
      isExecutable(DEFAULT_TEST_BIN) &&
      (await verifyBinaryRuns(DEFAULT_ENGINE_BIN, []))
    ) {
      activeEngineBin = DEFAULT_ENGINE_BIN;
      activeTestBin = DEFAULT_TEST_BIN;
      return;
    }
  } catch {
    // Fall through to tmpdir compilation if c_engine/ is not writable or mounted noexec
  }

  // 3. Fallback: compile cleanly into OS tmpdir if c_engine/ cannot hold executable binaries
  try {
    await compileToFallbackTmp();
    if (isExecutable(FALLBACK_ENGINE_BIN) && isExecutable(FALLBACK_TEST_BIN)) {
      activeEngineBin = FALLBACK_ENGINE_BIN;
      activeTestBin = FALLBACK_TEST_BIN;
      return;
    }
  } catch (err) {
    throw new Error(
      `Failed to compile or execute the C engine (${DEFAULT_ENGINE_BIN}): ${(err as Error).message}`
    );
  }

  throw new Error(
    `C engine binary at ${DEFAULT_ENGINE_BIN} is not executable. Run "make -C c_engine clean && make -C c_engine && chmod +x c_engine/volunteer_engine c_engine/test_runner".`
  );
}

function serializeStateForC(db: AppDatabase, eventId: string): string {
  const event = db.events.find((e) => e.id === eventId) ?? db.events[0];
  const targetEventId = event ? event.id : eventId;
  const lines: string[] = [];

  if (event) {
    lines.push(`EVENT|${sanitizeField(event.id)}|${sanitizeField(event.name)}`);
  } else {
    lines.push(`EVENT|${sanitizeField(eventId)}|Event`);
  }

  for (const v of db.volunteers) {
    if (v.eventId !== targetEventId) continue;
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

function formatSpawnError(binPath: string, err: NodeJS.ErrnoException): Error {
  if (err.code === 'EACCES') {
    return new Error(
      `Permission denied executing C binary "${binPath}" (EACCES). Ensure executable permissions (+x) are set.`
    );
  }
  if (err.code === 'ENOENT') {
    return new Error(
      `Compiled C binary "${binPath}" was not found (ENOENT). Run "make -C c_engine" to build it.`
    );
  }
  return new Error(`Failed to execute C binary "${binPath}": ${err.message}`);
}

async function runCEngineCommand<T>(
  args: string[],
  stdinData: string
): Promise<T> {
  await ensureCCompiled();

  return new Promise<T>((resolve, reject) => {
    const child = spawn(activeEngineBin, args, {
      cwd: C_ENGINE_DIR,
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error('C engine execution timed out after 10s'));
    }, 10000);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.stdin.on('error', () => {
      // Handled via child error/close events
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(formatSpawnError(activeEngineBin, err));
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `C engine exited with code ${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as T;
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Invalid JSON returned by C engine: ${(err as Error).message}`));
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
    const { stdout } = await execFileAsync(activeTestBin, [], {
      cwd: C_ENGINE_DIR,
      timeout: 10000,
    });
    return JSON.parse(stdout) as CTestSuiteResponse;
  } catch (err) {
    const execErr = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    if (execErr.stdout) {
      try {
        return JSON.parse(execErr.stdout) as CTestSuiteResponse;
      } catch {
        // Fall through to meaningful error message
      }
    }
    if (execErr.code === 'EACCES' || execErr.code === 'ENOENT') {
      throw formatSpawnError(activeTestBin, execErr);
    }
    throw new Error(
      execErr.stderr?.trim() || execErr.message || 'Failed to execute C test suite'
    );
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
