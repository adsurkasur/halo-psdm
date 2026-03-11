// =====================================================
// Type Definitions
// =====================================================

export type UserRole = "SENDER" | "ADMIN" | "SUPER_ADMIN";

export type ReportStatus = "RECEIVED" | "IN_PROGRESS" | "NEEDS_CLARIFICATION" | "DONE";
export type ReportCategory = "KONFLIK" | "BEBAN_KERJA" | "KESEJAHTERAAN" | "AKADEMIK" | "LAINNYA";
export type Urgency = "RENDAH" | "SEDANG" | "TINGGI";
export type AvailabilityStatus = "ONLINE" | "AWAY" | "OFFLINE";
export type ChatSessionStatus = "OPEN" | "CLOSED";
export type NotificationType =
  | "NEW_REPORT"
  | "STATUS_UPDATED"
  | "NEW_CHAT_SESSION"
  | "NEW_CHAT_MESSAGE"
  | "NEW_CHAT_REPLY"
  | "SESSION_CLOSED"
  | "APPOINTMENT_REQUEST"
  | "REPORT_DONE";

export interface User {
  id: string;
  name: string;
  biro: string;
  jabatan: string;
  role: UserRole;
  email: string;
  password: string;
  is_active: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  case_id: string;
  user_id: string;
  category: ReportCategory;
  urgency: Urgency;
  kronologi: string;
  is_anonymous: boolean;
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
  changed_by: string; // user_id of admin
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
}

