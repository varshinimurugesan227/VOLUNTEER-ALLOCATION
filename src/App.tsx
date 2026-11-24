import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Code2,
  FileText,
  LayoutDashboard,
  Menu,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { api } from './api';
import { AllocationReportsPage } from './components/AllocationReportsPage';
import { CCodeTestSuitePage } from './components/CCodeTestSuitePage';
import { EventManagementPage } from './components/EventManagementPage';
import { LiveControlCenterPage } from './components/LiveControlCenterPage';
import { OverviewPage } from './components/OverviewPage';
import { SmartAllocationPage } from './components/SmartAllocationPage';
import { TaskManagementPage } from './components/TaskManagementPage';
import { VolunteerManagementPage } from './components/VolunteerManagementPage';
import { VolunteerPortalPage } from './components/VolunteerPortalPage';
import { VolunteerRegistrationPage } from './components/VolunteerRegistrationPage';
import { WorkloadAnalyticsPage } from './components/WorkloadAnalyticsPage';
import type { AppDatabase, LiveStatsResponse } from './types';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'events', label: 'Event Management', icon: CalendarDays },
  { id: 'registration', label: 'Volunteer Registration', icon: UserPlus },
  { id: 'volunteers', label: 'Volunteer Management', icon: Users },
  { id: 'tasks', label: 'Task Management', icon: ClipboardList },
  { id: 'live-control', label: 'Live Event Control Center', icon: Activity },
  { id: 'smart-allocation', label: 'Smart Allocation', icon: Sparkles },
  { id: 'analytics', label: 'Workload Analytics', icon: BarChart3 },
  { id: 'reports', label: 'Allocation Reports', icon: FileText },
  { id: 'c-code', label: 'C Code & Test Suite', icon: Code2 },
] as const;

type NavId = (typeof NAV_ITEMS)[number]['id'];

