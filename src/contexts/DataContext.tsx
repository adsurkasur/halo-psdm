import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  initialReports,
  initialStatusHistory,
  initialChatSessions,
  initialChatMessages,
  initialAdminProfiles,
  initialAppointments,
  initialNotifications,
  generateId,
  generateCaseId,
  mockUsers,
  STATUS_LABELS,
  URGENCY_LABELS,
  type Report,
  type ReportStatus,
  type ReportStatusHistory,
  type ChatSession,
  type ChatMessage,
  type ChatMessageType,
  type AdminProfile,
  type Appointment,
  type Notification,
  type ReportCategory,
  type Urgency,
  type AvailabilityStatus,
  type NotificationType,
} from "@/data/mockData";

interface DataContextType {
  reports: Report[];
  statusHistory: ReportStatusHistory[];
  addReport: (data: {
    user_id: string;
    category: ReportCategory;
    urgency: Urgency;
    kronologi: string;
  }) => Report;
  updateReportStatus: (reportId: string, newStatus: ReportStatus, adminId: string, note?: string) => void;
  updateReportUrgency: (reportId: string, newUrgency: Urgency, adminId: string) => void;
  updateReportNotes: (reportId: string, notes: string) => void;

  chatSessions: ChatSession[];
  chatMessages: ChatMessage[];
  createChatSession: (userId: string, reportId?: string | null) => ChatSession;
  assignAdminToSession: (sessionId: string, adminId: string) => void;
  closeChatSession: (sessionId: string) => void;
  addChatMessage: (sessionId: string, senderId: string, content: string, type?: ChatMessageType, mediaUrl?: string, mediaName?: string) => ChatMessage;
  markMessagesRead: (sessionId: string, readerId: string) => void;

  adminProfiles: AdminProfile[];
  updateAvailability: (adminUserId: string, status: AvailabilityStatus) => void;
  addAdminProfile: (profile: AdminProfile) => void;
  removeAdminProfile: (userId: string) => void;

  appointments: Appointment[];
  addAppointment: (userId: string, targetAdminId: string) => Appointment;

