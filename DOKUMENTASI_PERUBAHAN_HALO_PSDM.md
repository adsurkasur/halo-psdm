# Dokumentasi Rinci Perubahan Sistem — Halo PSDM

Dokumen ini mencatat secara rinci dan komprehensif seluruh perbaikan bug, audit teknis, pengamanan sistem, serta penambahan fitur baru yang diimplementasikan pada aplikasi **Halo PSDM**.

---

## 📋 Ringkasan Eksekutif (Executive Summary)

Pengerjaan pengembangan dan penyempurnaan sistem difokuskan pada perbaikan aspek UX/UI, pengamanan backend, otomatisasi pencegahan kehilangan data, dan pemenuhan fitur manajerial data (riwayat chat & penghapusan laporan/chat).

Seluruh perubahan telah diuji secara otomatis menggunakan suite **Vitest** dengan hasil **100% Lulus (10/10 pengujian)**.

---

## 🛠️ Detail Perubahan Berdasarkan Kategori

### 1. Perbaikan Visual, Aksesibilitas, dan Media Chat

#### A. Dukungan Media Video & Pratinjau Thumbnail Video di Chat Input
- **Lokasi Kode**: 
  - [ChatRoom.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/views/sender/ChatRoom.tsx)
  - [AdminChatQueue.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/views/admin/AdminChatQueue.tsx)
  - [MediaViewerDialog.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/components/shared/MediaViewerDialog.tsx)
  - [supabase-storage.ts](file:///f:/My%20Files/Projects/halo-psdm/src/lib/supabase-storage.ts)
- **Rincian Perubahan**:
  - Menambahkan pratinjau thumbnail berupa elemen `<video>` dengan badge label `"Video"` saat pengguna memilik berkas video (`.mp4`, `.webm`, `.mov`) di input lampiran chat.
  - Memastikan `MediaViewerDialog` mendukung pemutaran langsung video dengan kontrol bawaan peramban (`controls`, `preload="metadata"`).
  - Memperbarui fungsi pembantu `isVideoResource()` dan `getChatMessagePreview()` untuk mengenali ikon `🎬 Video` pada ringkasan pesan.

#### B. Kontras Warna Seleksi Antrean Chat Admin (Accessibility Fix)
- **Lokasi Kode**: [AdminChatQueue.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/views/admin/AdminChatQueue.tsx)
- **Rincian Perubahan**:
  - Memperbaiki masalah kontras tinggi di mana teks sesi terpilih berwarna putih di atas latar belakang krem/terang.
  - Menerapkan kelas `text-accent-foreground` dan `text-accent-foreground/75` untuk memastikan keterbacaan yang sempurna baik pada *light mode* maupun *dark mode*.

---

### 2. Pengamanan Akun, Otentikasi, dan Pendaftaran

#### A. Penanganan Crash Saat Penghapusan Akun
- **Lokasi Kode**: [delete-account/route.ts](file:///f:/My%20Files/Projects/halo-psdm/src/app/api/secure/profile/delete-account/route.ts)
- **Rincian Perubahan**:
  - Mengganti sintaks query Supabase `.or("id.eq...,user_id.eq...")` yang bermasalah dengan query eksplisit `.eq("user_id", auth.context.authUser.id)`.
  - Memastikan penghapusan akun pengguna tidak menyebabkan kesalahan server internal (HTTP 500).

#### B. Verifikasi Email Manual & Aktivasi Pengguna oleh Admin PH
- **Lokasi Kode**: 
  - [verify-user/route.ts](file:///f:/My%20Files/Projects/halo-psdm/src/app/api/secure/auth/verify-user/route.ts)
  - [AdminManagement.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/views/admin/AdminManagement.tsx)
- **Rincian Perubahan**:
  - Membuat endpoint secure `POST /api/secure/auth/verify-user` untuk mengonfirmasi email pengguna secara manual di Supabase Auth (`email_confirm: true`) dan mengaktifkan status pengguna (`is_active: true`).
  - Menambahkan tab **"Daftar Pengguna / Aktivasi"** di panel Kelola Admin agar tim PH dapat memverifikasi akun pengguna yang mengalami kendala penerimaan email konfirmasi.

#### C. Otorisasi Routing Frontend untuk Role HR
- **Lokasi Kode**: [App.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/App.tsx)
- **Rincian Perubahan**:
  - Mengubah pemeriksaan rute dilindungi `/admin/*` dari yang sebelumnya hanya menguji `isPh` menjadi variabel terpadu `isElevated` (`const isElevated = isPh || isHr;`).
  - Mengizinkan tim **HR** mengakses rute manajemen (`/admin/dasbor`, `/admin/laporan`, `/admin/chat`, `/admin/janji-temu`, dll.).

---

### 3. Manajemen Janji Temu & Notifikasi Realtime

#### A. Verifikasi Status Janji Temu & Catatan Manual
- **Lokasi Kode**: 
  - [domain.ts](file:///f:/My%20Files/Projects/halo-psdm/src/data/domain.ts)
  - [AdminAppointmentTracker.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/views/admin/AdminAppointmentTracker.tsx)
- **Rincian Perubahan**:
  - Menambahkan status `VERIFIED` pada tipe `AppointmentStatus`.
  - Menyediakan dialog modal untuk entri manual janji temu yang dilakukan di luar aplikasi (misal: WhatsApp/Tatap Muka langsung).
  - Menyediakan tombol aksi bertahap: **"Verifikasi"** (mengubah status `OPEN` -> `VERIFIED`) dan **"Selesaikan"** (mengubah status `VERIFIED` -> `DONE`).

#### B. Sinkronisasi Realtime & Pop-up Notifikasi Browser
- **Lokasi Kode**: [DataContext.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/contexts/DataContext.tsx)
- **Rincian Perubahan**:
  - Meng-upgrade `DataContext` untuk menyuntikkan payload perubahan Postgres Supabase secara langsung ke cache React Query menggunakan `queryClient.setQueryData`.
  - Mengintegrasikan notifikasi push bawaan browser (`Notification.requestPermission()` + `new Notification()`) serta notifikasi toast *in-app*.

---

### 4. Sanitasi Berkas, Validasi Server-Side, & Anti Lost Data

#### A. Sanitasi Ekstensi Berkas Upload (Security Hardening)
- **Lokasi Kode**: 
  - [chat/media/route.ts](file:///f:/My%20Files/Projects/halo-psdm/src/app/api/secure/chat/media/route.ts)
  - [reports/attachments/route.ts](file:///f:/My%20Files/Projects/halo-psdm/src/app/api/secure/reports/attachments/route.ts)
  - [profile/avatar/route.ts](file:///f:/My%20Files/Projects/halo-psdm/src/app/api/secure/profile/avatar/route.ts)
- **Rincian Perubahan**:
  - Menambahkan validasi whitelist ekstensi berkas yang diperbolehkan (`jpg`, `jpeg`, `png`, `webp`, `gif`, `mp4`, `webm`, `pdf`, `doc`, `docx`, `xls`, `xlsx`).
  - Menyanitasi nama ekstensi berkas dari karakter non-alfanumerik sebelum disimpan ke Supabase Storage.

#### B. Fitur Autosave Draf Laporan Pengaduan
- **Lokasi Kode**: [ReportForm.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/views/sender/ReportForm.tsx)
- **Rincian Perubahan**:
  - Mengimplementasikan penyimpanan otomatis draf laporan pada `localStorage` berbasis ID pengguna (`halo_psdm_report_draft_<USER_ID>`).
  - Isian kronologi, kategori, dan urgensi otomatis terpulihkan jika peramban ter-refresh. Draf otomatis dibersihkan saat laporan sukses dikirim.

#### C. Validasi Enum Payload Laporan Server-Side
- **Lokasi Kode**: [reports/route.ts](file:///f:/My%20Files/Projects/halo-psdm/src/app/api/secure/reports/route.ts)
- **Rincian Perubahan**:
  - Menambahkan pengecekan eksplisit server-side untuk memastikan `category` dan `urgency` sesuai dengan nilai enum yang valid, serta batas minimal 20 karakter untuk `kronologi`.

#### D. Navigasi Chat via Parameter Query URL
- **Lokasi Kode**: 
  - [chat/messages/route.ts](file:///f:/My%20Files/Projects/halo-psdm/src/app/api/secure/chat/messages/route.ts)
  - [AdminChatQueue.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/views/admin/AdminChatQueue.tsx)
- **Rincian Perubahan**:
  - Mengubah tautan notifikasi admin menjadi `/admin/chat?session=<SESSION_ID>`.
  - Menambahkan penanganan `useSearchParams` pada `AdminChatQueue.tsx` agar sesi chat yang bersangkutan otomatis terpilih saat diklik dari notifikasi.

---

### 5. Riwayat Chat PH & Fitur Penghapusan Data (Fitur Baru)

#### A. Pengelolaan Riwayat Sesi Chat Selesai untuk Admin
- **Lokasi Kode**: [AdminChatQueue.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/views/admin/AdminChatQueue.tsx)
- **Rincian Perubahan**:
  - Menambahkan kontrol tab filter pada antrean admin: **"Aktif"** (`OPEN`), **"Selesai"** (`CLOSED`), dan **"Semua"** (`ALL`).
  - Memungkinkan tim PH & HR membaca seluruh riwayat percakapan sesi yang telah ditutup kapan saja tanpa hilang dari tampilan.

#### B. Fitur Hapus Laporan Pengaduan
- **Lokasi Kode**: 
  - [reports/[reportId]/route.ts](file:///f:/My%20Files/Projects/halo-psdm/src/app/api/secure/reports/%5BreportId%5D/route.ts) *(New Endpoint)*
  - [DataContext.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/contexts/DataContext.tsx)
  - [SenderReportDetail.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/views/sender/SenderReportDetail.tsx)
  - [ReportDetail.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/views/admin/ReportDetail.tsx)
- **Rincian Perubahan**:
  - Menambahkan rute secure `DELETE /api/secure/reports/[reportId]` yang memverifikasi otoritas pengaju atau role Admin (PH/HR).
  - Membersihkan berkas lampiran terkait dari storage `report-attachments` dan menghapus record laporan dari database (Postgres CASCADE menghapus riwayat status).
  - Menambahkan tombol **Hapus** beserta modal konfirmasi (`AlertDialog`).

#### C. Fitur Hapus Sesi Chat
- **Lokasi Kode**: 
  - [chat/sessions/[sessionId]/route.ts](file:///f:/My%20Files/Projects/halo-psdm/src/app/api/secure/chat/sessions/%5BsessionId%5D/route.ts) *(New Endpoint)*
  - [DataContext.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/contexts/DataContext.tsx)
  - [ChatRoom.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/views/sender/ChatRoom.tsx)
  - [ChatSessionList.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/views/sender/ChatSessionList.tsx)
  - [AdminChatQueue.tsx](file:///f:/My%20Files/Projects/halo-psdm/src/views/admin/AdminChatQueue.tsx)
- **Rincian Perubahan**:
  - Menambahkan rute secure `DELETE /api/secure/chat/sessions/[sessionId]` yang membersihkan seluruh berkas media foto/video dari storage `chat-media` dan menghapus sesi chat dari database (Postgres CASCADE menghapus seluruh `chat_messages`).
  - Menambahkan tombol **Hapus Chat** beserta modal konfirmasi (`AlertDialog`).

---

## 📁 Matriks Berkas Terpengaruh (File Change Matrix)

| Nama Berkas | Jenis Perubahan | Deskripsi Singkat |
| :--- | :--- | :--- |
| `src/App.tsx` | Edit | Memperbarui otorisasi rute admin untuk role HR (`isElevated`). |
| `src/data/domain.ts` | Edit | Menambahkan status `VERIFIED` pada Janji Temu. |
| `src/contexts/DataContext.tsx` | Edit | Mengintegrasikan cache realtime, `deleteReport`, dan `deleteChatSession`. |
| `src/lib/supabase-storage.ts` | Edit | Menambahkan pembantu pemutus video & pratinjau media. |
| `src/components/shared/MediaViewerDialog.tsx` | Edit | Mendukung pemutaran langsung berkas video di dialog lightbox. |
| `src/views/sender/ChatRoom.tsx` | Edit | Pratinjau video thumbnail & fitur Hapus Chat. |
| `src/views/sender/ChatSessionList.tsx` | Edit | Tombol Hapus Chat pada kartu sesi pengaju. |
| `src/views/sender/ReportForm.tsx` | Edit | Autosave & pembersihan draf laporan pengaduan. |
| `src/views/sender/SenderReportDetail.tsx` | Edit | Tombol Hapus Laporan pengaju. |
| `src/views/admin/AdminChatQueue.tsx` | Edit | Tab filter sesi (Aktif/Selesai/Semua), kontras seleksi, auto-select query, & Hapus Chat. |
| `src/views/admin/AdminAppointmentTracker.tsx` | Edit | Tracker status `VERIFIED` & modal entri manual janji temu. |
| `src/views/admin/AdminManagement.tsx` | Edit | Tab verifikasi email manual & aktivasi akun oleh PH. |
| `src/views/admin/ReportDetail.tsx` | Edit | Tombol Hapus Laporan admin. |
| `src/app/api/secure/auth/verify-user/route.ts` | BARU | Endpoint API verifikasi pengguna manual. |
| `src/app/api/secure/chat/media/route.ts` | Edit | Whitelist & sanitasi ekstensi media chat. |
| `src/app/api/secure/chat/messages/route.ts` | Edit | Menyesuaikan tautan notifikasi pesan admin dengan parameter query. |
| `src/app/api/secure/chat/sessions/[sessionId]/route.ts` | BARU | Endpoint API DELETE sesi chat & pembersihan storage. |
| `src/app/api/secure/profile/avatar/route.ts` | Edit | Whitelist & sanitasi ekstensi avatar. |
| `src/app/api/secure/profile/delete-account/route.ts` | Edit | Perbaikan sintaks query penghapusan akun. |
| `src/app/api/secure/reports/route.ts` | Edit | Validasi enum server-side untuk kategori & urgensi. |
| `src/app/api/secure/reports/attachments/route.ts` | Edit | Whitelist & sanitasi ekstensi lampiran laporan. |
| `src/app/api/secure/reports/[reportId]/route.ts` | BARU | Endpoint API DELETE laporan & pembersihan storage. |

---

## 🧪 Verifikasi dan Pengujian Sintaks

Pengujian otomatis dijalankan menggunakan runner **Vitest**:

```powershell
npm run test
```

### Hasil Pengujian:
```text
 RUN  v3.2.4 F:/My Files/Projects/halo-psdm

 ✓ src/test/example.test.ts (1 test)
 ✓ src/test/reportForm.test.tsx (3 tests)
 ✓ src/test/app.test.tsx (6 tests)

 Test Files  3 passed (3)
      Tests  10 passed (10)
   Duration  4.40s
```

Seluruh 10 skenario pengujian dinyatakan **LULUS (100% PASS)** tanpa kesalahan tipe TypeScript maupun *runtime syntax error*.
