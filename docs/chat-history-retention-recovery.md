# Chat History Retention and Soft Delete

## Incident reference

- Missing session: `12007aec-e12b-4f51-aa19-171a613db261`
- Last confirmed message notification: `2026-07-30 22:27:56.587 Asia/Jakarta`
- First confirmed missing check: `2026-07-31 14:20:25 Asia/Jakarta`

The session and its messages are absent from the live database. Notification rows remain because the legacy notification schema stored the session only inside a URL string. The hardening below prevents the same failure mode from recurring; it does not restore this incident's missing session.

## Hardened lifecycle

1. `OPEN`: participants can exchange messages and upload media.
2. `CLOSED`: no new message or media is accepted, but the complete history remains readable.
3. `HIDDEN`: allowed only after `CLOSED`; the session disappears from regular frontend queries without deleting the session, messages, or media.
4. Related notifications are marked read and archived in the same database transaction.
5. Every create, assignment, close, hide, and restore has an append-only audit event with actor ID, actor name snapshot, and timestamp.
6. Database triggers reject direct deletion of chat sessions, messages, and audit events, including attempts from application service routes.
7. Audited database functions independently validate the actor and role; security does not depend only on frontend visibility or API checks.

`CLOSED` and `HIDDEN` are deliberately separate. Closing controls the conversation lifecycle; hiding controls frontend visibility.

## Export a retained chat

Use the session ID to export the session, messages, and audit trail:

```sql
select
  cs.*,
  cs.created_at at time zone 'Asia/Jakarta' as created_wib,
  cs.closed_at at time zone 'Asia/Jakarta' as closed_wib,
  cs.hidden_at at time zone 'Asia/Jakarta' as hidden_wib
from public.chat_sessions cs
where cs.id = '<SESSION_ID>'::uuid;

select
  cm.*,
  cm.created_at at time zone 'Asia/Jakarta' as created_wib,
  cm.read_at at time zone 'Asia/Jakarta' as read_wib
from public.chat_messages cm
where cm.session_id = '<SESSION_ID>'::uuid
order by cm.created_at, cm.id;

select
  e.*,
  e.created_at at time zone 'Asia/Jakarta' as created_wib
from public.chat_session_events e
where e.session_id = '<SESSION_ID>'::uuid
order by e.created_at, e.id;
```

## Production deployment order

1. Take a fresh database dump and separately inventory/download critical Storage objects.
2. Apply `supabase/migrations/08_chat_history_retention_and_audit.sql` during a short maintenance window.
3. Verify that direct deletes fail, existing `CLOSED` sessions remain readable, and hiding archives matching notifications.
4. Deploy the application changes immediately after the migration.
5. Run the chat lifecycle E2E test.

Do not deploy the application before the migration because the new API writes snapshot, audit, and notification `session_id` fields introduced by the migration.

## Audit query

```sql
select
  e.session_id,
  e.event_type,
  e.actor_user_id,
  e.actor_name_snapshot,
  e.old_status,
  e.new_status,
  e.metadata,
  e.created_at at time zone 'Asia/Jakarta' as created_wib
from public.chat_session_events e
order by e.created_at desc;
```
