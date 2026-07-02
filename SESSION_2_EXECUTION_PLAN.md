# Session 2 Execution Plan — Audit Log Implementation
**Target Completion:** 2026-07-09 (1 week post-launch)  
**Current Scorecard:** 91% (11/12 points)  
**Goal:** Push to 93-100% by implementing session revocation audit log  

---

## Missing Point: Session Revocation Audit Log

**What's Missing:** Persistent audit trail for session lifecycle events  
**Current State:** Admin operations loggable via Discord reports (partial)  
**Required for Full Point:** Structured audit log sampling with queryable interface

---

## Session 2 Scope (3-4 hours estimated)

### Phase A: Database Schema (30 min)
Create audit log table to capture session events:

```sql
-- Table: audit_log
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  event_type  VARCHAR(50) NOT NULL,      -- 'session_created', 'session_revoked', etc
  user_id     BIGINT NOT NULL,            -- Who performed the action
  target_session_id BIGINT,               -- Session being acted upon
  reason      VARCHAR(255),               -- Why (e.g., "User logout", "Admin revoke")
  metadata    JSONB,                      -- Additional context
  timestamp   TIMESTAMP DEFAULT NOW(),
  created_at  TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES user(id),
  INDEX idx_user_id (user_id),
  INDEX idx_timestamp (timestamp),
  INDEX idx_event_type (event_type)
);
```

**Prisma Schema Addition:**
```prisma
model AuditLog {
  id               BigInt    @id @default(autoincrement())
  eventType        String    @db.VarChar(50)
  userId           BigInt
  targetSessionId  BigInt?
  reason           String?   @db.VarChar(255)
  metadata         Json?
  timestamp        DateTime  @default(now()) @db.Timestamp(0)
  createdAt        DateTime  @default(now()) @db.Timestamp(0)
  
  @@index([userId])
  @@index([timestamp])
  @@index([eventType])
}
```

### Phase B: API Endpoint Wiring (90 min)
Wire audit logging into all session lifecycle endpoints:

**Endpoints to Instrument:**
1. `POST /api/auth/login` → Log "session_created"
2. `POST /api/auth/logout` → Log "session_revoked" (reason: "User logout")
3. `POST /api/admin/sessions/:id/revoke` → Log "session_revoked" (reason: "Admin action")
4. `GET /api/admin/audit?event_type=session_revoked` → Query audit log
5. `GET /api/admin/user/:id/sessions/history` → Show user's session history with audit trail

**Implementation Pattern:**
```typescript
// In logout endpoint
async function logout(req, res) {
  const sessionId = req.session.id;
  const userId = req.user.id;
  
  // Revoke session
  await prisma.session.delete({ where: { id: sessionId } });
  
  // Log audit event
  await prisma.auditLog.create({
    data: {
      eventType: 'session_revoked',
      userId,
      targetSessionId: sessionId,
      reason: 'User logout',
      metadata: { ip: req.ip, userAgent: req.headers['user-agent'] }
    }
  });
  
  res.json({ success: true });
}
```

### Phase C: Testing & Validation (60 min)
**Test Scenarios:**
1. Create 10 user sessions
2. Revoke 5 sessions (mix of user logout + admin revoke)
3. Query audit log: `GET /api/admin/audit?event_type=session_revoked`
4. Verify all 5 revocations appear in audit trail
5. Validate metadata (IP, user agent) is captured
6. Confirm timestamps are accurate
7. Test pagination: `?limit=10&offset=20`
8. Test filtering: `?userId=12345&event_type=session_created`

**E2E Test to Add:**
```typescript
describe('Audit Log - Session Revocation', () => {
  it('should log session revocation events', async () => {
    // Create session
    const session = await createSession(user);
    
    // Revoke it
    await revokeSession(session.id);
    
    // Query audit log
    const audits = await getAuditLog({ eventType: 'session_revoked' });
    
    // Verify
    expect(audits).toContainEqual({
      eventType: 'session_revoked',
      userId: user.id,
      targetSessionId: session.id,
      reason: 'User logout'
    });
  });
});
```

