import { AuditHashService } from './audit-hash.service';
describe('AuditHashService', () => {
  const service = new AuditHashService();
  it('produz hash reproduzível independentemente da ordem das chaves', () => {
    expect(service.create({ a: 1, b: { c: 2 } })).toBe(
      service.create({ b: { c: 2 }, a: 1 }),
    );
  });
  it('muda quando o snapshot muda', () => {
    expect(service.create({ result: '1' })).not.toBe(
      service.create({ result: '2' }),
    );
  });
  it('produz SHA-256 hexadecimal', () =>
    expect(service.create({ x: 1 })).toMatch(/^[a-f0-9]{64}$/));
});
