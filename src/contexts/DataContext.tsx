import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  generateId,
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
  isBusy: boolean;
  dataLoadIssues: string[];
  reloadData: () => Promise<void>;
  reports: Report[];
  statusHistory: ReportStatusHistory[];
  addReport: (data: {
    user_id: string;
    category: ReportCategory;
    urgency: Urgency;
    kronologi: string;
    attachment_url?: string | null;
    attachment_name?: string | null;
    attachment_path?: string | null;
    attachment_mime?: string | null;
    attachment_size?: number | null;
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
  const API_TIMEOUT_MS = 15000;
  const { user } = useAuth();
  const [pendingOps, setPendingOps] = useState(0);
  const [dataLoadIssues, setDataLoadIssues] = useState<string[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [statusHistory, setStatusHistory] = useState<ReportStatusHistory[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<AdminProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const inFlightRequestsRef = useRef<Map<string, Promise<unknown>>>(new Map());
  const reloadDebounceTimerRef = useRef<number | null>(null);
  const isBusy = pendingOps > 0;

  const mapAdminProfiles = useCallback((rows: unknown[]) => {
    return rows.map((p) => {
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
    });
  }, []);

  const mapNotifications = useCallback((rows: unknown[]) => {
    return rows.map((n) => {
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
    });
  }, []);

  const withBusy = useCallback(async <T,>(executor: () => Promise<T>): Promise<T> => {
    setPendingOps((prev) => prev + 1);
    try {
      return await executor();
    } finally {
      setPendingOps((prev) => Math.max(0, prev - 1));
    }
  }, []);

  const callSecureApi = useCallback(
    async <T,>(path: string, init: RequestInit): Promise<T> => {
      const method = (init.method ?? "GET").toUpperCase();
      const requestBody = typeof init.body === "string" ? init.body : "";
      const requestKey = `${method}:${path}:${requestBody}`;

      const existing = inFlightRequestsRef.current.get(requestKey);
      if (existing) {
        return (await existing) as T;
      }

      const requestPromise = withBusy(async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, API_TIMEOUT_MS);

      try {
        const response = await fetch(path, {
          ...init,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(init.headers ?? {}),
          },
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;
        if (!response.ok) {
          throw new Error(payload.error ?? `API error (${response.status})`);
        }

        return payload;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error("Permintaan melebihi batas waktu. Coba lagi beberapa saat.");
        }
        throw error;
      } finally {
        window.clearTimeout(timeoutId);
      }
      });

      inFlightRequestsRef.current.set(requestKey, requestPromise as Promise<unknown>);

      try {
        return (await requestPromise) as T;
      } finally {
        inFlightRequestsRef.current.delete(requestKey);
      }
    },
    [withBusy]
  );

  const loadAllData = useCallback(async () => {
    if (!user) {
      setReports([]);
      setStatusHistory([]);
      setChatSessions([]);
      setChatMessages([]);
      setAdminProfiles([]);
      setAppointments([]);
      setNotifications([]);
      setDataLoadIssues([]);
      return;
    }

    await withBusy(async () => {
      const isPh = user.role === "PH";
      const issues: string[] = [];

      const reportsQuery = isPh
        ? supabase.from("reports").select("*").order("created_at", { ascending: false })
        : supabase.from("reports").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

      const sessionsQuery = isPh
        ? supabase.from("chat_sessions").select("*").order("created_at", { ascending: false })
        : supabase.from("chat_sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

      const appointmentsQuery = isPh
        ? supabase.from("appointments").select("*").order("created_at", { ascending: false })
        : supabase.from("appointments").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

      const [reportsRes, sessionsRes, profilesRes, appointmentsRes, notificationsRes] = await Promise.all([
        reportsQuery,
        sessionsQuery,
        supabase.from("admin_profiles").select("*"),
        appointmentsQuery,
        supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);

      if (reportsRes.error) {
        issues.push(`Laporan: ${reportsRes.error.message}`);
      }
      if (sessionsRes.error) {
        issues.push(`Sesi chat: ${sessionsRes.error.message}`);
      }
      if (profilesRes.error) {
        issues.push(`Direktori admin: ${profilesRes.error.message}`);
      }
      if (appointmentsRes.error) {
        issues.push(`Janji temu: ${appointmentsRes.error.message}`);
      }
      if (notificationsRes.error) {
        issues.push(`Notifikasi: ${notificationsRes.error.message}`);
      }

      const mappedReports = reportsRes.error
        ? []
        : (reportsRes.data ?? []).map((r) => r as Report);
      setReports(mappedReports);

      const mappedSessions = sessionsRes.error
        ? []
        : (sessionsRes.data ?? []).map((s) => s as ChatSession);
      setChatSessions(mappedSessions);

      const sessionIds = mappedSessions.map((s) => s.id);
      if (sessionIds.length > 0) {
        const { data: rawMessages, error: messagesError } = await supabase
          .from("chat_messages")
          .select("*")
          .in("session_id", sessionIds)
          .order("created_at", { ascending: true });

        if (messagesError) {
          issues.push(`Pesan chat: ${messagesError.message}`);
          setChatMessages([]);
        } else {
          setChatMessages((rawMessages ?? []).map((m) => ({
            ...(m as ChatMessage),
            type: ((m as { type?: ChatMessageType }).type ?? "TEXT") as ChatMessageType,
          })));
        }
      } else {
        setChatMessages([]);
      }

      const reportIds = mappedReports.map((r) => r.id);
      if (reportIds.length > 0) {
        const { data: rawHistory, error: historyError } = await supabase
          .from("report_status_history")
          .select("*")
          .in("report_id", reportIds)
          .order("created_at", { ascending: true });

        if (historyError) {
          issues.push(`Riwayat status: ${historyError.message}`);
          setStatusHistory([]);
        } else {
          setStatusHistory((rawHistory ?? []).map((h) => h as ReportStatusHistory));
        }
      } else {
        setStatusHistory([]);
      }

      setAdminProfiles(profilesRes.error ? [] : mapAdminProfiles(profilesRes.data ?? []));
      setAppointments(appointmentsRes.error ? [] : (appointmentsRes.data ?? []).map((a) => a as Appointment));
      setNotifications(notificationsRes.error ? [] : mapNotifications(notificationsRes.data ?? []));

      if (issues.length > 0) {
        console.warn("[DATA_LOAD_PARTIAL_WARN]", { userId: user.id, issues });
      }
      setDataLoadIssues(issues);
    });
  }, [mapAdminProfiles, mapNotifications, user, withBusy]);

  const reloadData = useCallback(async () => {
    await loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    if (!user) return;
    if (typeof supabase.channel !== "function" || typeof supabase.removeChannel !== "function") {
      return;
    }

    const scheduleReload = () => {
      if (reloadDebounceTimerRef.current) {
        window.clearTimeout(reloadDebounceTimerRef.current);
      }

      reloadDebounceTimerRef.current = window.setTimeout(() => {
        void loadAllData();
      }, 350);
    };

    const watchedTables = [
      "reports",
      "report_status_history",
      "chat_sessions",
      "chat_messages",
      "appointments",
      "notifications",
      "admin_profiles",
    ];

    const channel = supabase.channel(`live-data-${user.id}-${user.role}`);
    for (const table of watchedTables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => scheduleReload()
      );
    }

    void channel.subscribe();

    return () => {
      if (reloadDebounceTimerRef.current) {
        window.clearTimeout(reloadDebounceTimerRef.current);
        reloadDebounceTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [loadAllData, user]);

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
    async (data: {
      user_id: string;
      category: ReportCategory;
      urgency: Urgency;
      kronologi: string;
      attachment_url?: string | null;
      attachment_name?: string | null;
      attachment_path?: string | null;
      attachment_mime?: string | null;
      attachment_size?: number | null;
    }) => {
      const response = await callSecureApi<{ report: Report; historyEntry: ReportStatusHistory }>("/api/secure/reports", {
        method: "POST",
        body: JSON.stringify({
          category: data.category,
          urgency: data.urgency,
          kronologi: data.kronologi,
          attachment_url: data.attachment_url,
          attachment_name: data.attachment_name,
          attachment_path: data.attachment_path,
          attachment_mime: data.attachment_mime,
          attachment_size: data.attachment_size,
        }),
      });

      setReports((prev) => [response.report, ...prev]);
      setStatusHistory((prev) => [...prev, response.historyEntry]);

      return response.report;
    },
    [callSecureApi]
  );

  const updateReportStatus = useCallback(
    async (reportId: string, newStatus: ReportStatus, adminId: string, note: string = "") => {
      void adminId;

      const response = await callSecureApi<{ historyEntry: ReportStatusHistory }>(`/api/secure/reports/${reportId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ newStatus, note }),
      });

      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, status: newStatus, updated_at: new Date().toISOString() }
            : r
        )
      );

      setStatusHistory((prev) => [...prev, response.historyEntry]);
    },
    [callSecureApi]
  );

  const updateReportUrgency = useCallback(
    async (reportId: string, newUrgency: Urgency, adminId: string) => {
      void adminId;

      await callSecureApi(`/api/secure/reports/${reportId}/urgency`, {
        method: "PATCH",
        body: JSON.stringify({ newUrgency }),
      });

      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, urgency: newUrgency, updated_at: new Date().toISOString() }
            : r
        )
      );
    },
    [callSecureApi]
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
      void userId;

      const response = await callSecureApi<{ session: ChatSession }>("/api/secure/chat/sessions", {
        method: "POST",
        body: JSON.stringify({ reportId }),
      });

      setChatSessions((prev) => [response.session, ...prev]);
      return response.session;
    },
    [callSecureApi]
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
      const response = await callSecureApi<{ closed_at: string }>(`/api/secure/chat/sessions/${sessionId}/close`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      setChatSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, status: "CLOSED" as const, closed_at: response.closed_at }
            : s
        )
      );
    },
    [callSecureApi]
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
      void senderId;

      const response = await callSecureApi<{ message: ChatMessage }>("/api/secure/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          content,
          type,
          mediaUrl,
          mediaName,
        }),
      });

      setChatMessages((prev) => [...prev, response.message]);

      return response.message;
    },
    [callSecureApi]
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

    setAdminProfiles((prev) => {
      const existingIndex = prev.findIndex((item) => item.user_id === profile.user_id);
      if (existingIndex === -1) {
        return [...prev, profile];
      }

      const next = [...prev];
      next[existingIndex] = profile;
      return next;
    });
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
      void userId;

      const response = await callSecureApi<{ appointment: Appointment }>("/api/secure/appointments", {
        method: "POST",
        body: JSON.stringify({ targetAdminId }),
      });

      setAppointments((prev) => [...prev, response.appointment]);

      return response.appointment;
    },
    [callSecureApi]
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
        isBusy,
        dataLoadIssues,
        reloadData,
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
