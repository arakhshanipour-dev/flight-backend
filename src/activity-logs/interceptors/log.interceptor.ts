import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { ActivityLogsService } from '../activity-logs.service';
import { LOG_ACTION_KEY, LOG_ENTITY_TYPE_KEY, LogOptions } from '../decorators/log.decorator';

@Injectable()
export class LogInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private activityLogsService: ActivityLogsService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get log metadata from decorator
    const action = this.reflector.get<string>(LOG_ACTION_KEY, context.getHandler());
    const entityType = this.reflector.get<string>(LOG_ENTITY_TYPE_KEY, context.getHandler());
    const logOptions = this.reflector.get<LogOptions>('logOptions', context.getHandler());

    // Skip if no log metadata
    if (!action || !entityType) {
      return next.handle();
    }

    const startTime = Date.now();
    const user = request.user;

    // Get entity ID from request
    let entityId: string | null = null;
    let oldData: any = null;
    let newData: any = null;

    if (logOptions) {
      try {
        entityId = logOptions.getEntityId?.(request) || null;
        oldData = logOptions.getOldData?.(request);
        newData = logOptions.getNewData?.(request);
      } catch (error) {
        // Ignore errors in extracting data
      }
    }

    // Extract oldData for update operations
    if (request.method === 'PATCH' || request.method === 'PUT') {
      try {
        // For PATCH/PUT, try to get the existing entity
        const entityIdParam = request.params?.id || request.params?.userId || request.params?.ticketId;
        // This is a simplified approach - in production you'd fetch the entity
        oldData = { previousState: 'fetched from database' };
      } catch (error) {
        // Ignore
      }
    }

    return next.handle().pipe(
      tap({
        next: async (data) => {
          // Only log successful operations (2xx status codes)
          if (response.statusCode >= 200 && response.statusCode < 300) {
            try {
              // Extract IP and User Agent
              const ipAddress = 
                request.headers['x-forwarded-for'] as string || 
                request.socket?.remoteAddress || 
                'unknown';
              const userAgent = request.headers['user-agent'] || 'unknown';

              // Prepare log data
              const logData: any = {
                userId: user?.id,
                action,
                entityType,
                entityId: entityId || data?.id || null,
                ipAddress,
                userAgent,
              };

              // Add agencyId and organizationId if available
              if (user?.agencyId) {
                logData.agencyId = user.agencyId;
              }
              if (user?.organizationId) {
                logData.organizationId = user.organizationId;
              }

              // Add oldData and newData
              if (oldData) {
                logData.oldData = oldData;
              }
              if (newData || data) {
                logData.newData = newData || data;
              }

              // Remove sensitive data from logs
              if (logData.newData?.password) delete logData.newData.password;
              if (logData.newData?.passwordHash) delete logData.newData.passwordHash;
              if (logData.oldData?.passwordHash) delete logData.oldData.passwordHash;

              // Save the log (async - don't wait for it)
              this.activityLogsService.createLog(logData).catch((error) => {
                console.error('Failed to create activity log:', error);
              });
            } catch (error) {
              // Don't break the main flow if logging fails
              console.error('Error in log interceptor:', error);
            }
          }
        },
        error: async (error) => {
          // Log errors too
          // This could be expanded to log failed operations
        },
      }),
    );
  }
}