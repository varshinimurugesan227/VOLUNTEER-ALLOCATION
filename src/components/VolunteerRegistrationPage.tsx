import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Download,
  Edit3,
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../api';
import type {
  AppDatabase,
  AvailabilityType,
  LiveStatsResponse,
  VolunteerRecord,
} from '../types';
import { StatusText } from './StatusText';

interface VolunteerRegistrationPageProps {
  db: AppDatabase;
  onStateChange: (db: AppDatabase, liveStats: LiveStatsResponse) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

const SAMPLE_GOOGLE_FORM_CSV = `Volunteer ID,Full Name,Email,Contact Number,Preferred Tasks,Skills,Experience,Availability,Preferred Time Slot
VOL-121,Lakshmi Narayanan,lakshmi.n@college.edu,9845099001,"Photography, Stage Management","DSLR Photography, Video Editing, Lighting",2 events,Available,Full Day
VOL-122,Pranav Deshpande,pranav.d@college.edu,9845099002,"Technical Support, Crowd Management","Networking, Troubleshooting, Crowd Handling",1 symposium,Available,Morning (08:00-13:00)
VOL-123,Harshita Rao,harshita.r@college.edu,9845099003,"Food Management, Hospitality","Catering, Logistics, Guest Relations",3 events,Limited,Afternoon (12:00-18:00)`;

export function VolunteerRegistrationPage({
  db,
  onStateChange,
  onNotify,
}: VolunteerRegistrationPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('All');
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);

