import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { AuditOperation, AuditStatus } from '@prisma/client';
import { getAuditLogger } from '../utils/audit-logger.js';

function extractUserId(req: any): string | undefined {
  return req.user?.id || req.session?.userId;
}

function httpMethodToAuditOperation(method: string): AuditOperation {
  switch (method.toUpperCase()) {
    case 'POST':
      return AuditOperation.CREATE;
    case 'GET':
    case 'HEAD':
      return AuditOperation.READ;
    case 'PUT':
    case 'PATCH':
      return AuditOperation.UPDATE;
    case 'DELETE':
      return AuditOperation.DELETE;
    default:
      return AuditOperation.EXECUTE;
  }
}

function extractResourceInfo(path: string): { resourceType: string; resourceId: string | null } {
  const parts = path.split('/').filter((part) => part);
  let resourceType = 'Unknown';
  let resourceId: string | null = null;

  if (parts.length > 1) {
    resourceType = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).replace(/-/g, '');
  }

  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part.match(/^[0-9a-f]{8}-[0-9a-f]{4}/i) || part.match(/^\d+$/)) {
      resourceId = part;
      break;
    }
  }

  return { resourceType, resourceId };
}

function shouldLogRequest(path: string, method: string): boolean {
  const ignorePaths = ['/health', '/metrics', '/status', '/ping'];

  if (ignorePaths.some((ignorePath) => path.startsWith(ignorePath))) {
    return false;
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return true;
  }

  if (method === 'GET' && path.includes('?')) {
    return true;
  }

  return false;
}

function extractIpAddress(req: Request): string | undefined {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.socket?.remoteAddress as string)
  );
}

/**
 * Middleware to capture request/response for audit logging
 */
export function auditLoggingMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const auditLogger = getAuditLogger();
    const requestId = randomUUID();
    const startTime = Date.now();
    const { resourceType, resourceId } = extractResourceInfo(req.path);
    const operation = httpMethodToAuditOperation(req.method);
    const userId = extractUserId(req);

    const originalSend = res.send;
    const originalJson = res.json;

    let responseBody: any = null;
    let responseStatus: AuditStatus = AuditStatus.SUCCESS;
    let errorMessage: string | undefined;

    res.send = function (data) {
      responseBody = data;
      responseStatus = res.statusCode >= 400 ? AuditStatus.FAILURE : AuditStatus.SUCCESS;
      if (res.statusCode >= 400) {
        errorMessage = `HTTP ${res.statusCode}`;
      }
      return originalSend.call(this, data);
    };

    res.json = function (data) {
      responseBody = data;
      responseStatus = res.statusCode >= 400 ? AuditStatus.FAILURE : AuditStatus.SUCCESS;
      if (res.statusCode >= 400) {
        errorMessage = data?.error || `HTTP ${res.statusCode}`;
      }
      return originalJson.call(this, data);
    };

    res.on('finish', async () => {
      try {
        const duration = Date.now() - startTime;
        const shouldLog = shouldLogRequest(req.path, req.method);

        if (shouldLog && resourceId) {
          await auditLogger.log({
            operation,
            resourceType,
            resourceId,
            actorId: userId,
            status: responseStatus,
            errorMessage,
            ipAddress: extractIpAddress(req),
            userAgent: req.get('user-agent'),
            endpoint: req.path,
            method: req.method,
            metadata: {
              duration,
              statusCode: res.statusCode,
              requestSize: JSON.stringify(req.body).length,
              responseSize: JSON.stringify(responseBody).length,
            },
            requestId,
          });
        }
      } catch (error) {
        console.error('Audit logging error:', error);
      }
    });

    next();
  };
}

/**
 * Higher-order middleware for operation-specific audit logging
 * Use when you want more control over what gets logged
 */
export function auditOperation(resourceType: string, operation: AuditOperation) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auditLogger = getAuditLogger();
    const startTime = Date.now();
    const userId = extractUserId(req);
    const resourceId = req.params.id || req.body?.id;

    const originalSend = res.send;
    const originalJson = res.json;

    let responseStatus: AuditStatus = AuditStatus.SUCCESS;
    let errorMessage: string | undefined;

    res.send = function (data) {
      responseStatus = res.statusCode >= 400 ? AuditStatus.FAILURE : AuditStatus.SUCCESS;
      if (res.statusCode >= 400) errorMessage = `HTTP ${res.statusCode}`;
      return originalSend.call(this, data);
    };

    res.json = function (data) {
      responseStatus = res.statusCode >= 400 ? AuditStatus.FAILURE : AuditStatus.SUCCESS;
      if (res.statusCode >= 400) errorMessage = data?.error || `HTTP ${res.statusCode}`;
      return originalJson.call(this, data);
    };

    res.on('finish', async () => {
      try {
        if (resourceId) {
          await auditLogger.log({
            operation,
            resourceType,
            resourceId,
            actorId: userId,
            status: responseStatus,
            errorMessage,
            ipAddress: extractIpAddress(req),
            userAgent: req.get('user-agent'),
            endpoint: req.path,
            method: req.method,
            beforeValues: (req as any).auditBefore,
            afterValues: (req as any).auditAfter,
            changedFields: (req as any).auditChangedFields,
            metadata: {
              duration: Date.now() - startTime,
              statusCode: res.statusCode,
            },
            requestId: (req as any).requestId || randomUUID(),
          });
        }
      } catch (error) {
        console.error('Audit operation logging error:', error);
      }
    });

    next();
  };
}