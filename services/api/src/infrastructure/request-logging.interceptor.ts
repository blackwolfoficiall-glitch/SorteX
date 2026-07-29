import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<any>(),
      res = ctx.switchToHttp().getResponse<any>(),
      start = Date.now(),
      base = {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        userId: req.user?.id,
      };
    return next.handle().pipe(
      tap(() =>
        this.write({
          ...base,
          level: 'info',
          status: res.statusCode,
          durationMs: Date.now() - start,
        }),
      ),
      catchError((error) => {
        const status =
          error?.status ??
          (error?.code === 'P2021' || error?.code === 'P2022'
            ? 503
            : error?.code === 'P2002'
              ? 409
              : 500);
        this.write({
          ...base,
          level: 'error',
          status,
          durationMs: Date.now() - start,
          errorCode: error?.code || error?.name,
        });
        return throwError(() => error);
      }),
    );
  }
  private write(entry: Record<string, unknown>) {
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  }
}
