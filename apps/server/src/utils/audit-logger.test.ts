import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient, AuditOperation, AuditStatus } from '@prisma/client';
import { AuditLogger } from '../utils/audit-logger';

describe('AuditLogger', () => {
  let prisma: PrismaClient;
  let auditLogger: AuditLogger;

  beforeEach(() => {
    prisma = new PrismaClient();
    auditLogger = new AuditLogger(prisma);
  });

  afterEach(async () => {
    // Cleanup test data
    await prisma.auditLog.deleteMany();
    await prisma.$disconnect();
  });

  describe('log()', () => {
    it('should create an audit log entry', async () => {
      await auditLogger.log({
        operation: AuditOperation.CREATE,
        resourceType: 'User',
        resourceId: 'user-123',
        actorId: 'admin-1',
        metadata: { test: true },
      });

      const logs = await prisma.auditLog.findMany();
      expect(logs).toHaveLength(1);
      expect(logs[0].operation).toBe(AuditOperation.CREATE);
      expect(logs[0].resourceType).toBe('User');
    });

    it('should capture before/after values', async () => {
      const before = { name: 'Old Name', email: 'old@example.com' };
      const after = { name: 'New Name', email: 'old@example.com' };

      await auditLogger.log({
        operation: AuditOperation.UPDATE,
        resourceType: 'User',
        resourceId: 'user-123',
        beforeValues: before,
        afterValues: after,
      });

      const log = await prisma.auditLog.findFirst();
      expect(log?.changedFields).toContain('name');
      expect(log?.changedFields).not.toContain('email');
    });

    it('should handle missing actor (system operations)', async () => {
      await auditLogger.log({
        operation: AuditOperation.DELETE,
        resourceType: 'Session',
        resourceId: 'session-123',
      });

      const log = await prisma.auditLog.findFirst();
      expect(log?.actorId).toBeNull();
    });

    it('should handle logging errors gracefully', async () => {
      // Should not throw
      await expect(
        auditLogger.log({
          operation: AuditOperation.CREATE,
          resourceType: 'User',
          resourceId: 'user-123',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('query()', () => {
    beforeEach(async () => {
      // Create test data
      await prisma.auditLog.createMany({
        data: [
          {
            operation: AuditOperation.CREATE,
            resourceType: 'User',
            resourceId: 'user-1',
            actorId: 'admin-1',
            status: AuditStatus.SUCCESS,
          },
          {
            operation: AuditOperation.UPDATE,
            resourceType: 'User',
            resourceId: 'user-1',
            actorId: 'admin-1',
            status: AuditStatus.SUCCESS,
          },
          {
            operation: AuditOperation.DELETE,
            resourceType: 'User',
            resourceId: 'user-2',
            actorId: 'admin-2',
            status: AuditStatus.FAILURE,
            errorMessage: 'Permission denied',
          },
          {
            operation: AuditOperation.READ,
            resourceType: 'Guild',
            resourceId: 'guild-1',
            actorId: 'user-1',
            status: AuditStatus.SUCCESS,
          },
        ],
      });
    });

    it('should filter by resource type', async () => {
      const result = await auditLogger.query({ resourceType: 'User' });
      expect(result.logs).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter by operation', async () => {
      const result = await auditLogger.query({ operation: AuditOperation.CREATE });
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].operation).toBe(AuditOperation.CREATE);
    });

    it('should filter by actor', async () => {
      const result = await auditLogger.query({ actorId: 'admin-1' });
      expect(result.logs).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const result = await auditLogger.query({ status: AuditStatus.FAILURE });
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].status).toBe(AuditStatus.FAILURE);
    });

    it('should paginate results', async () => {
      const result1 = await auditLogger.query({ limit: 2, offset: 0 });
      expect(result1.logs).toHaveLength(2);

      const result2 = await auditLogger.query({ limit: 2, offset: 2 });
      expect(result2.logs).toHaveLength(2);

      expect(result1.logs[0].id).not.toBe(result2.logs[0].id);
    });

    it('should include actor information', async () => {
      const result = await auditLogger.query();
      const logWithActor = result.logs.find(log => log.actorId);
      expect(logWithActor?.actor).toBeDefined();
    });
  });

  describe('archiveOldLogs()', () => {
    beforeEach(async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 days ago

      await prisma.auditLog.createMany({
        data: [
          {
            operation: AuditOperation.CREATE,
            resourceType: 'User',
            resourceId: 'user-1',
            createdAt: oldDate,
          },
          {
            operation: AuditOperation.UPDATE,
            resourceType: 'User',
            resourceId: 'user-1',
            createdAt: now,
          },
        ],
      });
    });

    it('should archive logs older than retention period', async () => {
      const archivedCount = await auditLogger.archiveOldLogs(90);
      expect(archivedCount).toBe(1);

      const archived = await prisma.auditLog.findMany({
        where: { archivedAt: { not: null } },
      });
      expect(archived).toHaveLength(1);
    });
  });

  describe('getStats()', () => {
    beforeEach(async () => {
      await prisma.auditLog.createMany({
        data: [
          {
            operation: AuditOperation.CREATE,
            resourceType: 'User',
            resourceId: 'user-1',
            actorId: 'admin-1',
            status: AuditStatus.SUCCESS,
          },
          {
            operation: AuditOperation.UPDATE,
            resourceType: 'User',
            resourceId: 'user-1',
            actorId: 'admin-1',
            status: AuditStatus.SUCCESS,
          },
          {
            operation: AuditOperation.DELETE,
            resourceType: 'Guild',
            resourceId: 'guild-1',
            actorId: 'admin-2',
            status: AuditStatus.FAILURE,
          },
        ],
      });
    });

    it('should return operation statistics', async () => {
      const stats = await auditLogger.getStats();
      expect(stats.byOperation).toHaveLength(3);
      expect(stats.byOperation.some(s => s.operation === AuditOperation.CREATE)).toBe(true);
    });

    it('should return resource type statistics', async () => {
      const stats = await auditLogger.getStats();
      expect(stats.byResourceType).toHaveLength(2);
    });

    it('should return status statistics', async () => {
      const stats = await auditLogger.getStats();
      expect(stats.byStatus).toHaveLength(2);
      expect(stats.byStatus.some(s => s.status === AuditStatus.SUCCESS)).toBe(true);
    });

    it('should return top actors', async () => {
      const stats = await auditLogger.getStats();
      expect(stats.topActors).toBeDefined();
      expect(stats.topActors[0].actorId).toBe('admin-1');
    });

    it('should return total count', async () => {
      const stats = await auditLogger.getStats();
      expect(stats.total).toBe(3);
    });
  });
});