  // Add/Edit form state
  const [editingVol, setEditingVol] = useState<VolunteerRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formPreferredTasks, setFormPreferredTasks] = useState('');
  const [formSkills, setFormSkills] = useState('');
  const [formExperience, setFormExperience] = useState('');
  const [formAvailability, setFormAvailability] = useState<AvailabilityType>('Available');
  const [formSlot, setFormSlot] = useState('Full Day');

  const openAddForm = () => {
    setEditingVol(null);
    setFormId('');
    setFormName('');
    setFormEmail('');
    setFormContact('');
    setFormPreferredTasks('');
    setFormSkills('');
    setFormExperience('1 event');
    setFormAvailability('Available');
    setFormSlot('Full Day');
    setShowForm(true);
  };

  const openEditForm = (v: VolunteerRecord) => {
    setEditingVol(v);
    setFormId(v.id);
    setFormName(v.name);
    setFormEmail(v.email);
    setFormContact(v.contact);
    setFormPreferredTasks(v.preferredTasks);
    setFormSkills(v.skills);
    setFormExperience(v.experience);
    setFormAvailability(v.availability);
    setFormSlot(v.preferredSlot);
    setShowForm(true);
  };

  const handleSaveVolunteer = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingVol) {
        const res = await api.updateVolunteer(editingVol.id, {
          name: formName,
          email: formEmail,
          contact: formContact,
          preferredTasks: formPreferredTasks,
          skills: formSkills,
          experience: formExperience,
          availability: formAvailability,
          preferredSlot: formSlot,
        });
        onStateChange(res.db, res.liveStats);
        onNotify(`Updated volunteer ${formName}.`);
      } else {
        const res = await api.createVolunteer({
          id: formId || undefined,
          name: formName,
          email: formEmail,
          contact: formContact,
          preferredTasks: formPreferredTasks,
          skills: formSkills,
          experience: formExperience,
          availability: formAvailability,
          preferredSlot: formSlot,
        });
        onStateChange(res.db, res.liveStats);
        onNotify(`Registered volunteer ${res.volunteer.name} (${res.volunteer.id}).`);
      }
      setShowForm(false);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    await runCsvImport(text);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const runCsvImport = async (rawCsv: string) => {
    if (!rawCsv.trim()) {
      onNotify('Please select or paste Google Forms CSV data.', 'error');
      return;
    }
    setImporting(true);
    try {
      const res = await api.importVolunteersCsv(rawCsv);
      onStateChange(res.db, res.liveStats);
      setCsvText('');
      onNotify(
        `CSV Import complete: ${res.imported.added} added, ${res.imported.updated} updated, ${res.imported.skipped} skipped.`
      );
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_GOOGLE_FORM_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'google_forms_volunteer_responses_sample.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAvailabilityChange = async (id: string, availability: AvailabilityType) => {
    try {
      const res = await api.updateVolunteer(id, { availability });
      onStateChange(res.db, res.liveStats);
      onNotify(`Updated availability for ${id} to ${availability}.`);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await api.deleteVolunteer(id);
      onStateChange(res.db, res.liveStats);
      onNotify(`Deleted volunteer ${name} (${id}).`);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const filtered = db.volunteers.filter((v) => {
    const matchesAvail =
      availabilityFilter === 'All' || v.availability === availabilityFilter;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return matchesAvail;
    return (
      matchesAvail &&
      (v.id.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q) ||
        v.email.toLowerCase().includes(q) ||
        v.skills.toLowerCase().includes(q) ||
        v.preferredTasks.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Volunteer Registration (Before the Event)
          </h2>
          <p className="text-sm text-slate-600">
            Import Google Forms registration CSV responses or manually register, edit, and verify student volunteers.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Volunteer</span>
        </button>
      </div>

      {/* Google Forms CSV Import Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Google Forms CSV Import
              </h3>
              <p className="text-xs text-slate-500">
                Expected columns: Volunteer ID, Full Name, Email, Contact Number, Preferred Tasks, Skills, Experience, Availability, Preferred Time Slot
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadSampleCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Sample CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setCsvText(SAMPLE_GOOGLE_FORM_CSV)}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap"
            >
              Load Sample CSV into Editor
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload CSV File</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <textarea
            rows={3}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Or paste exported Google Forms CSV rows here..."
            className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {csvText.trim() && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={importing}
                onClick={() => runCsvImport(csvText)}
                className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {importing ? 'Importing...' : 'Import Pasted CSV'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal for Manual Add / Edit Volunteer */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingVol ? `Edit Volunteer (${editingVol.id})` : 'Register New Volunteer'}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVolunteer} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Volunteer ID {editingVol ? '(Locked)' : '(Auto if blank)'}
                  </label>
                  <input
                    type="text"
                    disabled={Boolean(editingVol)}
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    placeholder="VOL-125"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Student Full Name"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="student@college.edu"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    placeholder="9845000000"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Registered Skills * (comma-separated)
                </label>
                <input
                  type="text"
                  required
                  value={formSkills}
                  onChange={(e) => setFormSkills(e.target.value)}
                  placeholder="Communication, Networking, AV Setup"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Preferred Tasks (comma-separated)
                </label>
                <input
                  type="text"
                  value={formPreferredTasks}
                  onChange={(e) => setFormPreferredTasks(e.target.value)}
                  placeholder="Technical Support, Stage Management"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Experience
                  </label>
                  <input
                    type="text"
                    value={formExperience}
                    onChange={(e) => setFormExperience(e.target.value)}
                    placeholder="2 events"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Availability
                  </label>
                  <select
                    value={formAvailability}
                    onChange={(e) => setFormAvailability(e.target.value as AvailabilityType)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Available">Available</option>
                    <option value="Limited">Limited</option>
                    <option value="Unavailable">Unavailable</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Preferred Time Slot
                  </label>
                  <input
                    type="text"
                    value={formSlot}
                    onChange={(e) => setFormSlot(e.target.value)}
                    placeholder="Full Day"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  {editingVol ? 'Save Changes' : 'Register Volunteer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search & Registered Volunteer Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, name, email, skills, or preferred task..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {['All', 'Available', 'Limited', 'Unavailable'].map((avail) => (
              <button
                key={avail}
                type="button"
                onClick={() => setAvailabilityFilter(avail)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  availabilityFilter === avail
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {avail}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Volunteer</th>
                <th className="py-3 px-4">Registered Skills</th>
                <th className="py-3 px-4">Preferred Tasks</th>
                <th className="py-3 px-4">Time Slot</th>
                <th className="py-3 px-4">Availability</th>
                <th className="py-3 px-4">Current Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                    {v.id}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{v.name}</div>
                    <div className="text-xs text-slate-500">
                      {v.email} · {v.contact}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700 max-w-xs">{v.skills}</td>
                  <td className="py-3 px-4 text-xs text-slate-600 max-w-xs">
                    {v.preferredTasks || 'Any'}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                    {v.preferredSlot}
                    <div className="text-slate-400">{v.experience}</div>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      aria-label={`Availability for ${v.name}`}
                      value={v.availability}
                      onChange={(e) =>
                        handleAvailabilityChange(v.id, e.target.value as AvailabilityType)
                      }
                      className="px-2 py-1 text-xs border border-slate-300 rounded-md bg-white text-slate-700"
                    >
                      <option value="Available">Available</option>
                      <option value="Limited">Limited</option>
                      <option value="Unavailable">Unavailable</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <StatusText status={v.status} />
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEditForm(v)}
                      title="Edit volunteer"
                      className="p-1.5 text-slate-500 hover:text-blue-600 rounded-md hover:bg-blue-50"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(v.id, v.name)}
                      title="Delete volunteer"
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 ml-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-slate-500">
                    No volunteer records match your current search or filter.
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
