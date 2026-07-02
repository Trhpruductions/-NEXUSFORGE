import { Router, Request, Response } from 'express';
import { getAuditLogger } from '../utils/audit-logger';
import { AuditOperation, AuditStatus } from '@prisma/client';
import { requireRole } from '../middleware/auth'; // Adjust path based on your auth

const router = Router();
const auditLogger = getAuditLogger();

/**
 * GET /api/admin/audit-logs
 * Retrieve audit logs with filtering
 * Requires: ADMIN role
 */
router.get(
  '/audit-logs',
  requireRole(['ADMIN', 'EXEC', 'OWNER']),
  async (req: Request, res: Response) => {
    try {
      const {
        resourceType,
        resourceId,
        actorId,
        operation,
        status,
        startDate,
        endDate,
        limit = '50',
        offset = '0',
      } = req.query;

      const filters = {
        resourceType: resourceType as string | undefined,
        resourceId: resourceId as string | undefined,
        actorId: actorId as string | undefined,
        operation: operation as AuditOperation | undefined,
        status: status as AuditStatus | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: Math.min(parseInt(limit as string) || 50, 500), // Max 500
        offset: parseInt(offset as string) || 0,
      };

      const result = await auditLogger.query(filters);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * GET /api/admin/audit-logs/stats
 * Get audit statistics
 * Requires: ADMIN role
 */
router.get(
  '/audit-logs/stats',
  requireRole(['ADMIN', 'EXEC', 'OWNER']),
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;

      const stats = await auditLogger.getStats(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
      );

      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * GET /api/admin/audit-logs/export
 * Export audit logs (CSV)
 * Requires: ADMIN role
 */
router.get(
  '/audit-logs/export',
  requireRole(['ADMIN', 'EXEC', 'OWNER']),
  async (req: Request, res: Response) => {
    try {
      const {
        resourceType,
        resourceId,
        startDate,
        endDate,
      } = req.query;

      const filters = {
        resourceType: resourceType as string | undefined,
        resourceId: resourceId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: 10000,
        offset: 0,
      };

      const { logs } = await auditLogger.query(filters);

      // Convert to CSV
      const headers = [
        'ID',
        'Operation',
        'Resource Type',
        'Resource ID',
        'Actor',
        'Status',
        'IP Address',
        'Endpoint',
        'Method',
        'Created At',
        'Changed Fields',
      ];

      const rows = logs.map(log => [
        log.id,
        log.operation,
        log.resourceType,
        log.resourceId,
        log.actor?.username || 'System',
        log.status,
        log.ipAddress || 'N/A',
        log.endpoint || 'N/A',
        log.method || 'N/A',
        log.createdAt.toISOString(),
        log.changedFields?.join(',') || '',
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="audit-logs-${new Date().toISOString()}.csv"`,
      );
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * POST /api/admin/audit-logs/archive
 * Archive old logs (retention policy)
 * Requires: EXEC role
 */
router.post(
  '/audit-logs/archive',
  requireRole(['EXEC', 'OWNER']),
  async (req: Request, res: Response) => {
    try {
      const { daysRetention = 90 } = req.body;

      const archivedCount = await auditLogger.archiveOldLogs(daysRetention);

      res.json({
        success: true,
        message: `Archived ${archivedCount} audit logs older than ${daysRetention} days`,
        archivedCount,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * POST /api/admin/audit-logs/cleanup
 * Delete archived logs (permanent deletion)
 * Requires: OWNER role (dangerous operation)
 */
router.post(
  '/audit-logs/cleanup',
  requireRole(['OWNER']),
  async (req: Request, res: Response) => {
    try {
      const { archivedDaysAgo = 180 } = req.body;

      const deletedCount = await auditLogger.deleteArchivedLogs(archivedDaysAgo);

      res.json({
        success: true,
        message: `Deleted ${deletedCount} archived audit logs older than ${archivedDaysAgo} days`,
        deletedCount,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * GET /api/admin/audit-logs/:logId
 * Get a specific audit log entry
 * Requires: ADMIN role
 */
router.get(
  '/audit-logs/:logId',
  requireRole(['ADMIN', 'EXEC', 'OWNER']),
  async (req: Request, res: Response) => {
    try {
      const { logId } = req.params;

      const log = await (getAuditLogger() as any).prisma.auditLog.findUnique({
        where: { id: logId },
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
      });

      if (!log) {
        return res.status(404).json({ error: 'Audit log not found' });
      }

      res.json(log);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
