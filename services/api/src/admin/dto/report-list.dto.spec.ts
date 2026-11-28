import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import { ReportListDto } from './admin.dto';

describe('ReportListDto via the strict query validation pipe', () => {
  const validate = async (value: Record<string, unknown>) => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    return (await pipe.transform(value, {
      type: 'query',
      metatype: ReportListDto,
    })) as ReportListDto;
  };

  it.each(Object.values(ReportStatus))(
    'accepts %s with the original list parameters',
    async (status) => {
      await expect(
        validate({
          page: '2',
          limit: '20',
          search: 'sintético',
          sort: 'oldest',
          from: '2026-11-01',
          status,
        }),
      ).resolves.toMatchObject({
        page: 2,
        limit: 20,
        search: 'sintético',
        sort: 'oldest',
        from: '2026-11-01',
        status,
      });
    },
  );

  it('keeps default pagination without a status', async () => {
    await expect(validate({})).resolves.toMatchObject({ page: 1, limit: 25 });
  });

  it.each([
    { status: 'INVALID' },
    { status: ['OPEN', 'DISMISSED'] },
    { status: 'OPEN', other: 'unexpected' },
  ])('rejects invalid or unknown options: %j', async (query) => {
    await expect(validate(query)).rejects.toBeInstanceOf(BadRequestException);
  });
});
