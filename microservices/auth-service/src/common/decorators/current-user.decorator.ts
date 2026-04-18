import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Permite inyectar request.user directo en handlers sin acoplarlos a Express.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    return request.user;
  },
);
