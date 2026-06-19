import { SetMetadata } from '@nestjs/common';

export const LOG_ACTION_KEY = 'logAction';
export const LOG_ENTITY_TYPE_KEY = 'logEntityType';

export interface LogOptions {
  action: string;
  entityType: string;
  getEntityId?: (request: any) => string | null;
  getOldData?: (request: any) => any;
  getNewData?: (request: any) => any;
}

export const Log = (options: LogOptions) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(LOG_ACTION_KEY, options.action)(target, propertyKey, descriptor);
    SetMetadata(LOG_ENTITY_TYPE_KEY, options.entityType)(target, propertyKey, descriptor);
    
    // Store additional options
    Reflect.defineMetadata('logOptions', options, target, propertyKey);
    
    return descriptor;
  };
};

// Usage example:
// @Log({
//   action: ACTIVITY_LOG_ACTIONS.CREATE_TICKET,
//   entityType: 'Ticket',
//   getEntityId: (req) => req.params?.id || req.body?.id,
//   getNewData: (req) => req.body,
// })
// async createTicket() { ... }