  notifications: Notification[];
  addNotification: (data: {
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  }) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: (userId: string) => void;
  getUnreadCount: (userId: string) => number;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [statusHistory, setStatusHistory] = useState<ReportStatusHistory[]>(initialStatusHistory);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(initialChatSessions);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [adminProfiles, setAdminProfiles] = useState<AdminProfile[]>(initialAdminProfiles);
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);

  const addNotification = useCallback(
    (data: { user_id: string; type: NotificationType; title: string; message: string; link?: string }) => {
      const notif: Notification = {
        id: generateId("n"),
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link,
        is_read: false,
        created_at: new Date().toISOString(),
      };
      setNotifications((prev) => [notif, ...prev]);
    },
    []
  );

  const addReport = useCallback(
    (data: { user_id: string; category: ReportCategory; urgency: Urgency; kronologi: string }) => {
      const now = new Date().toISOString();
      const report: Report = {
        id: generateId("r"),
        case_id: generateCaseId(),
        user_id: data.user_id,
        category: data.category,
        urgency: data.urgency,
        kronologi: data.kronologi,
        status: "RECEIVED",
        admin_notes: "",
        created_at: now,
        updated_at: now,
      };
      setReports((prev) => [report, ...prev]);

      const historyEntry: ReportStatusHistory = {
        id: generateId("sh"),
        report_id: report.id,
        old_status: null,
        new_status: "RECEIVED",
        changed_by: "system",
        note: "Laporan diterima",
        created_at: now,
      };
      setStatusHistory((prev) => [...prev, historyEntry]);

      const senderUser = mockUsers.find((u) => u.id === data.user_id);
      const senderName = senderUser?.name ?? "Pengirim";
      const admins = mockUsers.filter((u) => u.role === "ADMIN" || u.role === "SUPER_ADMIN");
      admins.forEach((admin) => {
        addNotification({
          user_id: admin.id,
          type: "NEW_REPORT",
          title: "Laporan Baru",
          message: `Laporan baru dari ${senderName} — Kategori: ${data.category} (${data.urgency})`,
          link: `/admin/laporan/${report.id}`,
        });
      });

      return report;
    },
    [addNotification]
  );

  const updateReportStatus = useCallback(
    (reportId: string, newStatus: ReportStatus, adminId: string, note: string = "") => {
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, status: newStatus, updated_at: new Date().toISOString() }
            : r
        )
      );

      const report = reports.find((r) => r.id === reportId);
      const oldStatus = report?.status ?? null;
      const now = new Date().toISOString();

      const historyEntry: ReportStatusHistory = {
        id: generateId("sh"),
        report_id: reportId,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: adminId,
        note: note || `Status diubah ke ${STATUS_LABELS[newStatus]}`,
        created_at: now,
      };
      setStatusHistory((prev) => [...prev, historyEntry]);

      if (report) {
        addNotification({
          user_id: report.user_id,
          type: newStatus === "DONE" ? "REPORT_DONE" : "STATUS_UPDATED",
          title: newStatus === "DONE" ? "Kasus Selesai" : "Status Diperbarui",
          message: `Laporan ${report.case_id} telah diperbarui ke ${STATUS_LABELS[newStatus]}`,
          link: "/laporan",
        });
      }
    },
    [reports, addNotification]
  );

  const updateReportUrgency = useCallback(
    (reportId: string, newUrgency: Urgency, adminId: string) => {
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, urgency: newUrgency, updated_at: new Date().toISOString() }
            : r
        )
      );
      const report = reports.find((r) => r.id === reportId);
      if (report) {
        addNotification({
          user_id: report.user_id,
          type: "STATUS_UPDATED",
          title: "Urgensi Diperbarui",
          message: `Urgensi laporan ${report.case_id} diubah menjadi ${URGENCY_LABELS[newUrgency]}`,
          link: "/laporan",
        });
      }
    },
    [reports, addNotification]
  );

  const updateReportNotes = useCallback((reportId: string, notes: string) => {
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, admin_notes: notes } : r))
    );
  }, []);

  const createChatSession = useCallback(
    (userId: string, reportId: string | null = null) => {
      const session: ChatSession = {
        id: generateId("cs"),
        report_id: reportId,
        user_id: userId,
        assigned_admin_id: null,
        status: "OPEN",
        created_at: new Date().toISOString(),
        closed_at: null,
      };
      setChatSessions((prev) => [session, ...prev]);

      const senderUser = mockUsers.find((u) => u.id === userId);
      const admins = mockUsers.filter((u) => u.role === "ADMIN" || u.role === "SUPER_ADMIN");
      admins.forEach((admin) => {
        addNotification({
          user_id: admin.id,
          type: "NEW_CHAT_SESSION",
          title: "Sesi Chat Baru",
          message: `Sesi chat baru dari ${senderUser?.name ?? "Pengirim"}`,
          link: "/admin/chat",
        });
      });

      return session;
    },
    [addNotification]
  );

  const assignAdminToSession = useCallback((sessionId: string, adminId: string) => {
    setChatSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, assigned_admin_id: adminId } : s))
    );
  }, []);

  const closeChatSession = useCallback(
    (sessionId: string) => {
      const session = chatSessions.find((s) => s.id === sessionId);
      setChatSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, status: "CLOSED" as const, closed_at: new Date().toISOString() }
            : s
        )
      );

      if (session) {
        addNotification({
          user_id: session.user_id,
          type: "SESSION_CLOSED",
          title: "Sesi Chat Ditutup",
          message: "Admin telah menutup sesi chat Anda",
          link: "/chat",
        });
      }
    },
    [chatSessions, addNotification]
  );

  const addChatMessage = useCallback(
    (
      sessionId: string,
      senderId: string,
      content: string,
      type: ChatMessageType = "TEXT",
      mediaUrl?: string,
      mediaName?: string
    ) => {
      const msg: ChatMessage = {
        id: generateId("cm"),
        session_id: sessionId,
        sender_id: senderId,
        content,
        type,
        media_url: mediaUrl,
        media_name: mediaName,
        is_read: false,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, msg]);

      const session = chatSessions.find((s) => s.id === sessionId);
      if (session) {
        const senderUser = mockUsers.find((u) => u.id === senderId);
        const isSender = senderId === session.user_id;
        const targetUserId = isSender ? session.assigned_admin_id : session.user_id;
        const preview = type === "TEXT" ? content.slice(0, 60) : `📎 ${mediaName ?? "Media"}`;

        if (targetUserId) {
          addNotification({
            user_id: targetUserId,
            type: isSender ? "NEW_CHAT_MESSAGE" : "NEW_CHAT_REPLY",
            title: isSender ? "Pesan Baru" : "Balasan Chat",
            message: `${senderUser?.name ?? "Pengguna"}: ${preview}${type === "TEXT" && content.length > 60 ? "..." : ""}`,
            link: isSender ? "/admin/chat" : `/chat/${sessionId}`,
          });
        }
      }

      return msg;
    },
    [chatSessions, addNotification]
  );

  const markMessagesRead = useCallback((sessionId: string, readerId: string) => {
    const now = new Date().toISOString();
    setChatMessages((prev) =>
      prev.map((m) =>
        m.session_id === sessionId && m.sender_id !== readerId && !m.is_read
          ? { ...m, is_read: true, read_at: now }
          : m
      )
    );
  }, []);

  const updateAvailability = useCallback((adminUserId: string, status: AvailabilityStatus) => {
    setAdminProfiles((prev) =>
      prev.map((p) => (p.user_id === adminUserId ? { ...p, availability_status: status } : p))
    );
  }, []);

  const addAdminProfile = useCallback((profile: AdminProfile) => {
    setAdminProfiles((prev) => [...prev, profile]);
  }, []);

  const removeAdminProfile = useCallback((userId: string) => {
    setAdminProfiles((prev) => prev.filter((p) => p.user_id !== userId));
  }, []);

  const addAppointment = useCallback(
    (userId: string, targetAdminId: string) => {
      const apt: Appointment = {
        id: generateId("apt"),
        user_id: userId,
        target_admin_id: targetAdminId,
        created_at: new Date().toISOString(),
      };
      setAppointments((prev) => [...prev, apt]);

      const senderUser = mockUsers.find((u) => u.id === userId);
      addNotification({
        user_id: targetAdminId,
        type: "APPOINTMENT_REQUEST",
        title: "Permintaan Janji Temu",
        message: `Permintaan janji temu baru dari ${senderUser?.name ?? "Pengirim"}`,
      });

      return apt;
    },
    [addNotification]
  );

  const markNotificationRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
  }, []);

  const markAllNotificationsRead = useCallback((userId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.user_id === userId ? { ...n, is_read: true } : n))
    );
  }, []);

  const getUnreadCount = useCallback(
    (userId: string) => notifications.filter((n) => n.user_id === userId && !n.is_read).length,
    [notifications]
  );

  return (
    <DataContext.Provider
      value={{
        reports, statusHistory, addReport, updateReportStatus, updateReportUrgency, updateReportNotes,
        chatSessions, chatMessages, createChatSession, assignAdminToSession, closeChatSession, addChatMessage, markMessagesRead,
        adminProfiles, updateAvailability, addAdminProfile, removeAdminProfile,
        appointments, addAppointment,
        notifications, addNotification, markNotificationRead, markAllNotificationsRead, getUnreadCount,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
