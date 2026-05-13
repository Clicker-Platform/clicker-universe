import type { RegistrationStatus } from '@/lib/registrations/types';

const STYLES: Record<RegistrationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  contacted: 'bg-blue-100 text-blue-800',
  activated: 'bg-green-100 text-green-800',
  rejected: 'bg-gray-100 text-gray-700',
};

const LABELS: Record<RegistrationStatus, string> = {
  pending: 'Pending',
  contacted: 'Contacted',
  activated: 'Activated',
  rejected: 'Rejected',
};

export function StatusBadge({ status }: { status: RegistrationStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
