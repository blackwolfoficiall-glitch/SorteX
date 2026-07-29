import { BadRequestException } from '@nestjs/common';
import { CrmService } from './crm.service';
describe('CrmService security', () => {
  const service = new CrmService({} as any);
  it('rejeita chave arbitrária em regra de segmento', () => {
    expect(() =>
      (service as any).validateRules({ javascript: 'alert(1)' }),
    ).toThrow(BadRequestException);
  });
  it('sanitiza scripts e handlers', () => {
    const clean = (service as any).clean(
      '<script>alert(1)</script><b onclick=x>Olá</b>',
    );
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onclick=');
  });
  it('mascara telefone e email', () => {
    const safe = (service as any).safe({
      email: 'maria@example.com',
      phone: '71999999999',
      totalSpent: 10,
    });
    expect(safe.email).toBe('ma***@example.com');
    expect(safe.phone).toBe('***9999');
  });
});
