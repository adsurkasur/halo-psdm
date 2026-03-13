import { Badge } from "@/components/ui/badge";
import type { ReportStatus, Urgency } from "@/data/domain";
import { STATUS_LABELS, URGENCY_LABELS } from "@/data/domain";

const urgencyStyles: Record<Urgency, string> = {
  TINGGI: "bg-red-100 text-red-700 border-red-200",
  SEDANG: "bg-yellow-100 text-yellow-800 border-yellow-200",
  RENDAH: "bg-green-100 text-green-700 border-green-200",
};

const statusStyles: Record<ReportStatus, string> = {
  RECEIVED: "bg-orange-100 text-orange-700 border-orange-200",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800 border-yellow-200",
  NEEDS_CLARIFICATION: "bg-purple-100 text-purple-700 border-purple-200",
  DONE: "bg-green-100 text-green-700 border-green-200",
};

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${urgencyStyles[urgency]}`}>
      {URGENCY_LABELS[urgency]}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${statusStyles[status]}`}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
