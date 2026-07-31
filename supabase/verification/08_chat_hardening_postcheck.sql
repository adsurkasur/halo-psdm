-- READ-ONLY post-check for 08_chat_history_retention_and_audit.sql.
-- Every row except summary_counts_after should report passed = true.

WITH expected_columns(table_name, column_name, expected_udt) AS (
  VALUES
    ('chat_sessions', 'user_name_snapshot', 'text'),
    ('chat_sessions', 'assigned_admin_name_snapshot', 'text'),
    ('chat_sessions', 'created_by', 'uuid'),
    ('chat_sessions', 'hidden_at', 'timestamptz'),
    ('chat_sessions', 'hidden_by', 'uuid'),
    ('chat_sessions', 'hidden_by_name_snapshot', 'text'),
    ('chat_sessions', 'hidden_reason', 'text'),
    ('chat_messages', 'sender_name_snapshot', 'text'),
    ('notifications', 'session_id', 'uuid'),
    ('notifications', 'archived_at', 'timestamptz')
),
column_report AS (
  SELECT
    e.table_name,
    e.column_name,
    e.expected_udt,
    c.udt_name AS actual_udt,
    c.udt_name = e.expected_udt AS valid
  FROM expected_columns e
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name = e.table_name
   AND c.column_name = e.column_name
),
expected_functions(signature) AS (
  VALUES
    ('public.assign_chat_session_retained(uuid,uuid,text)'),
    ('public.close_chat_session_retained(uuid,uuid,text)'),
    ('public.hide_chat_session_retained(uuid,uuid,text,text)'),
    ('public.restore_chat_session_retained(uuid,uuid,text)'),
    ('public.prevent_unaudited_chat_transition()'),
    ('public.prevent_chat_history_delete()'),
    ('public.prevent_chat_event_mutation()')
),
function_report AS (
  SELECT signature, to_regprocedure(signature) IS NOT NULL AS valid
  FROM expected_functions
),
expected_triggers(table_name, trigger_name) AS (
  VALUES
    ('chat_sessions', 'trg_audit_new_chat_session'),
    ('chat_sessions', 'trg_prevent_unaudited_chat_transition'),
    ('chat_sessions', 'trg_prevent_chat_session_delete'),
    ('chat_messages', 'trg_prevent_chat_message_delete'),
    ('chat_session_events', 'trg_prevent_chat_event_mutation')
),
actual_triggers AS (
  SELECT c.relname AS table_name, t.tgname AS trigger_name, t.tgenabled
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND NOT t.tgisinternal
),
trigger_report AS (
  SELECT
    e.table_name,
    e.trigger_name,
    a.tgenabled,
    a.trigger_name IS NOT NULL AND a.tgenabled IN ('O', 'A') AS valid
  FROM expected_triggers e
  LEFT JOIN actual_triggers a
    ON a.table_name = e.table_name
   AND a.trigger_name = e.trigger_name
),
expected_fks(constraint_name, expected_delete_action) AS (
  VALUES
    ('chat_sessions_report_id_fkey', 'n'),
    ('chat_sessions_user_id_fkey', 'n'),
    ('chat_sessions_assigned_admin_id_fkey', 'n'),
    ('chat_sessions_created_by_fkey', 'n'),
    ('chat_sessions_hidden_by_fkey', 'n'),
    ('chat_messages_session_id_fkey', 'r'),
    ('chat_messages_sender_id_fkey', 'n'),
    ('notifications_session_id_fkey', 'r')
),
fk_report AS (
  SELECT
    e.constraint_name,
    e.expected_delete_action,
    c.confdeltype::text AS actual_delete_action,
    pg_get_constraintdef(c.oid) AS definition,
    c.oid IS NOT NULL AND c.confdeltype::text = e.expected_delete_action AS valid
  FROM expected_fks e
  LEFT JOIN pg_constraint c
    ON c.conname = e.constraint_name
   AND c.contype = 'f'
   AND c.connamespace = 'public'::regnamespace
),
integrity AS (
  SELECT
    (SELECT count(*) FROM public.chat_sessions WHERE hidden_at IS NOT NULL AND status <> 'CLOSED') AS hidden_open_sessions,
    (
      SELECT count(*) FROM public.chat_messages cm
      LEFT JOIN public.chat_sessions cs ON cs.id = cm.session_id
      WHERE cs.id IS NULL
    ) AS orphan_messages,
    (
      SELECT count(*) FROM public.notifications n
      LEFT JOIN public.chat_sessions cs ON cs.id = n.session_id
      WHERE n.session_id IS NOT NULL AND cs.id IS NULL
    ) AS orphan_notification_sessions,
    (
      SELECT count(*) FROM public.chat_sessions cs
      LEFT JOIN public.chat_session_events e ON e.session_id = cs.id
      WHERE e.id IS NULL
    ) AS sessions_without_audit_event,
    (
      SELECT count(*) FROM public.chat_sessions
      WHERE user_id IS NOT NULL AND user_name_snapshot IS NULL
    ) AS missing_session_user_snapshots,
    (
      SELECT count(*) FROM public.chat_sessions
      WHERE assigned_admin_id IS NOT NULL AND assigned_admin_name_snapshot IS NULL
    ) AS missing_session_admin_snapshots,
    (
      SELECT count(*) FROM public.chat_messages
      WHERE sender_id IS NOT NULL AND sender_name_snapshot IS NULL
    ) AS missing_message_sender_snapshots
),
permissions AS (
  SELECT
    NOT has_table_privilege('authenticated', 'public.chat_sessions', 'DELETE') AS authenticated_cannot_delete_sessions,
    NOT has_table_privilege('authenticated', 'public.chat_messages', 'DELETE') AS authenticated_cannot_delete_messages,
    has_function_privilege('service_role', 'public.assign_chat_session_retained(uuid,uuid,text)', 'EXECUTE') AS service_can_assign,
    has_function_privilege('service_role', 'public.close_chat_session_retained(uuid,uuid,text)', 'EXECUTE') AS service_can_close,
    has_function_privilege('service_role', 'public.hide_chat_session_retained(uuid,uuid,text,text)', 'EXECUTE') AS service_can_hide,
    has_function_privilege('service_role', 'public.restore_chat_session_retained(uuid,uuid,text)', 'EXECUTE') AS service_can_restore
)
SELECT sort_order, check_name, passed, details
FROM (
  SELECT
    1 AS sort_order,
    'required_columns' AS check_name,
    NOT EXISTS (SELECT 1 FROM column_report WHERE valid IS DISTINCT FROM true) AS passed,
    (SELECT jsonb_agg(to_jsonb(column_report) ORDER BY table_name, column_name) FROM column_report) AS details

  UNION ALL

  SELECT
    2,
    'required_functions',
    NOT EXISTS (SELECT 1 FROM function_report WHERE NOT valid),
    (SELECT jsonb_agg(to_jsonb(function_report) ORDER BY signature) FROM function_report)

  UNION ALL

  SELECT
    3,
    'required_triggers',
    NOT EXISTS (SELECT 1 FROM trigger_report WHERE NOT valid),
    (SELECT jsonb_agg(to_jsonb(trigger_report) ORDER BY table_name, trigger_name) FROM trigger_report)

  UNION ALL

  SELECT
    4,
    'safe_foreign_keys',
    NOT EXISTS (SELECT 1 FROM fk_report WHERE NOT valid),
    (SELECT jsonb_agg(to_jsonb(fk_report) ORDER BY constraint_name) FROM fk_report)

  UNION ALL

  SELECT
    5,
    'role_permissions',
    (
      authenticated_cannot_delete_sessions
      AND authenticated_cannot_delete_messages
      AND service_can_assign
      AND service_can_close
      AND service_can_hide
      AND service_can_restore
    ),
    to_jsonb(permissions)
  FROM permissions

  UNION ALL

  SELECT
    6,
    'data_integrity',
    (
      hidden_open_sessions = 0
      AND orphan_messages = 0
      AND orphan_notification_sessions = 0
      AND sessions_without_audit_event = 0
      AND missing_session_user_snapshots = 0
      AND missing_session_admin_snapshots = 0
      AND missing_message_sender_snapshots = 0
    ),
    to_jsonb(integrity)
  FROM integrity

  UNION ALL

  SELECT
    7,
    'audit_rls_enabled',
    COALESCE((
      SELECT c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'chat_session_events'
    ), false),
    jsonb_build_object(
      'rls_enabled', COALESCE((
        SELECT c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'chat_session_events'
      ), false)
    )

  UNION ALL

  SELECT
    8,
    'summary_counts_after',
    true,
    jsonb_build_object(
      'checked_at_wib', timezone('Asia/Jakarta', now()),
      'chat_sessions', (SELECT count(*) FROM public.chat_sessions),
      'chat_messages', (SELECT count(*) FROM public.chat_messages),
      'notifications', (SELECT count(*) FROM public.notifications),
      'visible_notifications', (SELECT count(*) FROM public.notifications WHERE archived_at IS NULL),
      'hidden_sessions', (SELECT count(*) FROM public.chat_sessions WHERE hidden_at IS NOT NULL),
      'audit_events', (SELECT count(*) FROM public.chat_session_events),
      'migrated_events', (SELECT count(*) FROM public.chat_session_events WHERE event_type = 'MIGRATED')
    )
) checks
ORDER BY sort_order;
