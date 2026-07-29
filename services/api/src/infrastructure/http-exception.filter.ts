import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp(),
      res = ctx.getResponse<Response>(),
      req = ctx.getRequest<Request>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR,
      code = 'INTERNAL_ERROR',
      message: unknown = 'Não foi possível concluir a solicitação.';
    if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse() as any;
      message = typeof body === 'string' ? body : (body.message ?? message);
      code = body.code ?? `HTTP_${status}`;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      code = `PRISMA_${error.code}`;
      status =
        error.code === 'P2002'
          ? 409
          : error.code === 'P2025'
            ? 404
            : error.code === 'P2021' || error.code === 'P2022'
              ? 503
              : 400;
      message =
        error.code === 'P2002'
          ? 'E-mail, CPF ou CNPJ já cadastrado.'
          : error.code === 'P2021' || error.code === 'P2022'
            ? 'O banco local precisa ser atualizado para concluir esta operação.'
            : 'Confira os dados informados.';
    }
    const requestId = (req as any).requestId;
    const payload: any = {
      statusCode: status,
      code,
      message,
      requestId,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    };
    if (
      process.env.NODE_ENV !== 'production' &&
      error instanceof Error &&
      !(error instanceof Prisma.PrismaClientKnownRequestError)
    )
      payload.debug = error.message;
    res.status(status).json(payload);
  }
}
