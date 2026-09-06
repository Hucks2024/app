const LABELS: Record<string, { label: string; className: string }> = {
  APPROVED: { label: "Verified", className: "badge-green" },
  PENDING: { label: "Verification pending", className: "badge-amber" },
  REJECTED: { label: "Not verified", className: "badge-red" },
  UNSUBMITTED: { label: "Not verified", className: "badge-slate" },
};

export default function VerificationBadge({ status }: { status: string }) {
  const info = LABELS[status] ?? LABELS.UNSUBMITTED;
  return <span className={info.className}>{info.label}</span>;
}
