import { Badge } from "@/components/ui/badge";

const urgencyMap = {
  Tinggi: "bg-urgency-high text-primary-foreground",
  Sedang: "bg-urgency-medium text-primary-foreground",
  Rendah: "bg-urgency-low text-primary-foreground",
};

const statusMap = {
  Diterima: "bg-status-open text-primary-foreground",
  "Dalam Proses": "bg-status-process text-primary-foreground",
  "Membutuhkan Klarifikasi": "bg-status-clarify text-primary-foreground",
  Selesai: "bg-status-done text-primary-foreground",
};

export function UrgencyBadge({ urgency }: { urgency: string }) {
  return (
    <Badge className={`${urgencyMap[urgency as keyof typeof urgencyMap] || ""} text-xs font-medium`}>
      {urgency}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`${statusMap[status as keyof typeof statusMap] || ""} text-xs font-medium`}>
      {status}
    </Badge>
  );
}