export default function App() {
  const [role, setRole] = useState<'organizer' | 'volunteer'>('organizer');
  const [activeNav, setActiveNav] = useState<NavId>('overview');
  const [selectedTaskForAlloc, setSelectedTaskForAlloc] = useState<string | undefined>(undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [db, setDb] = useState<AppDatabase | null>(null);
  const [liveStats, setLiveStats] = useState<LiveStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast((prev) => (prev?.msg === msg ? null : prev));
    }, 4500);
  }, []);

  const refreshState = useCallback(async (eventId?: string) => {
    try {
      const res = await api.getState(eventId);
      setDb(res.db);
      setLiveStats(res.liveStats);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const handleStateChange = useCallback(
    (nextDb: AppDatabase, nextStats: LiveStatsResponse) => {
      setDb(nextDb);
      setLiveStats(nextStats);
    },
    []
  );

  const handleSelectTaskForAllocation = (taskId: string) => {
    setSelectedTaskForAlloc(taskId);
    setActiveNav('smart-allocation');
  };

  const handleEventSwitch = async (eventId: string) => {
    try {
      const res = await api.activateEvent(eventId);
      setSelectedTaskForAlloc(undefined);
      handleStateChange(res.db, res.liveStats);
      notify('Switched active event.');
    } catch (err) {
      notify((err as Error).message, 'error');
    }
  };

  const activeNavLabel = NAV_ITEMS.find((n) => n.id === activeNav)?.label || 'Overview';
  const reassignmentCount =
    db?.volunteers.filter(
      (v) => v.eventId === db.activeEventId && v.status === 'Reassignment Requested'
    ).length || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-5 text-sm text-slate-600">
          Initializing CampusCrew C Data Structures Engine...
        </div>
      </div>
    );
  }

  if (error || !db || !liveStats) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-red-200 rounded-xl p-6 max-w-md w-full space-y-3">
          <h1 className="text-base font-semibold text-red-700">Failed to load backend state</h1>
          <p className="text-sm text-slate-600">{error || 'Unknown server error'}</p>
          <button
            type="button"
            onClick={() => refreshState()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && role === 'organizer' && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Organizer Mode) */}
      {role === 'organizer' && (
        <aside
          className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-150 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between shrink-0">
            <span className="text-lg font-bold tracking-tight text-blue-700 whitespace-nowrap">
              CampusCrew
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 lg:hidden"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveNav(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-blue-600' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.id === 'volunteers' && reassignmentCount > 0 && (
                    <span className="text-xs font-mono font-semibold text-amber-700 shrink-0">
                      {reassignmentCount}
                    </span>
                  )}
                  {item.id === 'live-control' && liveStats.summary.totalVolunteersNeeded > 0 && (
                    <span className="text-xs font-mono font-semibold text-red-700 shrink-0">
                      -{liveStats.summary.totalVolunteersNeeded}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
            <div className="font-semibold text-slate-700">CSA0302 Data Structures</div>
            <div>C11 Engine · GCC Compiled</div>
          </div>
        </aside>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            {role === 'organizer' ? (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 -ml-2 text-slate-600 hover:text-slate-900 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="w-5 h-5" />
              </button>
            ) : (
              <span className="text-lg font-bold tracking-tight text-blue-700 whitespace-nowrap">
                CampusCrew
              </span>
            )}

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">
                {role === 'organizer' ? 'Organizer' : 'Volunteer'}
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 truncate">
                {role === 'organizer' ? activeNavLabel : 'Volunteer Portal'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {role === 'organizer' && db.events.length > 0 && (
              <select
                aria-label="Active Event"
                value={db.activeEventId}
                onChange={(e) => handleEventSwitch(e.target.value)}
                className="hidden md:block px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700 max-w-[200px]"
              >
                {db.events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setRole('organizer')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  role === 'organizer'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Organizer</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('volunteer')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  role === 'volunteer'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Volunteer</span>
              </button>
            </div>
          </div>
        </header>

        {/* Toast Notification */}
        {toast && (
          <div className="px-4 sm:px-6 pt-4 no-print">
            <div
              className={`px-4 py-2.5 rounded-lg border text-xs font-medium flex items-center justify-between ${
                toast.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <span>{toast.msg}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="ml-4 text-current opacity-70 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {role === 'volunteer' ? (
            <VolunteerPortalPage
              db={db}
              onStateChange={handleStateChange}
              onNotify={notify}
            />
          ) : (
            <>
              {activeNav === 'overview' && (
                <OverviewPage
                  db={db}
                  liveStats={liveStats}
                  onNavigate={(tab) => setActiveNav(tab as NavId)}
                />
              )}
              {activeNav === 'events' && (
                <EventManagementPage
                  db={db}
                  onStateChange={handleStateChange}
                  onNotify={notify}
                />
              )}
              {activeNav === 'registration' && (
                <VolunteerRegistrationPage
                  db={db}
                  onStateChange={handleStateChange}
                  onNotify={notify}
                />
              )}
              {activeNav === 'volunteers' && (
                <VolunteerManagementPage
                  db={db}
                  onStateChange={handleStateChange}
                  onNotify={notify}
                />
              )}
              {activeNav === 'tasks' && (
                <TaskManagementPage
                  db={db}
                  liveStats={liveStats}
                  onStateChange={handleStateChange}
                  onNotify={notify}
                />
              )}
              {activeNav === 'live-control' && (
                <LiveControlCenterPage
                  liveStats={liveStats}
                  onRefresh={() => refreshState(db.activeEventId)}
                  onSelectTaskForAllocation={handleSelectTaskForAllocation}
                />
              )}
              {activeNav === 'smart-allocation' && (
                <SmartAllocationPage
                  db={db}
                  liveStats={liveStats}
                  initialTaskId={selectedTaskForAlloc}
                  onStateChange={handleStateChange}
                  onNotify={notify}
                />
              )}
              {activeNav === 'analytics' && (
                <WorkloadAnalyticsPage db={db} onNotify={notify} />
              )}
              {activeNav === 'reports' && (
                <AllocationReportsPage db={db} liveStats={liveStats} />
              )}
              {activeNav === 'c-code' && <CCodeTestSuitePage onNotify={notify} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
