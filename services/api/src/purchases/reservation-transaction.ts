import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';

export async function serializableReservationTransition<T>(
  prisma: Pick<PrismaClient, '$transaction'>,
  transition: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  for (let retry = 0; retry < 3; retry += 1) {
    try {
      return await prisma.$transaction(transition, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2034'
      )
        throw error;
    }
  }
  throw new ServiceUnavailableException(
    'A reserva mudou durante a operação. Tente novamente.',
  );
}
