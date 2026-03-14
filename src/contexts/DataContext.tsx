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
  type AppointmentStatus,
} from "@/data/domain";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface DataContextType {
  isBusy: boolean;
  dataLoadIssues: string[];
  lastSyncedAt: string | null;
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
  updateAppointmentStatus: (appointmentId: string, status: AppointmentStatus, statusNote?: string) => Promise<void>;

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
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [statusHistory, setStatusHistory] = useState<ReportStatusHistory[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<AdminProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const inFlightRequestsRef = useRef<Map<string, Promise<unknown>>>(new Map());
  const pendingRealtimeTablesRef = useRef<Set<string>>(new Set());
  const reloadDebounceTimerRef = useRef<number | null>(null);
  const backgroundRefreshInFlightRef = useRef(false);
  const lastUserActivityAtRef = useRef(Date.now());
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

  const markSyncedNow = useCallback(() => {
    setLastSyncedAt(new Date().toISOString());
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

  const clearAllData = useCallback(() => {
    setReports([]);
    setStatusHistory([]);
    setChatSessions([]);
    setChatMessages([]);
    setAdminProfiles([]);
    setAppointments([]);
    setNotifications([]);
    setDataLoadIssues([]);
  }, []);

  const reloadReportsAndHistory = useCallback(async (): Promise<string[]> => {
    if (!user) {
      setReports([]);
      setStatusHistory([]);
      return [];
    }

    const issues: string[] = [];
    const isPh = user.role === "PH";
    const reportsRes = isPh
      ? await supabase.from("reports").select("*").order("created_at", { ascending: false })
      : await supabase.from("reports").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

    if (reportsRes.error) {
      setReports([]);
      setStatusHistory([]);
      issues.push(`Laporan: ${reportsRes.error.message}`);
      return issues;
    }

    const mappedReports = (reportsRes.data ?? []).map((r) => r as Report);
    setReports(mappedReports);

    const reportIds = mappedReports.map((r) => r.id);
    if (reportIds.length === 0) {
      setStatusHistory([]);
      markSyncedNow();
      return issues;
    }

    const historyRes = await supabase
      .from("report_status_history")
      .select("*")
      .in("report_id", reportIds)
      .order("created_at", { ascending: true });

    if (historyRes.error) {
      setStatusHistory([]);
      issues.push(`Riwayat status: ${historyRes.error.message}`);
    } else {
      setStatusHistory((historyRes.data ?? []).map((h) => h as ReportStatusHistory));
    }

    markSyncedNow();
    return issues;
  }, [markSyncedNow, user]);

  const reloadSessionsAndMessages = useCallback(async (): Promise<string[]> => {
    if (!user) {
      setChatSessions([]);
      setChatMessages([]);
      return [];
    }

    const issues: string[] = [];
    const isPh = user.role === "PH";
    let mappedSessions: ChatSession[] = [];

    if (isPh) {
      const sessionsRes = await supabase.from("chat_sessions").select("*").order("created_at", { ascending: false });
      if (sessionsRes.error) {
        setChatSessions([]);
        setChatMessages([]);
        issues.push(`Sesi chat: ${sessionsRes.error.message}`);
        return issues;
      }
      mappedSessions = (sessionsRes.data ?? []).map((s) => s as ChatSession);
    } else {
      const sessionsByUserRes = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (sessionsByUserRes.error) {
        setChatSessions([]);
        setChatMessages([]);
        issues.push(`Sesi chat: ${sessionsByUserRes.error.message}`);
        return issues;
      }

      const reportIdsRes = await supabase.from("reports").select("id").eq("user_id", user.id);
      if (reportIdsRes.error) {
        issues.push(`ID laporan untuk sinkron sesi chat: ${reportIdsRes.error.message}`);
      }

      const reportIds = (reportIdsRes.data ?? []).map((row) => row.id as string);
      let sessionsByReport: ChatSession[] = [];
      if (reportIds.length > 0) {
        const sessionsByReportRes = await supabase
          .from("chat_sessions")
          .select("*")
          .in("report_id", reportIds)
          .order("created_at", { ascending: false });

        if (sessionsByReportRes.error) {
          issues.push(`Sesi chat berbasis laporan: ${sessionsByReportRes.error.message}`);
        } else {
          sessionsByReport = (sessionsByReportRes.data ?? []).map((s) => s as ChatSession);
        }
      }

      const merged = [...(sessionsByUserRes.data ?? []), ...sessionsByReport];
      const deduped = new Map<string, ChatSession>();
      for (const session of merged) {
        deduped.set(session.id, session as ChatSession);
      }
      mappedSessions = Array.from(deduped.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }

    setChatSessions(mappedSessions);

    const sessionIds = mappedSessions.map((s) => s.id);
    if (sessionIds.length === 0) {
      setChatMessages([]);
      markSyncedNow();
      return issues;
    }

    const messagesRes = await supabase
      .from("chat_messages")
      .select("*")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true });

    if (messagesRes.error) {
      setChatMessages([]);
      issues.push(`Pesan chat: ${messagesRes.error.message}`);
    } else {
      setChatMessages((messagesRes.data ?? []).map((m) => ({
        ...(m as ChatMessage),
        type: ((m as { type?: ChatMessageType }).type ?? "TEXT") as ChatMessageType,
      })));
    }

    markSyncedNow();
    return issues;
  }, [markSyncedNow, user]);

  const reloadAppointments = useCallback(async (): Promise<string[]> => {
    if (!user) {
      setAppointments([]);
      return [];
    }

    const isPh = user.role === "PH";
    const res = isPh
      ? await supabase.from("appointments").select("*").order("created_at", { ascending: false })
      : await supabase.from("appointments").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

    if (res.error) {
      setAppointments([]);
      return [`Janji temu: ${res.error.message}`];
    }

    setAppointments(
      (res.data ?? []).map((a) => {
        const raw = a as Partial<Appointment>;
        return {
          id: raw.id ?? "",
          user_id: raw.user_id ?? "",
          target_admin_id: raw.target_admin_id ?? "",
          status: raw.status ?? "OPEN",
          status_note: raw.status_note ?? null,
          handled_by: raw.handled_by ?? null,
          handled_at: raw.handled_at ?? null,
          created_at: raw.created_at ?? new Date().toISOString(),
        } as Appointment;
      }),
    );
    markSyncedNow();
    return [];
  }, [markSyncedNow, user]);

  const reloadAdminProfiles = useCallback(async (): Promise<string[]> => {
    const res = await supabase.from("admin_profiles").select("*");
    if (res.error) {
      setAdminProfiles([]);
      return [`Direktori admin: ${res.error.message}`];
    }

    setAdminProfiles(mapAdminProfiles(res.data ?? []));
    markSyncedNow();
    return [];
  }, [mapAdminProfiles, markSyncedNow]);

  const reloadNotifications = useCallback(async (): Promise<string[]> => {
    if (!user) {
      setNotifications([]);
      return [];
    }

    const res = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (res.error) {
      setNotifications([]);
      return [`Notifikasi: ${res.error.message}`];
    }

    setNotifications(mapNotifications(res.data ?? []));
    markSyncedNow();
    return [];
  }, [mapNotifications, markSyncedNow, user]);

  const runReloadsAndCollectIssues = useCallback(async (reloaders: Array<() => Promise<string[]>>) => {
    const grouped = await Promise.all(reloaders.map((reloader) => reloader()));
    const issues = grouped.flat();
    if (issues.length > 0 && user) {
      console.warn("[DATA_LOAD_PARTIAL_WARN]", { userId: user.id, issues });
    }
    setDataLoadIssues(issues);
  }, [user]);

  const refreshByTables = useCallback(async (tables: Set<string>, options?: { trackBusy?: boolean }) => {
    if (!user) {
      clearAllData();
      return;
    }

    const reloaders = new Set<() => Promise<string[]>>();
    for (const table of tables) {
      if (table === "reports" || table === "report_status_history") {
        reloaders.add(reloadReportsAndHistory);
      } else if (table === "chat_sessions" || table === "chat_messages") {
        reloaders.add(reloadSessionsAndMessages);
      } else if (table === "appointments") {
        reloaders.add(reloadAppointments);
      } else if (table === "notifications") {
        reloaders.add(reloadNotifications);
      } else if (table === "admin_profiles") {
        reloaders.add(reloadAdminProfiles);
      }
    }

    const chosenReloaders = reloaders.size > 0
      ? Array.from(reloaders)
      : [
          reloadReportsAndHistory,
          reloadSessionsAndMessages,
          reloadAdminProfiles,
          reloadAppointments,
          reloadNotifications,
        ];

    const trackBusy = options?.trackBusy ?? true;
    if (trackBusy) {
      await withBusy(async () => {
        await runReloadsAndCollectIssues(chosenReloaders);
      });
      return;
    }

    await runReloadsAndCollectIssues(chosenReloaders);
  }, [
    clearAllData,
    reloadAdminProfiles,
    reloadAppointments,
    reloadNotifications,
    reloadReportsAndHistory,
    reloadSessionsAndMessages,
    runReloadsAndCollectIssues,
    user,
    withBusy,
  ]);

  const refreshByTablesBackground = useCallback(async (tables: Set<string>) => {
    if (backgroundRefreshInFlightRef.current) {
      return;
    }

    backgroundRefreshInFlightRef.current = true;
    try {
      await refreshByTables(tables, { trackBusy: false });
    } finally {
      backgroundRefreshInFlightRef.current = false;
    }
  }, [refreshByTables]);

  const loadAllData = useCallback(async () => {
    if (!user) {
      clearAllData();
      return;
    }

    await withBusy(async () => {
      await runReloadsAndCollectIssues([
        reloadReportsAndHistory,
        reloadSessionsAndMessages,
        reloadAdminProfiles,
        reloadAppointments,
        reloadNotifications,
      ]);
    });
  }, [
    clearAllData,
    reloadAdminProfiles,
    reloadAppointments,
    reloadNotifications,
    reloadReportsAndHistory,
    reloadSessionsAndMessages,
    runReloadsAndCollectIssues,
    user,
    withBusy,
  ]);

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
    const pendingRealtimeTables = pendingRealtimeTablesRef.current;

    const scheduleReload = (table: string) => {
      pendingRealtimeTables.add(table);
      if (reloadDebounceTimerRef.current) {
        window.clearTimeout(reloadDebounceTimerRef.current);
      }

      reloadDebounceTimerRef.current = window.setTimeout(() => {
        const tablesToRefresh = new Set(pendingRealtimeTables);
        pendingRealtimeTables.clear();
        void refreshByTablesBackground(tablesToRefresh);
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
        () => scheduleReload(table)
      );
    }

    void channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        void refreshByTablesBackground(new Set(["chat_sessions", "chat_messages", "reports", "report_status_history"]));
      }
    });

    return () => {
      if (reloadDebounceTimerRef.current) {
        window.clearTimeout(reloadDebounceTimerRef.current);
        reloadDebounceTimerRef.current = null;
      }
      pendingRealtimeTables.clear();
      void supabase.removeChannel(channel);
    };
  }, [refreshByTablesBackground, user]);

  useEffect(() => {
    if (!user) return;

    const shouldSyncNow = () => document.visibilityState === "visible";
    const isChatRoute = (path: string) => path.includes("/chat") || path.includes("/admin/chat");
    const isReportRoute = (path: string) => path.includes("/laporan") || path.includes("/admin");

    const markActivity = () => {
      lastUserActivityAtRef.current = Date.now();
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "mousemove",
      "keydown",
      "pointerdown",
      "touchstart",
      "scroll",
    ];

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, markActivity, { passive: true });
    }

    let lastChatSyncAt = 0;
    let lastReportSyncAt = 0;
    let lastNotificationSyncAt = 0;

    const syncTick = window.setInterval(() => {
      if (!shouldSyncNow()) return;

      const now = Date.now();
      const isIdle = now - lastUserActivityAtRef.current > 30000;
      const path = window.location.pathname;

      if (isChatRoute(path)) {
        const chatIntervalMs = isIdle ? 4500 : 1200;
        if (now - lastChatSyncAt >= chatIntervalMs) {
          lastChatSyncAt = now;
          void refreshByTablesBackground(new Set(["chat_sessions", "chat_messages", "notifications"]));
        }
        return;
      }

      if (isReportRoute(path)) {
        const reportIntervalMs = isIdle ? 18000 : 10000;
        if (now - lastReportSyncAt >= reportIntervalMs) {
          lastReportSyncAt = now;
          void refreshByTablesBackground(new Set(["reports", "report_status_history", "appointments", "admin_profiles", "notifications"]));
        }
        return;
      }

      const notificationIntervalMs = isIdle ? 45000 : 20000;
      if (now - lastNotificationSyncAt >= notificationIntervalMs) {
        lastNotificationSyncAt = now;
        void refreshByTablesBackground(new Set(["notifications"]));
      }
    }, 1000);

    return () => {
      window.clearInterval(syncTick);
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, markActivity);
      }
    };
  }, [refreshByTablesBackground, user]);

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
      const response = await callSecureApi<{ session: ChatSession }>("/api/secure/chat/sessions", {
        method: "POST",
        body: JSON.stringify({ userId, reportId }),
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

  const updateAppointmentStatus = useCallback(
    async (appointmentId: string, status: AppointmentStatus, statusNote?: string) => {
      const response = await callSecureApi<{ appointment: Appointment }>("/api/secure/appointments", {
        method: "PATCH",
        body: JSON.stringify({ appointmentId, status, statusNote }),
      });

      setAppointments((prev) =>
        prev.map((appointment) =>
          appointment.id === appointmentId ? response.appointment : appointment,
        ),
      );
    },
    [callSecureApi],
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
        lastSyncedAt,
        reloadData,
        reports, statusHistory, addReport, updateReportStatus, updateReportUrgency, updateReportNotes,
        chatSessions, chatMessages, createChatSession, assignAdminToSession, closeChatSession, addChatMessage, markMessagesRead,
        adminProfiles, updateAvailability, addAdminProfile, removeAdminProfile,
        appointments, addAppointment, updateAppointmentStatus,
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
