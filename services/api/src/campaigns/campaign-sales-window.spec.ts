import {
  authoredDrawSchedule,
  CAMPAIGN_DRAW_TIME_ZONE,
  campaignDrawInstant,
  campaignSalesWindow,
  civilDrawInstant,
} from './campaign-sales-window';

const newSchedule = {
  drawDate: new Date('2026-11-28'),
  drawTime: '20:00',
  drawTimeZone: CAMPAIGN_DRAW_TIME_ZONE,
  salesStartAt: null,
  salesEndAt: null,
};

describe('janela de venda da campanha', () => {
  it('trata data e hora civil de Brasília, incluindo virada UTC', () => {
    expect(civilDrawInstant('2026-11-28', '20:00')?.toISOString()).toBe(
      '2026-11-28T23:00:00.000Z',
    );
    expect(civilDrawInstant('2026-11-28', '23:59')?.toISOString()).toBe(
      '2026-11-29T02:59:00.000Z',
    );
    expect(civilDrawInstant('2026-02-29', '20:00')).toBeNull();
    expect(civilDrawInstant('2026-11-28', '24:00')).toBeNull();
  });

  it('respeita fim explícito anterior; um fim posterior não prolonga vendas', () => {
    const earlier = new Date('2026-11-28T21:00:00Z');
    const later = new Date('2026-11-28T23:30:00Z');
    expect(
      campaignSalesWindow({ ...newSchedule, salesEndAt: earlier }, earlier),
    ).toMatchObject({ status: 'SALES_ENDED', closesAt: earlier });
    expect(
      campaignSalesWindow(
        { ...newSchedule, salesEndAt: later },
        new Date('2026-11-28T23:00:00Z'),
      ),
    ).toMatchObject({
      status: 'DRAW_TIME_REACHED',
      closesAt: new Date('2026-11-28T23:00:00Z'),
    });
  });

  it('preserva datas legadas absolutas, inclusive meia-noite UTC e hora auxiliar', () => {
    for (const legacy of [
      '2026-11-28T00:00:00.000Z',
      '2026-11-28T23:17:00.000Z',
    ]) {
      const drawDate = new Date(legacy);
      const record = {
        ...newSchedule,
        drawDate,
        drawTimeZone: null,
        status: 'PUBLISHED',
      };
      expect(campaignDrawInstant(record)?.toISOString()).toBe(legacy);
      expect(campaignSalesWindow(record, drawDate).status).toBe(
        'DRAW_TIME_REACHED',
      );
      expect(authoredDrawSchedule('2026-11-28', '20:00', record)).toEqual({
        drawDate: undefined,
        drawTimeZone: undefined,
      });
    }
  });

  it('introduz a zona nas novas datas civis sem alterar entradas ISO completas', () => {
    expect(
      authoredDrawSchedule('2026-11-28', undefined, {
        drawDate: null,
        status: 'DRAFT',
      }),
    ).toEqual({
      drawDate: new Date('2026-11-28'),
      drawTimeZone: CAMPAIGN_DRAW_TIME_ZONE,
    });
    expect(authoredDrawSchedule('2026-11-28T10:00:00-04:00', '20:00')).toEqual({
      drawDate: new Date('2026-11-28T14:00:00Z'),
      drawTimeZone: null,
    });
    expect(() => authoredDrawSchedule('2026-02-30', '20:00')).toThrow();
    expect(() =>
      authoredDrawSchedule(undefined, '24:00', newSchedule),
    ).toThrow();
    expect(campaignSalesWindow({ ...newSchedule, drawTime: null }).status).toBe(
      'UNSCHEDULED',
    );
  });
});
