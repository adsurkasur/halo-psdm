export type UserRole = "MEMBER" | "HR" | "PH";

export type ReportStatus = "RECEIVED" | "IN_PROGRESS" | "NEEDS_CLARIFICATION" | "DONE";
export type ReportCategory = "KONFLIK" | "BEBAN_KERJA" | "KESEJAHTERAAN" | "AKADEMIK" | "LAINNYA";
export type Urgency = "RENDAH" | "SEDANG" | "TINGGI";
export type AvailabilityStatus = "ONLINE" | "AWAY" | "OFFLINE";
export type AppointmentStatus = "OPEN" | "DONE" | "DISMISSED";
export type ChatSessionStatus = "OPEN" | "CLOSED";
export type ChatMessageType = "TEXT" | "IMAGE" | "FILE";
export type NotificationType =
  | "NEW_REPORT"
  | "STATUS_UPDATED"
  | "NEW_CHAT_SESSION"
  | "NEW_CHAT_MESSAGE"
  | "NEW_CHAT_REPLY"
  | "SESSION_CLOSED"
  | "APPOINTMENT_REQUEST"
  | "REPORT_DONE";

export type BiroBidang = "KETUM" | "ADKEU" | "PSDM" | "PENKOM" | "RISTEK" | "INFOKOM";
export type Jabatan = "PENGURUS_HARIAN" | "STAF_AHLI" | "STAF" | "ANGGOTA_MUDA";
export type ThemePreference = "light" | "dark";

export const BIRO_LABELS: Record<BiroBidang, string> = {
  KETUM: "Ketua Umum",
  ADKEU: "Biro Administrasi dan Keuangan",
  PSDM: "Biro Pengembangan Sumber Daya Mahasiswa",
  PENKOM: "Bidang Penulisan dan Kompetisi",
  RISTEK: "Bidang Riset dan Teknologi",
  INFOKOM: "Bidang Informasi dan Komunikasi",
};

export const BIRO_SHORT: Record<BiroBidang, string> = {
  KETUM: "KETUM",
  ADKEU: "ADKEU",
  PSDM: "PSDM",
  PENKOM: "PENKOM",
  RISTEK: "RISTEK",
  INFOKOM: "INFOKOM",
};

export const JABATAN_LABELS: Record<Jabatan, string> = {
  PENGURUS_HARIAN: "Pengurus Harian",
  STAF_AHLI: "Staf Ahli",
  STAF: "Staf",
  ANGGOTA_MUDA: "Anggota Muda",
};

export interface User {
  id: string;
  name: string;
  biro: BiroBidang;
  jabatan: Jabatan;
  role: UserRole;
  email: string;
  avatar_url?: string | null;
  whatsapp?: string | null;
  password?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  case_id: string;
  user_id: string;
  category: ReportCategory;
  urgency: Urgency;
  kronologi: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_path?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  status: ReportStatus;
  admin_notes: string;
  created_at: string;
  updated_at: string;
}

export interface ReportStatusHistory {
  id: string;
  report_id: string;
  old_status: ReportStatus | null;
  new_status: ReportStatus;
  changed_by: string;
  note: string;
  created_at: string;
}

export interface ChatSession {
  id: string;
  report_id: string | null;
  user_id: string;
  assigned_admin_id: string | null;
  status: ChatSessionStatus;
  created_at: string;
  closed_at: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_id: string;
  content: string;
  type: ChatMessageType;
  media_url?: string;
  media_name?: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface AdminProfile {
  user_id: string;
  display_name: string;
  jabatan_display: string;
  availability_status: AvailabilityStatus;
  wa_number: string;
  avatar_url: string;
  last_seen_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  user_id: string;
  target_admin_id: string;
  status: AppointmentStatus;
  status_note?: string | null;
  handled_by?: string | null;
  handled_at?: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  KONFLIK: "Konflik Antar Anggota",
  BEBAN_KERJA: "Beban Kerja",
  KESEJAHTERAAN: "Kesejahteraan",
  AKADEMIK: "Akademik",
  LAINNYA: "Lainnya",
};

export const STATUS_LABELS: Record<ReportStatus, string> = {
  RECEIVED: "Diterima",
  IN_PROGRESS: "Dalam Proses",
  NEEDS_CLARIFICATION: "Membutuhkan Klarifikasi",
  DONE: "Selesai",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  RENDAH: "Rendah",
  SEDANG: "Sedang",
  TINGGI: "Tinggi",
};

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  ONLINE: "Online",
  AWAY: "Sibuk",
  OFFLINE: "Offline",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  OPEN: "Aktif",
  DONE: "Selesai",
  DISMISSED: "Ditolak",
};

let idCounter = 0;
export function generateId(prefix = ""): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export function generateCaseId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  return `HP-${dateStr}-${random}`;
}
