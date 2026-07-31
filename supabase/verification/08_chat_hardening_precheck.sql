-- READ-ONLY pre-check for 08_chat_history_retention_and_audit.sql.
-- Safe to run before the migration. Copy all result rows back for review.

WITH expected_columns(table_name, column_name, expected_udt) AS (
  VALUES
    ('users', 'id', 'uuid'),
    ('users', 'name', 'text'),
    ('users', 'role', 'text'),
    ('reports', 'id', 'uuid'),
    ('admin_profiles', 'user_id', 'uuid'),
    ('admin_profiles', 'display_name', 'text'),
    ('chat_sessions', 'id', 'uuid'),
    ('chat_sessions', 'report_id', 'uuid'),
    ('chat_sessions', 'user_id', 'uuid'),
    ('chat_sessions', 'assigned_admin_id', 'uuid'),
    ('chat_sessions', 'status', 'text'),
    ('chat_sessions', 'created_at', 'timestamptz'),
    ('chat_sessions', 'closed_at', 'timestamptz'),
    ('chat_messages', 'id', 'uuid'),
    ('chat_messages', 'session_id', 'uuid'),
    ('chat_messages', 'sender_id', 'uuid'),
    ('notifications', 'id', 'uuid'),
    ('notifications', 'user_id', 'uuid'),
    ('notifications', 'payload', 'jsonb'),
    ('notifications', 'link', 'text'),
    ('notifications', 'is_read', 'bool'),
    ('notifications', 'created_at', 'timestamptz')
),
actual_columns AS (
  SELECT table_name, column_name, udt_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
),
column_report AS (
  SELECT
    e.table_name,
    e.column_name,
    e.expected_udt,
    a.udt_name AS actual_udt,
    a.udt_name = e.expected_udt AS compatible
  FROM expected_columns e
  LEFT JOIN actual_columns a
    ON a.table_name = e.table_name
   AND a.column_name = e.column_name
),
current_fks AS (
  SELECT
    c.conname,
    c.conrelid::regclass::text AS source_table,
    pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.conrelid IN (
      'public.chat_sessions'::regclass,
      'public.chat_messages'::regclass,
      'public.notifications'::regclass
    )
),
notification_links AS (
  SELECT
    COALESCE(NULLIF(n.link, ''), n.payload ->> 'link') AS target_link
  FROM public.notifications n
),
integrity AS (
  SELECT
    (SELECT count(*) FROM public.chat_sessions WHERE status NOT IN ('OPEN', 'CLOSED')) AS invalid_session_statuses,
    (
      SELECT count(*)
      FROM public.chat_messages cm
      LEFT JOIN public.chat_sessions cs ON cs.id = cm.session_id
      WHERE cs.id IS NULL
    ) AS orphan_messages,
    (
      SELECT count(*)
      FROM public.chat_sessions cs
      LEFT JOIN public.users u ON u.id = cs.user_id
      WHERE cs.user_id IS NOT NULL AND u.id IS NULL
    ) AS orphan_session_users,
    (
      SELECT count(*)
      FROM public.chat_sessions cs
      LEFT JOIN public.users u ON u.id = cs.assigned_admin_id
      WHERE cs.assigned_admin_id IS NOT NULL AND u.id IS NULL
    ) AS orphan_assigned_admins,
    (
      SELECT count(*)
      FROM public.chat_sessions cs
      LEFT JOIN public.reports r ON r.id = cs.report_id
      WHERE cs.report_id IS NOT NULL AND r.id IS NULL
    ) AS orphan_session_reports
)
SELECT sort_order, check_name, details
FROM (
  SELECT
    1 AS sort_order,
    'database_context' AS check_name,
    jsonb_build_object(
      'checked_at_wib', timezone('Asia/Jakarta', now()),
      'database', current_database(),
      'executed_as', current_user,
      'server_version', current_setting('server_version')
    ) AS details

  UNION ALL

  SELECT
    2,
    'required_column_types',
    jsonb_build_object(
      'all_compatible', NOT EXISTS (SELECT 1 FROM column_report WHERE compatible IS DISTINCT FROM true),
      'columns', (SELECT jsonb_agg(to_jsonb(column_report) ORDER BY table_name, column_name) FROM column_report)
    )

  UNION ALL

  SELECT
    3,
    'migration_markers_before',
    jsonb_build_object(
      'hidden_at_column_exists', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'chat_sessions' AND column_name = 'hidden_at'
      ),
      'notification_archived_at_exists', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'archived_at'
      ),
      'audit_table_exists', to_regclass('public.chat_session_events') IS NOT NULL,
      'hide_function_exists', to_regprocedure('public.hide_chat_session_retained(uuid,uuid,text,text)') IS NOT NULL,
      'delete_guard_function_exists', to_regprocedure('public.prevent_chat_history_delete()') IS NOT NULL
    )

  UNION ALL

  SELECT
    4,
    'row_counts_before',
    jsonb_build_object(
      'users', (SELECT count(*) FROM public.users),
      'reports', (SELECT count(*) FROM public.reports),
      'chat_sessions', (SELECT count(*) FROM public.chat_sessions),
      'chat_messages', (SELECT count(*) FROM public.chat_messages),
      'notifications', (SELECT count(*) FROM public.notifications),
      'open_sessions', (SELECT count(*) FROM public.chat_sessions WHERE status = 'OPEN'),
      'closed_sessions', (SELECT count(*) FROM public.chat_sessions WHERE status = 'CLOSED')
    )

  UNION ALL

  SELECT
    5,
    'status_and_role_values',
    jsonb_build_object(
      'session_statuses', COALESCE((
        SELECT jsonb_object_agg(status, amount)
        FROM (SELECT status, count(*) AS amount FROM public.chat_sessions GROUP BY status) s
      ), '{}'::jsonb),
      'user_roles', COALESCE((
        SELECT jsonb_object_agg(role, amount)
        FROM (SELECT role, count(*) AS amount FROM public.users GROUP BY role) r
      ), '{}'::jsonb)
    )

  UNION ALL

  SELECT
    6,
    'integrity_blockers',
    to_jsonb(integrity)
  FROM integrity

  UNION ALL

  SELECT
    7,
    'current_chat_foreign_keys',
    COALESCE((SELECT jsonb_agg(to_jsonb(current_fks) ORDER BY source_table, conname) FROM current_fks), '[]'::jsonb)

  UNION ALL

  SELECT
    8,
    'snapshot_backfill_workload',
    jsonb_build_object(
      'session_user_names_to_fill', (
        SELECT count(*) FROM public.chat_sessions cs
        JOIN public.users u ON u.id = cs.user_id
      ),
      'session_admin_names_to_fill', (
        SELECT count(*) FROM public.chat_sessions cs
        JOIN public.users u ON u.id = cs.assigned_admin_id
      ),
      'message_sender_names_to_fill', (
        SELECT count(*) FROM public.chat_messages cm
        JOIN public.users u ON u.id = cm.sender_id
      )
    )

  UNION ALL

  SELECT
    9,
    'notification_session_backfill_projection',
    jsonb_build_object(
      'total_notifications', (SELECT count(*) FROM notification_links),
      'links_with_session_uuid', (
        SELECT count(*) FROM notification_links
        WHERE target_link ~ '(session=|/chat/)[0-9a-fA-F-]{36}'
      )
    )

  UNION ALL

  SELECT
    10,
    'long_running_transactions',
    jsonb_build_object(
      'older_than_5_minutes', (
        SELECT count(*)
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND xact_start IS NOT NULL
          AND xact_start < now() - interval '5 minutes'
      )
    )
) checks
ORDER BY sort_order;
