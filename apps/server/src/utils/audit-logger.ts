import { PrismaClient, AuditOperation, AuditStatus } from '@prisma/client';

interface AuditLogInput {
  operation: AuditOperation;
  resourceType: string;
  resourceId: string;
  actorId?: string;
  status?: AuditStatus;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  beforeValues?: Record<string, any>;
  afterValues?: Record<string, any>;
  changedFields?: string[];
  metadata?: Record<string, any>;
  requestId?: string;
}

export class AuditLogger {
  constructor(private prisma: PrismaClient) {}

  /**
   * Log an audit event to the database
   */
  async log(input: AuditLogInput): Promise<void> {
    try {
      const changedFields = input.changedFields || [];
      
      // Auto-detect changed fields if before/after values provided
      if (input.beforeValues && input.afterValues && changedFields.length === 0) {
        const allKeys = new Set([
          ...Object.keys(input.beforeValues),
          ...Object.keys(input.afterValues),
        ]);
        
        for (const key of allKeys) {
          const before = input.beforeValues[key];
          const after = input.afterValues[key];
          if (JSON.stringify(before) !== JSON.stringify(after)) {
            changedFields.push(key);
          }
        }
      }

      await this.prisma.auditLog.create({
        data: {
          operation: input.operation,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          actorId: input.actorId,
          status: input.status || AuditStatus.SUCCESS,
          errorMessage: input.errorMessage,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          endpoint: input.endpoint,
          method: input.method,
          beforeValues: input.beforeValues,
          afterValues: input.afterValues,
          changedFields,
          metadata: input.metadata,
          requestId: input.requestId,
        },
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Don't throw - audit logging failures should not break the application
    }
  }

  /**
   * Query audit logs with filtering
   */
  async query(filters: {
    resourceType?: string;
    resourceId?: string;
    actorId?: string;
    operation?: AuditOperation;
    status?: AuditStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const {
      resourceType,
      resourceId,
      actorId,
      operation,
      status,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = filters;

    const where: any = {};
    if (resourceType) where.resourceType = resourceType;
    if (resourceId) where.resourceId = resourceId;
    if (actorId) where.actorId = actorId;
    if (operation) where.operation = operation;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          actor: {
            select: {
              id: true,
              username: true,
              email: true,
              appRole: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total, limit, offset };
  }

  /**
   * Archive old audit logs (retention policy)
   */
  async archiveOldLogs(daysRetention: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysRetention);

    const result = await this.prisma.auditLog.updateMany({
      where: {
        createdAt: { lt: cutoffDate },
        archivedAt: null,
      },
      data: {
        archivedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Delete archived logs (older than specified days)
   */
  async deleteArchivedLogs(archivedDaysAgo: number = 180): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - archivedDaysAgo);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        archivedAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  /**
   * Get audit statistics
   */
  async getStats(startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [byOperation, byResourceType, byStatus, byActor, total] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['operation'],
        where,
        _count: true,
      }),
      this.prisma.auditLog.groupBy({
        by: ['resourceType'],
        where,
        _count: true,
      }),
      this.prisma.auditLog.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.auditLog.groupBy({
        by: ['actorId'],
        where,
        _count: true,
        orderBy: { _count: { operation: 'desc' } },
        take: 10,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      byOperation,
      byResourceType,
      byStatus,
      topActors: byActor,
      total,
    };
  }
}

// Singleton instance
let auditLogger: AuditLogger | null = null;

export function initializeAuditLogger(prisma: PrismaClient): AuditLogger {
  if (!auditLogger) {
    auditLogger = new AuditLogger(prisma);
  }
  return auditLogger;
}

export function getAuditLogger(): AuditLogger {
  if (!auditLogger) {
    throw new Error('AuditLogger not initialized. Call initializeAuditLogger first.');
  }
  return auditLogger;
}
