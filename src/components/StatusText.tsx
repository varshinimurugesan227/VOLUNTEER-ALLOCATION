import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MinusCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';

interface StatusTextProps {
  status: string;
}

export function StatusText({ status }: StatusTextProps) {
  const s = status.toLowerCase();

  if (
    s === 'completed' ||
    s === 'fully staffed' ||
    s === 'available' ||
    s === 'pass' ||
    s === 'balanced'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }

  if (
    s === 'working' ||
    s === 'in progress' ||
    s === 'assigned' ||
    s === 'live' ||
    s === 'underutilized'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }

  if (
    s === 'needs volunteers' ||
    s === 'understaffed' ||
    s === 'limited' ||
    s === 'overstaffed' ||
    s === 'upcoming' ||
    s === 'medium'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }

  if (s === 'reassignment requested' || s === 'reassigned') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
        <RefreshCw className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }

  if (
    s === 'unavailable' ||
    s === 'unassigned' ||
    s === 'overloaded' ||
    s === 'fail' ||
    s === 'cancelled' ||
    s === 'high'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
      <MinusCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span>{status}</span>
    </span>
  );
}
