import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  ensureCCompiled,
  getAnalyticsFromC,
  getLiveStatsFromC,
  getOptimizationFromC,
  getRecommendationsFromC,
  readCSourceFiles,
  runCTestSuite,
  verifyAllocationWithC,
} from './server/cBridge.ts';
import {
  createEventRecord,
  createTaskRecord,
  createVolunteerRecord,
  loadDatabase,
  nextSequentialId,
  parseCsvRows,
  recordAllocation,
  resetDatabaseToSeed,
  saveDatabase,
  syncTaskStatuses,
  validateAvailability,
  validateTaskPriority,
  validateTaskStatus,
  validateVolunteerStatus,
} from './server/store.ts';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  await ensureCCompiled();

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/state', async (req, res) => {
    try {
      const db = loadDatabase();
      const eventId =
        typeof req.query.eventId === 'string' && req.query.eventId
          ? req.query.eventId
          : db.activeEventId;
      syncTaskStatuses(db);
      saveDatabase(db);
      const liveStats = await getLiveStatsFromC(db, eventId);
      res.json({ db, liveStats });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/reset-demo', async (_req, res) => {
    try {
      const db = resetDatabaseToSeed();
      const liveStats = await getLiveStatsFromC(db, db.activeEventId);
      res.json({ db, liveStats });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /* ---------------- EVENT MANAGEMENT ---------------- */
  app.post('/api/events', async (req, res) => {
    try {
      const { name, date, venue, organizer, description, status, setActive } = req.body ?? {};
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Event name is required.' });
        return;
      }
      const db = loadDatabase();
      const event = createEventRecord(db, { name, date, venue, organizer, description, status });
      db.events.push(event);
      if (setActive !== false) {
        db.activeEventId = event.id;
      }
      saveDatabase(db);
      const liveStats = await getLiveStatsFromC(db, db.activeEventId);
      res.status(201).json({ event, db, liveStats });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/events/:id/activate', async (req, res) => {
    try {
      const db = loadDatabase();
      const exists = db.events.find((e) => e.id === req.params.id);
      if (!exists) {
        res.status(404).json({ error: 'Event not found.' });
        return;
      }
      db.activeEventId = exists.id;
      saveDatabase(db);
      const liveStats = await getLiveStatsFromC(db, db.activeEventId);
      res.json({ db, liveStats });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.patch('/api/events/:id', async (req, res) => {
    try {
      const db = loadDatabase();
      const event = db.events.find((e) => e.id === req.params.id);
      if (!event) {
        res.status(404).json({ error: 'Event not found.' });
        return;
      }
      const { name, date, venue, organizer, description, status } = req.body ?? {};
      if (typeof name === 'string' && name.trim()) event.name = name.trim();
      if (typeof date === 'string' && date.trim()) event.date = date.trim();
      if (typeof venue === 'string' && venue.trim()) event.venue = venue.trim();
      if (typeof organizer === 'string' && organizer.trim()) event.organizer = organizer.trim();
      if (typeof description === 'string') event.description = description.trim();
      if (status === 'Upcoming' || status === 'Live' || status === 'Completed') {
        event.status = status;
      }
      saveDatabase(db);
      const liveStats = await getLiveStatsFromC(db, db.activeEventId);
      res.json({ event, db, liveStats });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/events/:id', async (req, res) => {
    try {
      const db = loadDatabase();
      if (db.events.length <= 1) {
        res.status(400).json({ error: 'At least one event must remain in the system.' });
        return;
      }
      const idx = db.events.findIndex((e) => e.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Event not found.' });
        return;
      }
      const removedId = db.events[idx].id;
      db.events.splice(idx, 1);

      const removedTaskIds = new Set(
        db.tasks.filter((t) => t.eventId === removedId).map((t) => t.id)
      );
      db.tasks = db.tasks.filter((t) => t.eventId !== removedId);
      db.allocations = db.allocations.filter((a) => a.eventId !== removedId);
      for (const v of db.volunteers) {
        if (removedTaskIds.has(v.assignedTaskId)) {
          v.assignedTaskId = '';
          if (v.status === 'Assigned' || v.status === 'Working' || v.status === 'Reassignment Requested') {
            v.status = v.availability === 'Unavailable' ? 'Unavailable' : 'Available';
          }
        }
      }
      if (db.activeEventId === removedId) {
        db.activeEventId = db.events[0].id;
      }
      saveDatabase(db);
      const liveStats = await getLiveStatsFromC(db, db.activeEventId);
      res.json({ db, liveStats });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /* ---------------- VOLUNTEER MANAGEMENT ---------------- */
  app.post('/api/volunteers', async (req, res) => {
    try {
      const body = req.body ?? {};
      if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
        res.status(400).json({ error: 'Full Name is required.' });
        return;
      }
      if (!body.email || typeof body.email !== 'string' || !body.email.includes('@')) {
        res.status(400).json({ error: 'Valid Email address is required.' });
        return;
      }
      if (!body.skills || typeof body.skills !== 'string' || !body.skills.trim()) {
        res.status(400).json({ error: 'At least one skill is required.' });
        return;
      }

      const db = loadDatabase();
      if (body.id && db.volunteers.some((v) => v.id === String(body.id).trim())) {
        res.status(409).json({ error: `Volunteer ID ${body.id} already exists.` });
        return;
      }

      const volunteer = createVolunteerRecord(db, body);
      db.volunteers.push(volunteer);
      saveDatabase(db);
      const liveStats = await getLiveStatsFromC(db, db.activeEventId);
      res.status(201).json({ volunteer, db, liveStats });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/volunteers/import-csv', async (req, res) => {
    try {
      const { csvText } = req.body ?? {};
      if (!csvText || typeof csvText !== 'string' || !csvText.trim()) {
        res.status(400).json({ error: 'CSV content is empty.' });
        return;
      }
      const rows = parseCsvRows(csvText);
      if (rows.length < 2) {
        res.status(400).json({ error: 'CSV must include a header row and at least one volunteer row.' });
        return;
      }

      const headers = rows[0].map((h) => h.toLowerCase());
      const findCol = (keywords: string[]) =>
        headers.findIndex((h) => keywords.some((k) => h.includes(k)));

      const colId = findCol(['volunteer id', 'id']);
      const colName = findCol(['full name', 'name']);
      const colEmail = findCol(['email']);
      const colContact = findCol(['contact', 'phone', 'mobile']);
      const colPrefTasks = findCol(['preferred task', 'task']);
      const colSkills = findCol(['skill']);
      const colExp = findCol(['experience']);
      const colAvail = findCol(['availability']);
      const colSlot = findCol(['time slot', 'slot', 'preferred time']);

      if (colName === -1 || colSkills === -1) {
        res.status(400).json({
          error: 'CSV header must contain at least "Full Name" and "Skills" columns.',
        });
        return;
      }

      const db = loadDatabase();
      let added = 0;
      let updated = 0;
      let skipped = 0;

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const name = (r[colName] || '').trim();
        const skills = (r[colSkills] || '').trim();
        if (!name || !skills) {
          skipped++;
          continue;
        }

        const rawId = colId !== -1 ? (r[colId] || '').trim() : '';
        const email = colEmail !== -1 ? (r[colEmail] || '').trim() : '';
        const contact = colContact !== -1 ? (r[colContact] || '').trim() : '';
        const preferredTasks = colPrefTasks !== -1 ? (r[colPrefTasks] || '').trim() : '';
        const experience = colExp !== -1 ? (r[colExp] || '').trim() : '0 events';
        const availability = validateAvailability(colAvail !== -1 ? r[colAvail] : 'Available');
        const preferredSlot = colSlot !== -1 ? (r[colSlot] || 'Full Day').trim() : 'Full Day';

        const existing = rawId
          ? db.volunteers.find((v) => v.id.toLowerCase() === rawId.toLowerCase())
          : db.volunteers.find((v) => email && v.email.toLowerCase() === email.toLowerCase());

        if (existing) {
          existing.name = name;
          if (email) existing.email = email;
          if (contact) existing.contact = contact;
          if (preferredTasks) existing.preferredTasks = preferredTasks;
          existing.skills = skills;
          if (experience) existing.experience = experience;
          existing.availability = availability;
          existing.preferredSlot = preferredSlot;
          if (availability === 'Unavailable' && !existing.assignedTaskId) {
            existing.status = 'Unavailable';
          }
          updated++;
        } else {
          const vol = createVolunteerRecord(db, {
            id: rawId || nextSequentialId('VOL', db.volunteers.map((v) => v.id)),
            name,
            email: email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@college.edu`,
            contact: contact || 'N/A',
            preferredTasks,
            skills,
            experience,
            availability,
            preferredSlot,
            status: availability === 'Unavailable' ? 'Unavailable' : 'Available',
            currentWorkload: 0,
          });
          db.volunteers.push(vol);
          added++;
        }
      }

      saveDatabase(db);
      const liveStats = await getLiveStatsFromC(db, db.activeEventId);
      res.json({ imported: { added, updated, skipped }, db, liveStats });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.patch('/api/volunteers/:id', async (req, res) => {
    try {
      const db = loadDatabase();
      const vol = db.volunteers.find((v) => v.id === req.params.id);
      if (!vol) {
        res.status(404).json({ error: 'Volunteer not found.' });
        return;
      }
      const b = req.body ?? {};
      if (typeof b.name === 'string' && b.name.trim()) vol.name = b.name.trim();
      if (typeof b.email === 'string' && b.email.trim()) vol.email = b.email.trim();
      if (typeof b.contact === 'string') vol.contact = b.contact.trim();
      if (typeof b.preferredTasks === 'string') vol.preferredTasks = b.preferredTasks.trim();
      if (typeof b.skills === 'string' && b.skills.trim()) vol.skills = b.skills.trim();
      if (typeof b.experience === 'string') vol.experience = b.experience.trim();
      if (typeof b.preferredSlot === 'string') vol.preferredSlot = b.preferredSlot.trim();
      if (b.availability !== undefined) {
        vol.availability = validateAvailability(b.availability);
        if (vol.availability === 'Unavailable' && !vol.assignedTaskId) {
          vol.status = 'Unavailable';
        } else if (vol.availability !== 'Unavailable' && vol.status === 'Unavailable') {
          vol.status = 'Available';
        }
      }
      if (b.status !== undefined) {
        vol.status = validateVolunteerStatus(b.status);
        if (vol.status === 'Available' || vol.status === 'Completed' || vol.status === 'Unavailable') {
          vol.assignedTaskId = '';
        }
      }
      if (typeof b.currentWorkload === 'number' && b.currentWorkload >= 0) {
        vol.currentWorkload = b.currentWorkload;
      }

      syncTaskStatuses(db);
      saveDatabase(db);
      const liveStats = await getLiveStatsFromC(db, db.activeEventId);
      res.json({ volunteer: vol, db, liveStats });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/volunteers/:id', async (req, res) => {
    try {
      const db = loadDatabase();
      const idx = db.volunteers.findIndex((v) => v.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Volunteer not found.' });
        return;
      }
      db.volunteers.splice(idx, 1);
      syncTaskStatuses(db);
      saveDatabase(db);
      const liveStats = await getLiveStatsFromC(db, db.activeEventId);
      res.json({ db, liveStats });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/volunteers/:id/status', async (req, res) => {
    try {
      const db = loadDatabase();
      const vol = db.volunteers.find((v) => v.id === req.params.id);
      if (!vol) {
        res.status(404).json({ error: 'Volunteer not found.' });
        return;
      }

      const { action, reason, targetTaskId } = req.body ?? {};
      const now = new Date().toISOString();

      const findActiveAlloc = () =>
        db.allocations.find(
          (a) =>
            a.volunteerId === vol.id &&
            a.taskId === vol.assignedTaskId &&
            (a.status === 'Assigned' || a.status === 'Working')
        );

      switch (action) {
        case 'check_in': {
          if (!vol.assignedTaskId) {
            res.status(400).json({ error: 'Volunteer has no assigned task to check into.' });
            return;
          }
          vol.status = 'Working';
          const alloc = findActiveAlloc();
          if (alloc) {
            alloc.status = 'Working';
            if (!alloc.checkInTime) alloc.checkInTime = now;
          }
          break;
        }
        case 'complete_task': {
          const alloc = findActiveAlloc();
          if (alloc) {
            alloc.status = 'Completed';
            if (!alloc.checkInTime) alloc.checkInTime = now;
            alloc.completionTime = now;
          }
          vol.assignedTaskId = '';
          vol.reassignmentReason = undefined;
          vol.status = 'Completed';
          break;
        }
        case 'make_available': {
          vol.availability = 'Available';
          vol.status = 'Available';
          vol.assignedTaskId = '';
          vol.reassignmentReason = undefined;
          break;
        }
        case 'request_reassignment': {
          if (!vol.assignedTaskId) {
            res.status(400).json({ error: 'Only assigned volunteers can request reassignment.' });
            return;
          }
          vol.status = 'Reassignment Requested';
          vol.reassignmentReason =
            typeof reason === 'string' && reason.trim()
              ? reason.trim()
              : 'Requested shift reassignment by volunteer.';
          break;
        }
        case 'approve_reassignment': {
          const alloc = findActiveAlloc();
          if (alloc) {
            alloc.status = 'Reassigned';
            alloc.completionTime = now;
          }
          vol.assignedTaskId = '';
          vol.reassignmentReason = undefined;
          vol.status = 'Available';

          if (typeof targetTaskId === 'string' && targetTaskId.trim()) {
            const check = await verifyAllocationWithC(db, db.activeEventId, vol.id, targetTaskId.trim());
            if (!check.allowed) {
              res.status(400).json({ error: check.reason || 'Cannot assign to target task.' });
              return;
            }
            const task = db.tasks.find((t) => t.id === targetTaskId.trim());
            const event = db.events.find((e) => e.id === db.activeEventId);
            if (task && event) {
              vol.status = 'Assigned';
              vol.assignedTaskId = task.id;
              vol.currentWorkload = check.updatedWorkload ?? vol.currentWorkload + task.durationHours;
              recordAllocation(db, {
                eventId: event.id,
                eventName: event.name,
                volunteerId: vol.id,
                volunteerName: vol.name,
                taskId: task.id,
                taskName: task.name,
                requiredSkills: task.requiredSkills,
                matchedSkills: check.matchedSkills || 'General',
                compatibilityScore: check.compatibilityScore ?? 0,
                finalScore: check.finalScore ?? 0,
                previousWorkload: check.previousWorkload ?? 0,
                updatedWorkload: vol.currentWorkload,
                checkInTime: '',
                completionTime: '',
                status: 'Assigned',
              });
            }
          }
          break;
        }
        case 'reject_reassignment': {
          const alloc = findActiveAlloc();
          vol.status = alloc?.status === 'Working' ? 'Working' : 'Assigned';
          vol.reassignmentReason = undefined;
          break;
        }
        case 'report_unavailable': {
          const alloc = findActiveAlloc();
          if (alloc) {
            alloc.status = 'Cancelled';
            alloc.completionTime = now;
          }
          vol.assignedTaskId = '';
          vol.reassignmentReason = undefined;
          vol.availability = 'Unavailable';
          vol.status = 'Unavailable';
          break;
        }
        default:
          res.status(400).json({ error: 'Invalid status action.' });
          return;
      }

      syncTaskStatuses(db);
      saveDatabase(db);
      const liveStats = await getLiveStatsFromC(db, db.activeEventId);
      res.json({ volunteer: vol, db, liveStats });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /* ---------------- TASK MANAGEMENT ---------------- */
  app.post('/api/tasks', async (req, res) => {
    try {
      const b = req.body ?? {};
      if (!b.name || typeof b.name !== 'string' || !b.name.trim()) {
        res.status(400).json({ error: 'Task Name is required.' });
        return;
      }
      if (!b.requiredSkills || typeof b.requiredSkills !== 'string' || !b.requiredSkills.trim()) {
        res.status(400).json({ error: 'Required Skills are required.' });
        return;
      }

      const db = loadDatabase();
      const task = createTaskRecord(db, {
        ...b,
        eventId: b.eventId || db.activeEventId,
      });
      db.tasks.push(task);
      syncTaskStatuses(db);
      saveDatabase(db);
      const liveStats = await getLiveStatsFromC(db, db.activeEventId);
      res.status(201).json({ task, db, liveStats });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.patch('/api/tasks/:id', async (req, res) => {
    try {
      const db = loadDatabase();
      const task = db.tasks.find((t) => t.id === req.params.id);
      if (!task) {
        res.status(404).json({ error: 'Task not found.' });
        return;
      }

      const b = req.body ?? {};
      if (typeof b.name === 'string' && b.name.trim()) task.name = b.name.trim();
      if (typeof b.description === 'string') task.description = b.description.trim();
      if (typeof b.requiredSkills === 'string' && b.requiredSkills.trim()) {
        task.requiredSkills = b.requiredSkills.trim();
      }
      if (b.requiredVolunteers !== undefined) {
        task.requiredVolunteers = Math.max(1, Math.min(200, Number(b.requiredVolunteers) || 1));
      }
      if (b.priority !== undefined) task.priority = validateTaskPriority(b.priority);
      if (typeof b.location === 'string' && b.location.trim()) task.location = b.location.trim();
      if (b.durationHours !== undefined) {
        task.durationHours = Math.max(0.5, Math.min(24, Number(b.durationHours) || 1));
      }
      if (typeof b.startTime === 'string') task.startTime = b.startTime.trim();
      if (typeof b.endTime === 'string') task.endTime = b.endTime.trim();
      if (b.status !== undefined) task.status = validateTaskStatus(b.status);

      /* If task is marked Completed, complete active volunteer assignments */
      if (task.status === 'Completed') {
        const now = new Date().toISOString();
        for (const v of db.volunteers) {
          if (v.assignedTaskId === task.id) {
            v.assignedTaskId = '';
            v.status = 'Completed';
          }
        }
        for (const a of db.allocations) {
          if (a.taskId === task.id && (a.status === 'Assigned' || a.status === 'Working')) {
            a.status = 'Completed';
            if (!a.checkInTime) a.checkInTime = now;
            a.completionTime = now;
          }
        }
      } else {
        syncTaskStatuses(db);
      }

      saveDatabase(db);
      const liveStats = await getLiveStatsFromC(db, db.activeEventId);
      res.json({ task, db, liveStats });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/tasks/:id', async (req, res) => {
    try {
      const db = loadDatabase();
      const idx = db.tasks.findIndex((t) => t.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Task not found.' });
        return;
      }
      const taskId = db.tasks[idx].id;
      db.tasks.splice(idx, 1);

      for (const v of db.volunteers) {
        if (v.assignedTaskId === taskId) {
          v.assignedTaskId = '';
          if (v.status === 'Assigned' || v.status === 'Working' || v.status === 'Reassignment Requested') {
            v.status = v.availability === 'Unavailable' ? 'Unavailable' : 'Available';
          }
        }
      }
      syncTaskStatuses(db);
      saveDatabase(db);
      const liveStats = await getLiveStatsFromC(db, db.activeEventId);
      res.json({ db, liveStats });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /* ---------------- C ENGINE ALLOCATION & ANALYTICS ---------------- */
  app.get('/api/c-engine/recommend/:taskId', async (req, res) => {
    try {
      const db = loadDatabase();
      const eventId =
        typeof req.query.eventId === 'string' && req.query.eventId
          ? req.query.eventId
          : db.activeEventId;
      const result = await getRecommendationsFromC(db, eventId, req.params.taskId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/c-engine/allocate', async (req, res) => {
    try {
      const { volunteerId, taskId } = req.body ?? {};
      if (!volunteerId || !taskId) {
        res.status(400).json({ error: 'volunteerId and taskId are required.' });
        return;
      }

      const db = loadDatabase();
      const check = await verifyAllocationWithC(db, db.activeEventId, String(volunteerId), String(taskId));
      if (!check.allowed) {
        res.status(400).json({ error: check.reason || 'Allocation rejected by C engine.' });
        return;
      }

      const vol = db.volunteers.find((v) => v.id === volunteerId);
      const task = db.tasks.find((t) => t.id === taskId);
      const event = db.events.find((e) => e.id === (task?.eventId || db.activeEventId));
      if (!vol || !task || !event) {
        res.status(404).json({ error: 'Volunteer, task, or event not found.' });
        return;
      }

      vol.status = 'Assigned';
      vol.assignedTaskId = task.id;
      vol.reassignmentReason = undefined;
      vol.currentWorkload = check.updatedWorkload ?? vol.currentWorkload + task.durationHours;

      const allocation = recordAllocation(db, {
        eventId: event.id,
        eventName: event.name,
        volunteerId: vol.id,
        volunteerName: vol.name,
        taskId: task.id,
        taskName: task.name,
        requiredSkills: task.requiredSkills,
        matchedSkills: check.matchedSkills || 'General',
        compatibilityScore: check.compatibilityScore ?? 0,
        finalScore: check.finalScore ?? 0,
        previousWorkload: check.previousWorkload ?? 0,
        updatedWorkload: vol.currentWorkload,
        checkInTime: '',
        completionTime: '',
        status: 'Assigned',
      });

      syncTaskStatuses(db);
      saveDatabase(db);
      const liveStats = await getLiveStatsFromC(db, db.activeEventId);
      res.status(201).json({ allocation, check, db, liveStats });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/c-engine/optimize', async (req, res) => {
    try {
      const db = loadDatabase();
      const eventId =
        typeof req.query.eventId === 'string' && req.query.eventId
          ? req.query.eventId
          : db.activeEventId;
      const result = await getOptimizationFromC(db, eventId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/c-engine/analytics', async (req, res) => {
    try {
      const db = loadDatabase();
      const eventId =
        typeof req.query.eventId === 'string' && req.query.eventId
          ? req.query.eventId
          : db.activeEventId;
      const result = await getAnalyticsFromC(db, eventId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/c-engine/sources', (_req, res) => {
    try {
      const files = readCSourceFiles();
      res.json({ files });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/c-engine/run-tests', async (_req, res) => {
    try {
      const results = await runCTestSuite();
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.resolve(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CampusCrew server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