export interface Appointment {
  id: string;
  user_id: string;
  target_admin_id: string;
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

// =====================================================
// Display Helpers
// =====================================================

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

// =====================================================
// Mock Users
// =====================================================

export const mockUsers: User[] = [
  {
    id: "u1",
    name: "Ade Surya Ananda",
    biro: "Media",
    jabatan: "Anggota Muda",
    role: "SENDER",
    email: "ade@arsc.org",
    password: "ade123",
    is_active: true,
    created_at: "2025-01-15T08:00:00Z",
  },
  {
    id: "u2",
    name: "Rizky Pratama",
    biro: "Litbang",
    jabatan: "Anggota Muda",
    role: "SENDER",
    email: "rizky@arsc.org",
    password: "rizky123",
    is_active: true,
    created_at: "2025-01-15T08:00:00Z",
  },
  {
    id: "u3",
    name: "Fatimah Zahra",
    biro: "Humas",
    jabatan: "Staf Ahli",
    role: "SENDER",
    email: "fatimah@arsc.org",
    password: "fatimah123",
    is_active: true,
    created_at: "2025-01-10T08:00:00Z",
  },
  {
    id: "u4",
    name: "Sarah Amelia",
    biro: "PSDM",
    jabatan: "PH PSDM",
    role: "ADMIN",
    email: "sarah@arsc.org",
    password: "sarah123",
    is_active: true,
    created_at: "2025-01-01T08:00:00Z",
  },
  {
    id: "u5",
    name: "Dimas Prayoga",
    biro: "PSDM",
    jabatan: "Staf Ahli PSDM",
    role: "ADMIN",
    email: "dimas@arsc.org",
    password: "dimas123",
    is_active: true,
    created_at: "2025-01-01T08:00:00Z",
  },
  {
    id: "u6",
    name: "Nadia Putri",
    biro: "PSDM",
    jabatan: "Kepala Divisi PSDM",
    role: "SUPER_ADMIN",
    email: "nadia@arsc.org",
    password: "nadia123",
    is_active: true,
    created_at: "2025-01-01T08:00:00Z",
  },
];

// =====================================================
// Mock Reports
// =====================================================

export const initialReports: Report[] = [
  {
    id: "r1",
    case_id: "HP-20250311-001",
    user_id: "u1",
    category: "KONFLIK",
    urgency: "TINGGI",
    kronologi:
      "Terjadi perselisihan antara dua anggota divisi Media terkait pembagian tugas proyek akhir semester. Masalah ini sudah berlangsung selama 2 minggu dan mulai mempengaruhi kinerja tim secara keseluruhan.",
    is_anonymous: false,
    status: "IN_PROGRESS",
    admin_notes: "Sudah kontak kedua pihak. Menunggu jadwal mediasi.",
    created_at: "2025-03-11T08:30:00Z",
    updated_at: "2025-03-11T10:00:00Z",
  },
  {
    id: "r2",
    case_id: "HP-20250310-003",
    user_id: "u2",
    category: "BEBAN_KERJA",
    urgency: "SEDANG",
    kronologi:
      "Merasa kewalahan dengan beban kerja yang diberikan sebagai anggota muda. Terdapat 3 proyek yang berjalan bersamaan dengan deadline yang berdekatan.",
    is_anonymous: false,
    status: "RECEIVED",
    admin_notes: "",
    created_at: "2025-03-10T09:15:00Z",
    updated_at: "2025-03-10T09:15:00Z",
  },
  {
    id: "r3",
    case_id: "HP-20250309-002",
    user_id: "u3",
    category: "KESEJAHTERAAN",
    urgency: "TINGGI",
    kronologi:
      "Saya mengalami tekanan psikologis akibat lingkungan kerja yang kurang mendukung. Beberapa senior sering memberikan komentar negatif terhadap pekerjaan saya tanpa memberikan solusi.",
    is_anonymous: true,
    status: "NEEDS_CLARIFICATION",
    admin_notes: "Perlu identifikasi senior yang dimaksud.",
    created_at: "2025-03-09T14:00:00Z",
    updated_at: "2025-03-09T16:30:00Z",
  },
  {
    id: "r4",
    case_id: "HP-20250308-001",
    user_id: "u3",
    category: "AKADEMIK",
    urgency: "RENDAH",
    kronologi:
      "Kesulitan membagi waktu antara tugas organisasi dan tugas akademik. Membutuhkan saran mengenai manajemen waktu yang efektif.",
    is_anonymous: false,
    status: "DONE",
    admin_notes: "Telah diberikan panduan manajemen waktu dan jadwal konsultasi.",
    created_at: "2025-03-08T10:00:00Z",
    updated_at: "2025-03-08T15:00:00Z",
  },
  {
    id: "r5",
    case_id: "HP-20250307-004",
    user_id: "u1",
    category: "KONFLIK",
    urgency: "SEDANG",
    kronologi:
      "Terjadi miskomunikasi dengan koordinator proyek mengenai tanggung jawab pekerjaan yang menyebabkan keterlambatan penyelesaian tugas.",
    is_anonymous: false,
    status: "IN_PROGRESS",
    admin_notes: "",
    created_at: "2025-03-07T11:30:00Z",
    updated_at: "2025-03-07T14:00:00Z",
  },
];

// =====================================================
// Mock Report Status History
// =====================================================

export const initialStatusHistory: ReportStatusHistory[] = [
  { id: "sh1", report_id: "r1", old_status: null, new_status: "RECEIVED", changed_by: "system", note: "Laporan diterima", created_at: "2025-03-11T08:30:00Z" },
  { id: "sh2", report_id: "r1", old_status: "RECEIVED", new_status: "IN_PROGRESS", changed_by: "u4", note: "Sedang menginvestigasi", created_at: "2025-03-11T10:00:00Z" },
  { id: "sh3", report_id: "r2", old_status: null, new_status: "RECEIVED", changed_by: "system", note: "Laporan diterima", created_at: "2025-03-10T09:15:00Z" },
  { id: "sh4", report_id: "r3", old_status: null, new_status: "RECEIVED", changed_by: "system", note: "Laporan diterima", created_at: "2025-03-09T14:00:00Z" },
  { id: "sh5", report_id: "r3", old_status: "RECEIVED", new_status: "IN_PROGRESS", changed_by: "u4", note: "Sedang ditangani", created_at: "2025-03-09T15:00:00Z" },
  { id: "sh6", report_id: "r3", old_status: "IN_PROGRESS", new_status: "NEEDS_CLARIFICATION", changed_by: "u4", note: "Membutuhkan informasi lebih lanjut dari pelapor", created_at: "2025-03-09T16:30:00Z" },
  { id: "sh7", report_id: "r4", old_status: null, new_status: "RECEIVED", changed_by: "system", note: "Laporan diterima", created_at: "2025-03-08T10:00:00Z" },
  { id: "sh8", report_id: "r4", old_status: "RECEIVED", new_status: "IN_PROGRESS", changed_by: "u5", note: "Sedang dikaji", created_at: "2025-03-08T12:00:00Z" },
  { id: "sh9", report_id: "r4", old_status: "IN_PROGRESS", new_status: "DONE", changed_by: "u5", note: "Panduan manajemen waktu telah diberikan", created_at: "2025-03-08T15:00:00Z" },
  { id: "sh10", report_id: "r5", old_status: null, new_status: "RECEIVED", changed_by: "system", note: "Laporan diterima", created_at: "2025-03-07T11:30:00Z" },
  { id: "sh11", report_id: "r5", old_status: "RECEIVED", new_status: "IN_PROGRESS", changed_by: "u4", note: "Menghubungi koordinator proyek", created_at: "2025-03-07T14:00:00Z" },
];

// =====================================================
// Mock Chat Sessions & Messages
// =====================================================

export const initialChatSessions: ChatSession[] = [
  {
    id: "cs1",
    report_id: "r3",
    user_id: "u3",
    assigned_admin_id: "u4",
    status: "OPEN",
    created_at: "2025-03-09T16:30:00Z",
    closed_at: null,
  },
  {
    id: "cs2",
    report_id: null,
    user_id: "u1",
    assigned_admin_id: "u4",
    status: "OPEN",
    created_at: "2025-03-10T10:00:00Z",
    closed_at: null,
  },
  {
    id: "cs3",
    report_id: null,
    user_id: "u2",
    assigned_admin_id: null,
    status: "OPEN",
    created_at: "2025-03-11T08:00:00Z",
    closed_at: null,
  },
];

export const initialChatMessages: ChatMessage[] = [
  // Session 1 (clarification for report r3)
  { id: "cm1", session_id: "cs1", sender_id: "u4", content: "Halo, terima kasih atas laporannya. Kami perlu informasi tambahan mengenai senior yang dimaksud. Bisa disebutkan konteks situasinya?", is_read: true, read_at: "2025-03-09T16:35:00Z", created_at: "2025-03-09T16:31:00Z" },
  { id: "cm2", session_id: "cs1", sender_id: "u3", content: "Halo Kak, terima kasih atas responnya. Kejadiannya saat rapat divisi minggu lalu.", is_read: true, read_at: "2025-03-09T17:00:00Z", created_at: "2025-03-09T16:40:00Z" },
  { id: "cm3", session_id: "cs1", sender_id: "u4", content: "Baik, kami akan menindaklanjuti. Apakah ada hal lain yang ingin disampaikan?", is_read: false, read_at: null, created_at: "2025-03-09T17:05:00Z" },

  // Session 2 (general chat from u1)
  { id: "cm4", session_id: "cs2", sender_id: "u4", content: "Halo, selamat datang di Halo PSDM. Ada yang bisa saya bantu? 😊", is_read: true, read_at: "2025-03-10T10:02:00Z", created_at: "2025-03-10T10:01:00Z" },
  { id: "cm5", session_id: "cs2", sender_id: "u1", content: "Halo Kak, saya ingin bercerita tentang masalah yang sedang saya hadapi di divisi.", is_read: true, read_at: "2025-03-10T10:05:00Z", created_at: "2025-03-10T10:03:00Z" },
  { id: "cm6", session_id: "cs2", sender_id: "u4", content: "Tentu, silakan ceritakan. Saya di sini untuk mendengarkan.", is_read: true, read_at: "2025-03-10T10:07:00Z", created_at: "2025-03-10T10:06:00Z" },
  { id: "cm7", session_id: "cs2", sender_id: "u1", content: "Beberapa minggu ini saya merasa beban kerja yang diberikan terlalu berat. Ada 3 proyek bersamaan.", is_read: true, read_at: "2025-03-10T10:10:00Z", created_at: "2025-03-10T10:08:00Z" },
  { id: "cm8", session_id: "cs2", sender_id: "u4", content: "Saya paham perasaan kamu. Bisa ceritakan lebih detail tugas-tugas apa saja yang sedang kamu kerjakan?", is_read: false, read_at: null, created_at: "2025-03-10T10:12:00Z" },
];

// =====================================================
// Mock Admin Profiles
// =====================================================

export const initialAdminProfiles: AdminProfile[] = [
  {
    user_id: "u4",
    display_name: "Sarah Amelia",
    jabatan_display: "PH PSDM",
    availability_status: "ONLINE",
    wa_number: "6281234567890",
    avatar_url: "",
  },
  {
    user_id: "u5",
    display_name: "Dimas Prayoga",
    jabatan_display: "Staf Ahli PSDM",
    availability_status: "AWAY",
    wa_number: "6281234567891",
    avatar_url: "",
  },
  {
    user_id: "u6",
    display_name: "Nadia Putri",
    jabatan_display: "Kepala Divisi PSDM",
    availability_status: "OFFLINE",
    wa_number: "6281234567892",
    avatar_url: "",
  },
];

// =====================================================
// Mock Appointments
// =====================================================

export const initialAppointments: Appointment[] = [
  { id: "apt1", user_id: "u1", target_admin_id: "u4", created_at: "2025-03-10T14:00:00Z" },
  { id: "apt2", user_id: "u3", target_admin_id: "u5", created_at: "2025-03-09T11:00:00Z" },
];

// =====================================================
// Mock Notifications
// =====================================================

export const initialNotifications: Notification[] = [
  {
    id: "n1",
    user_id: "u4",
    type: "NEW_REPORT",
    title: "Laporan Baru",
    message: "Laporan baru masuk dari Anonim — Kategori: Kesejahteraan",
    link: "/admin/laporan/r3",
    is_read: false,
    created_at: "2025-03-09T14:00:00Z",
  },
  {
    id: "n2",
    user_id: "u4",
    type: "NEW_CHAT_SESSION",
    title: "Sesi Chat Baru",
    message: "Sesi chat baru dari Ade Surya Ananda",
    link: "/admin/chat",
    is_read: false,
    created_at: "2025-03-10T10:00:00Z",
  },
  {
    id: "n3",
    user_id: "u4",
    type: "NEW_CHAT_SESSION",
    title: "Sesi Chat Baru",
    message: "Sesi chat baru dari Rizky Pratama (belum di-assign)",
    link: "/admin/chat",
    is_read: false,
    created_at: "2025-03-11T08:00:00Z",
  },
  {
    id: "n4",
    user_id: "u1",
    type: "STATUS_UPDATED",
    title: "Status Diperbarui",
    message: "Laporan HP-20250311-001 telah diperbarui statusnya ke Dalam Proses",
    link: "/laporan",
    is_read: false,
    created_at: "2025-03-11T10:00:00Z",
  },
  {
    id: "n5",
    user_id: "u3",
    type: "REPORT_DONE",
    title: "Kasus Selesai",
    message: "Kasus HP-20250308-001 telah diselesaikan oleh admin",
    link: "/laporan",
    is_read: true,
    created_at: "2025-03-08T15:00:00Z",
  },
  {
    id: "n6",
    user_id: "u5",
    type: "NEW_REPORT",
    title: "Laporan Baru",
    message: "Laporan baru: HP-20250310-003 — Beban Kerja (Sedang)",
    link: "/admin/laporan/r2",
    is_read: true,
    created_at: "2025-03-10T09:15:00Z",
  },
  {
    id: "n7",
    user_id: "u6",
    type: "NEW_REPORT",
    title: "Laporan Baru",
    message: "Laporan baru: HP-20250310-003 — Beban Kerja (Sedang)",
    link: "/admin/laporan/r2",
    is_read: true,
    created_at: "2025-03-10T09:15:00Z",
  },
];

// =====================================================
// Utility: Generate unique IDs
// =====================================================

let idCounter = 100;
export function generateId(prefix: string = ""): string {
  idCounter++;
  return `${prefix}${idCounter}-${Date.now().toString(36)}`;
}

export function generateCaseId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  return `HP-${dateStr}-${random}`;
}
