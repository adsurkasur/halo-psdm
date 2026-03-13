# Halo PSDM System Flows

## 1. Reporting and Complaint Flow

### Sender Flow

1. User logs in.
2. User opens report form.
3. User fills category, urgency, and chronology.
4. User submits report.

### System Behavior

1. Report is recorded with unique case identifier.
2. Report appears in admin report management list.
3. Status lifecycle is tracked and visible.

### Admin Flow

1. Admin reviews incoming report.
2. Admin updates status as handling progresses.
3. Admin can request clarification and continue until completion.

## 2. Chat and Clarification Flow

### Sender Flow

1. User starts a chat session from chat menu.
2. User sends messages and can review message history.

### System Behavior

1. Open sessions are listed in admin queue.
2. Sessions support asynchronous behavior when admin is unavailable.
3. Message read state and chat history are retained.

### Admin Flow

1. Admin opens queue and assigns session when needed.
2. Admin responds in-session and can close session after completion.

## 3. Appointment Request Flow

### Sender Flow

1. User opens appointment directory.
2. User selects an available admin profile.
3. User is redirected to WhatsApp contact URL.

### System Behavior

1. Appointment request intent is recorded.
2. Duplicate immediate repeat requests are guarded.

## 4. Monitoring and Recap Flow

### Admin and Super Admin Use

1. Review dashboard indicators and report summaries.
2. Open recap page for distribution and trend overview.
3. Export recap data when needed.

## Notes

These flows are aligned with project references:

- `references/concept_paper_v2.txt`
- `references/rancangan_sistem.txt`
