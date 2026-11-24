import { useEffect, useState } from 'react';
import { Code2, Play, Terminal } from 'lucide-react';
import { api } from '../api';
import type { CSourceFile, CTestSuiteResponse } from '../types';
import { StatusText } from './StatusText';

interface CCodeTestSuitePageProps {
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

const COMPLEXITY_ROWS = [
  {
    item: 'Volunteer Singly Linked List',
    ops: 'Insert, Search, Delete, Traverse, Update Availability',
    time: 'Insert O(n) tail / Search O(n) / Delete O(n)',
    space: 'O(V) pointers',
  },
  {
    item: 'Task Singly Linked List',
    ops: 'Insert, Search, Delete, Traverse, Status Update',
    time: 'O(T) search & traversal',
    space: 'O(T) pointers',
  },
  {
    item: 'FIFO Linked Queue',
    ops: 'Enqueue, Dequeue, Front, Rear, IsEmpty',
    time: 'O(1) per enqueue / dequeue',
    space: 'O(T) queue nodes',
  },
  {
    item: 'Allocation Record Linked List',
    ops: 'Insert History, Search, Duplicate Guard',
    time: 'O(A) duplicate verification',
    space: 'O(A) records',
  },
  {
    item: 'Skill Matching + Weighted Scoring',
    ops: 'Tokenize CSV skills, score 0.7×Compat + 0.3×Load',
    time: 'O(V × S_req × S_vol)',
    space: 'O(V) candidate array',
  },
  {
    item: 'Bubble Sort Candidate Ranking',
    ops: 'Sort eligible candidates descending by Final Score',
    time: 'O(k²) worst, O(k) best (early exit)',
    space: 'O(1) in-place swap',
  },
  {
    item: 'Greedy Selection & Workload Balancing',
    ops: 'FIFO dequeue understaffed tasks & pick rank #1',
    time: 'O(T × V + T × k²)',
    space: 'O(T + V)',
  },
];

export function CCodeTestSuitePage({ onNotify }: CCodeTestSuitePageProps) {
  const [sources, setSources] = useState<CSourceFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('allocation.c');
  const [testSuite, setTestSuite] = useState<CTestSuiteResponse | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  useEffect(() => {
    api
      .getCSources()
      .then((res) => {
        setSources(res.files);
        if (res.files.length > 0 && !res.files.some((f) => f.filename === selectedFile)) {
          setSelectedFile(res.files[0].filename);
        }
      })
      .catch((err) => onNotify((err as Error).message, 'error'));

    handleRunTests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunTests = async () => {
    setRunningTests(true);
    try {
      const res = await api.runCTests();
      setTestSuite(res);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setRunningTests(false);
    }
  };

  const activeSource = sources.find((f) => f.filename === selectedFile);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          C Data Structures Engine & Automated Test Suite
        </h2>
        <p className="text-sm text-slate-600">
          Modular C11 implementation (CSA0302 – Data Structures) compiled with GCC and executed directly by the Node.js backend.
        </p>
      </div>

      {/* Live C Automated Test Runner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Automated C Test Suite (./c_engine/test_runner)
            </h3>
            <p className="text-xs text-slate-500">
              {testSuite
                ? `${testSuite.compiler} · ${testSuite.passedCount}/${testSuite.totalTests} tests passed`
                : 'Executing compiled C binary...'}
            </p>
          </div>
          <button
            type="button"
            disabled={runningTests}
            onClick={handleRunTests}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{runningTests ? 'Running C Tests...' : 'Run C Test Suite'}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-3">Test ID</th>
                <th className="py-2.5 px-3">Test Case</th>
                <th className="py-2.5 px-3">Data Structures / Algorithms</th>
                <th className="py-2.5 px-3">C Execution Output</th>
                <th className="py-2.5 px-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {testSuite?.results.map((tc) => (
                <tr key={tc.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                    {tc.id}
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-900">{tc.title}</td>
                  <td className="py-3 px-3 text-slate-600">{tc.dataStructures}</td>
                  <td className="py-3 px-3 font-mono text-slate-700">{tc.details}</td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <StatusText status={tc.status} />
                  </td>
                </tr>
              ))}
              {!testSuite && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Loading C test suite output...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Architecture Flowchart + Complexity Reference */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flowcharts */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">
            Algorithm Flowcharts & Architecture
          </h3>

          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1.5">
                1. Skill-Based Matching & Bubble Sort Pipeline
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-xs text-slate-700 space-y-1">
                <div>[Task Linked List] → Read Required Skills</div>
                <div>        ↓</div>
                <div>[Traverse Volunteer Linked List] → Filter Available &amp; No Duplicate</div>
                <div>        ↓</div>
                <div>[Skill Matching] → Compatibility = (Matched / Required) × 100</div>
                <div>        ↓</div>
                <div>[Weighted Score] → 0.7×Compat + 0.3×(100 / (1 + Workload))</div>
                <div>        ↓</div>
                <div>[Bubble Sort Descending] → Return Top 3 Candidates</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1.5">
                2. FIFO Queue Workload Optimization Pipeline
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-xs text-slate-700 space-y-1">
                <div>[Traverse Tasks] → Deficit = Required − Assigned Active</div>
                <div>        ↓</div>
                <div>[FIFO Enqueue] → Queue Understaffed Tasks (Rear insertion)</div>
                <div>        ↓</div>
                <div>[While !queue_is_empty] → Dequeue Front Task</div>
                <div>        ↓</div>
                <div>[Greedy Select + Duplicate Check] → Recommend Top Available Volunteers</div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                <Terminal className="w-3.5 h-3.5 text-blue-600" />
                <span>GCC Compilation Instructions</span>
              </div>
              <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
{`cd c_engine
make clean && make
./test_runner
./volunteer_engine live_stats < snapshot.txt`}
              </pre>
            </div>
          </div>
        </div>

        {/* Time & Space Complexity */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-base font-semibold text-slate-900">
            Data Structures & Time / Space Complexity
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                  <th className="py-2.5 px-3">Component</th>
                  <th className="py-2.5 px-3">Time Complexity</th>
                  <th className="py-2.5 px-3">Space</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {COMPLEXITY_ROWS.map((row) => (
                  <tr key={row.item}>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900">{row.item}</div>
                      <div className="text-slate-500">{row.ops}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-blue-700">{row.time}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                      {row.space}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* C Source Code Viewer */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-blue-600" />
            <h3 className="text-base font-semibold text-slate-900">
              C Source Files ({sources.length} modules)
            </h3>
          </div>
          {activeSource && (
            <span className="text-xs text-slate-500">
              {activeSource.filename} — {activeSource.role}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4">
          <div className="border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50 p-2 flex lg:flex-col gap-1 overflow-x-auto">
            {sources.map((file) => (
              <button
                key={file.filename}
                type="button"
                onClick={() => setSelectedFile(file.filename)}
                className={`text-left px-3 py-2 rounded-lg text-xs font-mono transition-colors whitespace-nowrap ${
                  selectedFile === file.filename
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                {file.filename}
              </button>
            ))}
          </div>

          <div className="lg:col-span-3 bg-slate-900 text-slate-100 p-4 overflow-x-auto max-h-[540px] overflow-y-auto">
            <pre className="text-xs font-mono leading-relaxed">
              {activeSource?.content || 'Loading source file...'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
