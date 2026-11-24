export type VolunteerStatus =
  | 'Available'
  | 'Assigned'
  | 'Working'
  | 'Completed'
  | 'Unavailable'
  | 'Reassignment Requested';

export type AvailabilityType = 'Available' | 'Limited' | 'Unavailable';

export type TaskPriority = 'High' | 'Medium' | 'Low';

export type TaskStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Fully Staffed'
  | 'Needs Volunteers'
  | 'Completed';

export interface EventRecord {
  id: string;
  name: string;
  date: string;
  venue: string;
  organizer: string;
  description: string;
  status: 'Upcoming' | 'Live' | 'Completed';
  createdAt: string;
}

export interface VolunteerRecord {
  id: string;
  eventId: string;
  name: string;
  email: string;
  contact: string;
  preferredTasks: string;
  skills: string;
  experience: string;
  availability: AvailabilityType;
  preferredSlot: string;
  status: VolunteerStatus;
  assignedTaskId: string;
  currentWorkload: number;
  reassignmentReason?: string;
}

export interface TaskRecord {
  id: string;
  eventId: string;
  name: string;
  description: string;
  requiredSkills: string;
  requiredVolunteers: number;
  priority: TaskPriority;
  location: string;
  durationHours: number;
  startTime: string;
  endTime: string;
  status: TaskStatus;
}

export interface AllocationRecord {
  id: string;
  eventId: string;
  eventName: string;
  volunteerId: string;
  volunteerName: string;
  taskId: string;
  taskName: string;
  requiredSkills: string;
  matchedSkills: string;
  compatibilityScore: number;
  finalScore: number;
  previousWorkload: number;
  updatedWorkload: number;
  checkInTime: string;
  completionTime: string;
  status: 'Assigned' | 'Working' | 'Completed' | 'Reassigned' | 'Cancelled';
  createdAt: string;
}

export interface LiveTaskStaffing {
  taskId: string;
  taskName: string;
  priority: string;
  location: string;
  status: string;
  staffingState: 'Fully Staffed' | 'Understaffed' | 'Overstaffed' | 'Unassigned' | 'Completed';
  required: number;
  assignedActive: number;
  working: number;
  needed: number;
  excess: number;
}

export interface LiveStatsResponse {
  engine: string;
  eventId: string;
  eventName: string;
  taskStaffing: LiveTaskStaffing[];
  summary: {
    totalRegisteredVolunteers: number;
    currentlyWorking: number;
    availableVolunteers: number;
    assignedVolunteers: number;
    completedVolunteers: number;
    unavailableVolunteers: number;
    reassignmentRequested: number;
    tasksCompleted: number;
    tasksInProgress: number;
    tasksRequiringVolunteers: number;
    totalVolunteersNeeded: number;
    fullyStaffedTasks: number;
    understaffedTasks: number;
    overstaffedTasks: number;
    unassignedTasks: number;
  };
}

export interface CandidateRecommendation {
  rank: number;
  volunteerId: string;
  volunteerName: string;
  skills: string;
  matchedSkills: string;
  matchedCount: number;
  requiredCount: number;
  preferredMatch: boolean;
  currentWorkload: number;
  compatibilityScore: number;
  loadPreference: number;
  finalScore: number;
  explanation: string;
}

export interface RecommendResponse {
  engine: string;
  taskId: string;
  taskName: string;
  requiredSkills: string;
  candidateCount: number;
  candidates: CandidateRecommendation[];
  error?: string;
}

export interface OptimizeUnderstaffedItem {
  taskId: string;
  taskName: string;
  priority: string;
  required: number;
  currentlyWorking: number;
  currentlyActive: number;
  needed: number;
  recommendedVolunteers: Array<{
    rank: number;
    volunteerId: string;
    volunteerName: string;
    matchedSkills: string;
    currentWorkload: number;
    compatibilityScore: number;
    finalScore: number;
    explanation: string;
  }>;
}

export interface OptimizeOverstaffedItem {
  taskId: string;
  taskName: string;
  required: number;
  assignedActive: number;
  excess: number;
}

export interface OptimizeResponse {
  engine: string;
  queueSize: number;
  understaffedRecommendations: OptimizeUnderstaffedItem[];
  overstaffedTasks: OptimizeOverstaffedItem[];
}

export interface AnalyticsResponse {
  engine: string;
  volunteerWorkloads: Array<{
    volunteerId: string;
    name: string;
    status: string;
    currentWorkload: number;
    beforeAllocationWorkload: number;
    category: 'Underutilized' | 'Balanced' | 'Overloaded';
  }>;
  taskDistribution: Array<{
    taskId: string;
    taskName: string;
    required: number;
    assigned: number;
    durationHours: number;
  }>;
  summary: {
    totalVolunteers: number;
    averageWorkload: number;
    underutilizedCount: number;
    balancedCount: number;
    overloadedCount: number;
  };
}

export interface CTestResult {
  id: string;
  title: string;
  dataStructures: string;
  details: string;
  status: 'PASS' | 'FAIL';
  passed: boolean;
}

export interface CTestSuiteResponse {
  suite: string;
  compiler: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  results: CTestResult[];
}

export interface CSourceFile {
  filename: string;
  language: 'c' | 'h' | 'makefile';
  role: string;
  content: string;
}

export interface AppDatabase {
  activeEventId: string;
  events: EventRecord[];
  volunteers: VolunteerRecord[];
  tasks: TaskRecord[];
  allocations: AllocationRecord[];
}
