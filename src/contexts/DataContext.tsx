import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import {
  generateId,
  generateCaseId,
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
} from "@/data/domain";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface DataContextType {
  reports: Report[];
  statusHistory: ReportStatusHistory[];
  addReport: (data: {
    user_id: string;
    category: ReportCategory;
    urgency: Urgency;
    kronologi: string;
  }) => Promise<Report>;
  updateReportStatus: (reportId: string, newStatus: ReportStatus, adminId: string, note?: string) => Promise<void>;
  updateReportUrgency: (reportId: string, newUrgency: Urgency, adminId: string) => Promise<void>;
  updateReportNotes: (reportId: string, notes: string) => Promise<void>;

  chatSessions: ChatSession[];
  chatMessages: ChatMessage[];
  createChatSession: (userId: string, reportId?: string | null) => Promise<ChatSession>;
  assignAdminToSession: (sessionId: string, adminId: string) => Promise<void>;
  closeChatSession: (sessionId: string) => Promise<void>;
  addChatMessage: (sessionId: string, senderId: string, content: string, type?: ChatMessageType, mediaUrl?: string, mediaName?: string) => Promise<ChatMessage>;
  markMessagesRead: (sessionId: string, readerId: string) => Promise<void>;

  adminProfiles: AdminProfile[];
  updateAvailability: (adminUserId: string, status: AvailabilityStatus) => Promise<void>;
  addAdminProfile: (profile: AdminProfile) => Promise<void>;
  removeAdminProfile: (userId: string) => Promise<void>;

  appointments: Appointment[];
  addAppointment: (userId: string, targetAdminId: string) => Promise<Appointment>;

  notifications: Notification[];
  addNotification: (data: {
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  }) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: (userId: string) => Promise<void>;
  getUnreadCount: (userId: string) => number;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, allUsers } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [statusHistory, setStatusHistory] = useState<ReportStatusHistory[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<AdminProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const loadAllData = useCallback(async () => {
    if (!user) {
      setReports([]);
      setStatusHistory([]);
      setChatSessions([]);
      setChatMessages([]);
      setAdminProfiles([]);
      setAppointments([]);
      setNotifications([]);
      return;
    }

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

    const reportsQuery = isAdmin
      ? supabase.from("reports").select("*").order("created_at", { ascending: false })
      : supabase.from("reports").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

    const sessionsQuery = isAdmin
      ? supabase.from("chat_sessions").select("*").order("created_at", { ascending: false })
      : supabase.from("chat_sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

    const appointmentsQuery = isAdmin
      ? supabase.from("appointments").select("*").order("created_at", { ascending: false })
      : supabase.from("appointments").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

    const [reportsRes, sessionsRes, profilesRes, appointmentsRes, notificationsRes] = await Promise.all([
      reportsQuery,
      sessionsQuery,
      supabase.from("admin_profiles").select("*"),
      appointmentsQuery,
      supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    const mappedReports = (reportsRes.data ?? []).map((r) => r as Report);
    setReports(mappedReports);

    const mappedSessions = (sessionsRes.data ?? []).map((s) => s as ChatSession);
    setChatSessions(mappedSessions);

    const sessionIds = mappedSessions.map((s) => s.id);
    if (sessionIds.length > 0) {
      const { data: rawMessages } = await supabase
        .from("chat_messages")
        .select("*")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: true });
      setChatMessages((rawMessages ?? []).map((m) => ({
        ...(m as ChatMessage),
        type: ((m as { type?: ChatMessageType }).type ?? "TEXT") as ChatMessageType,
      })));
    } else {
      setChatMessages([]);
    }

    const reportIds = mappedReports.map((r) => r.id);
    if (reportIds.length > 0) {
      const { data: rawHistory } = await supabase
        .from("report_status_history")
        .select("*")
        .in("report_id", reportIds)
        .order("created_at", { ascending: true });
      setStatusHistory((rawHistory ?? []).map((h) => h as ReportStatusHistory));
    } else {
      setStatusHistory([]);
    }

    setAdminProfiles((profilesRes.data ?? []).map((p) => {
      const raw = p as {
        id?: string;
        user_id?: string;
        display_name: string;
        jabatan_display: string;
        availability_status: AvailabilityStatus;
        wa_number?: string;
        wa_number_encrypted?: string;
        avatar_url: string;
      };

      return {
        user_id: raw.user_id ?? raw.id ?? "",
        display_name: raw.display_name,
        jabatan_display: raw.jabatan_display,
        availability_status: raw.availability_status,
        wa_number: raw.wa_number ?? raw.wa_number_encrypted ?? "",
        avatar_url: raw.avatar_url,
      } satisfies AdminProfile;
    }));

    setAppointments((appointmentsRes.data ?? []).map((a) => a as Appointment));

    setNotifications((notificationsRes.data ?? []).map((n) => {
      const raw = n as {
        id: string;
        user_id: string;
        type: NotificationType;
        title?: string;
        message?: string;
        link?: string;
        payload?: { title?: string; message?: string; link?: string };
        is_read: boolean;
        created_at: string;
      };

      return {
        id: raw.id,
        user_id: raw.user_id,
        type: raw.type,
        title: raw.title ?? raw.payload?.title ?? "Notifikasi",
        message: raw.message ?? raw.payload?.message ?? "",
        link: raw.link ?? raw.payload?.link,
        is_read: raw.is_read,
        created_at: raw.created_at,
      };
    }));
  }, [user]);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  const addNotification = useCallback(
    async (data: { user_id: string; type: NotificationType; title: string; message: string; link?: string }) => {
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

      const { error } = await supabase.from("notifications").insert({
        id: notif.id,
        user_id: notif.user_id,
        type: notif.type,
        payload: {
          title: notif.title,
          message: notif.message,
          link: notif.link,
        },
        is_read: notif.is_read,
        created_at: notif.created_at,
      });

      if (error) {
        return;
      }

      setNotifications((prev) => [notif, ...prev]);
    },
    []
  );

  const addReport = useCallback(
    async (data: { user_id: string; category: ReportCategory; urgency: Urgency; kronologi: string }) => {
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

      const { error } = await supabase.from("reports").insert({
        id: report.id,
        case_id: report.case_id,
        user_id: report.user_id,
        category: report.category,
        urgency: report.urgency,
        kronologi: report.kronologi,
        status: report.status,
        admin_notes: report.admin_notes,
        created_at: report.created_at,
        updated_at: report.updated_at,
      });

      if (error) {
        throw new Error("Gagal menyimpan laporan ke Supabase.");
      }

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

      await supabase.from("report_status_history").insert({
        id: historyEntry.id,
        report_id: historyEntry.report_id,
        old_status: historyEntry.old_status,
        new_status: historyEntry.new_status,
        changed_by: historyEntry.changed_by,
        note: historyEntry.note,
        created_at: historyEntry.created_at,
      });

      setStatusHistory((prev) => [...prev, historyEntry]);

      const senderUser = allUsers.find((u) => u.id === data.user_id);
      const senderName = senderUser?.name ?? "Pengirim";
      const admins = allUsers.filter((u) => u.role === "ADMIN" || u.role === "SUPER_ADMIN");
      await Promise.all(admins.map((admin) =>
        addNotification({
          user_id: admin.id,
          type: "NEW_REPORT",
          title: "Laporan Baru",
          message: `Laporan baru dari ${senderName} — Kategori: ${data.category} (${data.urgency})`,
          link: `/admin/laporan/${report.id}`,
        })
      ));

      return report;
    },
    [addNotification, allUsers]
  );

  const updateReportStatus = useCallback(
    async (reportId: string, newStatus: ReportStatus, adminId: string, note: string = "") => {
      await supabase
        .from("reports")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", reportId);

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

      await supabase.from("report_status_history").insert({
        id: historyEntry.id,
        report_id: historyEntry.report_id,
        old_status: historyEntry.old_status,
        new_status: historyEntry.new_status,
        changed_by: historyEntry.changed_by,
        note: historyEntry.note,
        created_at: historyEntry.created_at,
      });

      setStatusHistory((prev) => [...prev, historyEntry]);

      if (report) {
        await addNotification({
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
    async (reportId: string, newUrgency: Urgency, adminId: string) => {
      void adminId;

      await supabase
        .from("reports")
        .update({ urgency: newUrgency, updated_at: new Date().toISOString() })
        .eq("id", reportId);

      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, urgency: newUrgency, updated_at: new Date().toISOString() }
            : r
        )
      );
      const report = reports.find((r) => r.id === reportId);
      if (report) {
        await addNotification({
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

  const updateReportNotes = useCallback(async (reportId: string, notes: string) => {
    await supabase
      .from("reports")
      .update({ admin_notes: notes, updated_at: new Date().toISOString() })
      .eq("id", reportId);

    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, admin_notes: notes } : r))
    );
  }, []);

  const createChatSession = useCallback(
    async (userId: string, reportId: string | null = null) => {
      const session: ChatSession = {
        id: generateId("cs"),
        report_id: reportId,
        user_id: userId,
        assigned_admin_id: null,
        status: "OPEN",
        created_at: new Date().toISOString(),
        closed_at: null,
      };

      await supabase.from("chat_sessions").insert(session);
      setChatSessions((prev) => [session, ...prev]);

      const senderUser = allUsers.find((u) => u.id === userId);
      const admins = allUsers.filter((u) => u.role === "ADMIN" || u.role === "SUPER_ADMIN");
      await Promise.all(admins.map((admin) =>
        addNotification({
          user_id: admin.id,
          type: "NEW_CHAT_SESSION",
          title: "Sesi Chat Baru",
          message: `Sesi chat baru dari ${senderUser?.name ?? "Pengirim"}`,
          link: "/admin/chat",
        })
      ));

      return session;
    },
    [addNotification, allUsers]
  );

  const assignAdminToSession = useCallback(async (sessionId: string, adminId: string) => {
    await supabase
      .from("chat_sessions")
      .update({ assigned_admin_id: adminId })
      .eq("id", sessionId);

    setChatSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, assigned_admin_id: adminId } : s))
    );
  }, []);

  const closeChatSession = useCallback(
    async (sessionId: string) => {
      const session = chatSessions.find((s) => s.id === sessionId);
      await supabase
        .from("chat_sessions")
        .update({ status: "CLOSED", closed_at: new Date().toISOString() })
        .eq("id", sessionId);

      setChatSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, status: "CLOSED" as const, closed_at: new Date().toISOString() }
            : s
        )
      );

      if (session) {
        await addNotification({
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
    async (
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

      const insertPayload = {
        id: msg.id,
        session_id: msg.session_id,
        sender_id: msg.sender_id,
        content: msg.content,
        type: msg.type,
        media_url: msg.media_url,
        media_name: msg.media_name,
        is_read: msg.is_read,
        read_at: msg.read_at,
        created_at: msg.created_at,
      };
      const insertResult = await supabase.from("chat_messages").insert(insertPayload);
      if (insertResult.error) {
        await supabase.from("chat_messages").insert({
          id: msg.id,
          session_id: msg.session_id,
          sender_id: msg.sender_id,
          content: msg.content,
          is_read: msg.is_read,
          read_at: msg.read_at,
          created_at: msg.created_at,
        });
      }

      setChatMessages((prev) => [...prev, msg]);

      const session = chatSessions.find((s) => s.id === sessionId);
      if (session) {
        const senderUser = allUsers.find((u) => u.id === senderId);
        const isSender = senderId === session.user_id;
        const targetUserId = isSender ? session.assigned_admin_id : session.user_id;
        const preview = type === "TEXT" ? content.slice(0, 60) : `📎 ${mediaName ?? "Media"}`;

        if (targetUserId) {
          await addNotification({
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
    [chatSessions, addNotification, allUsers]
  );

  const markMessagesRead = useCallback(async (sessionId: string, readerId: string) => {
    const now = new Date().toISOString();

    await supabase
      .from("chat_messages")
      .update({ is_read: true, read_at: now })
      .eq("session_id", sessionId)
      .neq("sender_id", readerId)
      .eq("is_read", false);

    setChatMessages((prev) =>
      prev.map((m) =>
        m.session_id === sessionId && m.sender_id !== readerId && !m.is_read
          ? { ...m, is_read: true, read_at: now }
          : m
      )
    );
  }, []);

  const updateAvailability = useCallback(async (adminUserId: string, status: AvailabilityStatus) => {
    await supabase
      .from("admin_profiles")
      .update({ availability_status: status })
      .or(`id.eq.${adminUserId},user_id.eq.${adminUserId}`);

    setAdminProfiles((prev) =>
      prev.map((p) => (p.user_id === adminUserId ? { ...p, availability_status: status } : p))
    );
  }, []);

  const addAdminProfile = useCallback(async (profile: AdminProfile) => {
    await supabase.from("admin_profiles").upsert({
      id: profile.user_id,
      user_id: profile.user_id,
      display_name: profile.display_name,
      jabatan_display: profile.jabatan_display,
      availability_status: profile.availability_status,
      wa_number: profile.wa_number,
      avatar_url: profile.avatar_url,
    });

    setAdminProfiles((prev) => [...prev, profile]);
  }, []);

  const removeAdminProfile = useCallback(async (userId: string) => {
    await supabase
      .from("admin_profiles")
      .delete()
      .or(`id.eq.${userId},user_id.eq.${userId}`);

    setAdminProfiles((prev) => prev.filter((p) => p.user_id !== userId));
  }, []);

  const addAppointment = useCallback(
    async (userId: string, targetAdminId: string) => {
      const apt: Appointment = {
        id: generateId("apt"),
        user_id: userId,
        target_admin_id: targetAdminId,
        created_at: new Date().toISOString(),
      };

      await supabase.from("appointments").insert(apt);
      setAppointments((prev) => [...prev, apt]);

      const senderUser = allUsers.find((u) => u.id === userId);
      await addNotification({
        user_id: targetAdminId,
        type: "APPOINTMENT_REQUEST",
        title: "Permintaan Janji Temu",
        message: `Permintaan janji temu baru dari ${senderUser?.name ?? "Pengirim"}`,
      });

      return apt;
    },
    [addNotification, allUsers]
  );

  const markNotificationRead = useCallback(async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
  }, []);

  const markAllNotificationsRead = useCallback(async (userId: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId);

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