---

## Database Migration Steps

```bash
# 1. Create migration
npx prisma migrate dev --name add_audit_log

# 2. Deploy to production
npx prisma migrate deploy

# 3. Verify schema
psql $DATABASE_URL -c "\dt audit_log;"
```

---

## Testing Checklist

- [ ] Audit table created in dev database
- [ ] Prisma schema compiles without errors
- [ ] `POST /auth/login` logs "session_created"
- [ ] `POST /auth/logout` logs "session_revoked"
- [ ] `POST /admin/sessions/:id/revoke` logs "session_revoked" with admin reason
- [ ] `GET /admin/audit` returns all audit events
- [ ] Query filtering works: `?event_type=session_revoked`
- [ ] Pagination works: `?limit=10&offset=10`
- [ ] Metadata captures IP + user agent
- [ ] Timestamps are accurate (within 1 second)
- [ ] E2E test passes: create 5 sessions, revoke 3, verify audit trail
- [ ] No errors in PM2 logs
- [ ] Database performance: audit queries complete <100ms

---

## Deliverables (Session 2)

| Item | Status | Owner |
|------|--------|-------|
| Prisma schema migration | TODO | Dev |
| API endpoint wiring | TODO | Dev |
| Audit query interface | TODO | Dev |
| E2E test coverage | TODO | QA |
| Production deployment | TODO | Ops |
| KPI dashboard update | TODO | Ops |

---

## Success Criteria

✓ Session revocation events captured in `audit_log` table  
✓ All 5 E2E audit tests passing  
✓ Query performance <100ms for 10K events  
✓ Zero errors in PM2 logs during testing  
✓ Scorecard: 12/12 (100% complete)  

---

## Post-Session 2 State

**Scorecard:** 93% → 100% (12/12 points)  
**Locked Improvements:**
- Session audit trail (queryable, filterable)
- Admin revocation tracking
- User session history with timeline

**Future Enhancements (Not Blocking):**
- Real-time audit event streaming (WebSocket)
- Audit log export (CSV/JSON)
- Compliance reports (SOC2, GDPR)
- Retention policies (auto-archive after 90 days)

---

## Implementation Timeline

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Planning (this doc) | 30 min | Day 1 | Day 1 10:00 |
| Schema design | 30 min | Day 1 | Day 1 10:30 |
| Endpoint wiring | 90 min | Day 1 | Day 1 12:00 |
| Testing | 60 min | Day 1 | Day 1 13:00 |
| Integration testing | 30 min | Day 2 | Day 2 09:00 |
| Production deployment | 30 min | Day 2 | Day 2 10:00 |
| **Total** | **270 min (4.5 hrs)** | 2026-07-09 | 2026-07-09 |

**Buffer:** 1 hour (for unforeseen issues)  
**Target Completion:** 2026-07-09 EOD

---

## GitHub Issues/PRs to Create

1. **PR: Implement audit log schema and wiring**
   - Title: `feat: Add session revocation audit log`
   - Branch: `feature/audit-log`
   - Reviewers: Code review required before merge

2. **Issue: Audit Log E2E Tests**
   - Title: `test: Add E2E tests for audit log querying`
   - Labels: `testing`, `session-management`
   - Acceptance Criteria: 5/5 tests passing

---

## Rollback Plan (If Issues Arise)

If audit log causes performance degradation:
1. Stop API server: `pm2 stop nexusforge-backend-workspace`
2. Rollback migration: `npx prisma migrate resolve --rolled-back "add_audit_log"`
3. Restart: `pm2 restart nexusforge-backend-workspace`
4. Validate: `pm2 logs nexusforge-backend-workspace`

Estimated rollback time: 5-10 minutes

---

## Notes

- Audit log is **append-only** — no deletes, only archiving after retention period
- For compliance: Log all admin actions, sample 5% of user-initiated sessions
- Performance: Index on `(user_id, timestamp)` for fast queries
- Security: Audit logs are read-only post-insert (no modifications)
