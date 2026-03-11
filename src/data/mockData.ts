export interface Report {
  id: string;
  sender: string;
  isAnonymous: boolean;
  category: string;
  urgency: "Tinggi" | "Sedang" | "Rendah";
  status: "Diterima" | "Dalam Proses" | "Membutuhkan Klarifikasi" | "Selesai";
  date: string;
  chronology: string;
  biro: string;
  jabatan: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "admin";
  text: string;
  time: string;
  read: boolean;
}

export interface AdminScheduleSlot {
  day: string;
  time: string;
  available: boolean;
}

export interface AdminProfile {
  id: string;
  name: string;
  jabatan: string;
  avatar: string;
  phone: string;
  schedule: AdminScheduleSlot[];
}

export const mockReports: Report[] = [
  {
    id: "HP-20250311-001",
    sender: "Ade Surya Ananda",
    isAnonymous: false,
    category: "Konflik Antar Anggota",
    urgency: "Tinggi",
    status: "Dalam Proses",
    date: "2025-03-11",
    chronology:
      "Terjadi perselisihan antara dua anggota divisi Media terkait pembagian tugas proyek akhir semester. Masalah ini sudah berlangsung selama 2 minggu dan mulai mempengaruhi kinerja tim secara keseluruhan.",
    biro: "Media",
    jabatan: "Anggota Muda",
  },
  {
    id: "HP-20250310-003",
    sender: "Rizky Pratama",
    isAnonymous: false,
    category: "Beban Kerja",
    urgency: "Sedang",
    status: "Diterima",
    date: "2025-03-10",
    chronology:
      "Merasa kewalahan dengan beban kerja yang diberikan sebagai anggota muda. Terdapat 3 proyek yang berjalan bersamaan dengan deadline yang berdekatan.",
    biro: "Litbang",
    jabatan: "Anggota Muda",
  },
  {
    id: "HP-20250309-002",
    sender: "Anonim",
    isAnonymous: true,
    category: "Kesejahteraan",
    urgency: "Tinggi",
    status: "Membutuhkan Klarifikasi",
    date: "2025-03-09",
    chronology:
      "Saya mengalami tekanan psikologis akibat lingkungan kerja yang kurang mendukung. Beberapa senior sering memberikan komentar negatif terhadap pekerjaan saya.",
    biro: "-",
    jabatan: "-",
  },
  {
    id: "HP-20250308-001",
    sender: "Fatimah Zahra",
    isAnonymous: false,
    category: "Akademik",
    urgency: "Rendah",
    status: "Selesai",
    date: "2025-03-08",
    chronology:
      "Kesulitan membagi waktu antara tugas organisasi dan tugas akademik. Membutuhkan saran mengenai manajemen waktu yang efektif.",
    biro: "Humas",
    jabatan: "Staf Ahli",
  },
  {
    id: "HP-20250307-004",
    sender: "Ahmad Fauzi",
    isAnonymous: false,
    category: "Konflik Antar Anggota",
    urgency: "Sedang",
    status: "Dalam Proses",
    date: "2025-03-07",
    chronology:
      "Terjadi miskomunikasi dengan koordinator proyek mengenai tanggung jawab pekerjaan yang menyebabkan keterlambatan penyelesaian tugas.",
    biro: "Litbang",
    jabatan: "Anggota Muda",
  },
];

export const mockChatMessages: ChatMessage[] = [
  { id: "1", sender: "admin", text: "Halo, selamat datang di Halo PSDM. Ada yang bisa saya bantu?", time: "09:00", read: true },
  { id: "2", sender: "user", text: "Halo Kak, saya ingin bercerita tentang masalah yang sedang saya hadapi di divisi.", time: "09:02", read: true },
  { id: "3", sender: "admin", text: "Tentu, silakan ceritakan. Saya di sini untuk mendengarkan 😊", time: "09:03", read: true },
  { id: "4", sender: "user", text: "Terima kasih Kak. Jadi beberapa minggu ini saya merasa beban kerja yang diberikan terlalu berat.", time: "09:05", read: true },
  { id: "5", sender: "admin", text: "Saya paham perasaan kamu. Bisa ceritakan lebih detail tugas-tugas apa saja yang sedang kamu kerjakan?", time: "09:07", read: true },
];

export const mockAdminProfiles: AdminProfile[] = [
  {
    id: "1", name: "Sarah Amelia", jabatan: "PH PSDM", avatar: "SA", phone: "6281234567890",
    schedule: [
      { day: "Senin", time: "09:00 - 11:00", available: true },
      { day: "Rabu", time: "13:00 - 15:00", available: true },
      { day: "Jumat", time: "10:00 - 12:00", available: false },
    ],
  },
  {
    id: "2", name: "Dimas Prayoga", jabatan: "Staf Ahli PSDM", avatar: "DP", phone: "6281234567891",
    schedule: [
      { day: "Selasa", time: "10:00 - 12:00", available: true },
      { day: "Kamis", time: "14:00 - 16:00", available: true },
    ],
  },
  {
    id: "3", name: "Nadia Putri", jabatan: "Staf Ahli PSDM", avatar: "NP", phone: "6281234567892",
    schedule: [
      { day: "Senin", time: "13:00 - 15:00", available: true },
      { day: "Rabu", time: "09:00 - 11:00", available: false },
      { day: "Jumat", time: "13:00 - 15:00", available: true },
    ],
  },
  {
    id: "4", name: "Rafi Hidayat", jabatan: "PH PSDM", avatar: "RH", phone: "6281234567893",
    schedule: [
      { day: "Selasa", time: "08:00 - 10:00", available: false },
      { day: "Kamis", time: "10:00 - 12:00", available: true },
    ],
  },
];

export const mockChatSessions = [
  { id: "1", name: "Ade Surya Ananda", lastMessage: "Terima kasih Kak, saya akan coba.", time: "09:15", unread: 2 },
  { id: "2", name: "Rizky Pratama", lastMessage: "Baik, saya mengerti.", time: "08:45", unread: 0 },
  { id: "3", name: "Anonim", lastMessage: "Saya merasa tidak nyaman...", time: "Kemarin", unread: 1 },
];

export const mockActivityFeed = [
  { id: "1", text: "Laporan baru masuk dari Anonim — Kategori: Kesejahteraan", time: "5 menit lalu" },
  { id: "2", text: "Sesi chat baru dari Ade Surya Ananda", time: "15 menit lalu" },
  { id: "3", text: "Laporan HP-20250310-003 membutuhkan tindak lanjut", time: "1 jam lalu" },
  { id: "4", text: "Permintaan janji temu dari Fatimah Zahra", time: "2 jam lalu" },
];
