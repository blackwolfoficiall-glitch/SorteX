import {
  isValidCpf,
  isValidCnpj,
  normalizeDocument,
} from './brazilian-documents';
describe('official Brazilian documents', () => {
  it.each(['529.982.247-25', '11144477735'])('accepts CPF %s', (value) =>
    expect(isValidCpf(value)).toBe(true),
  );
  it.each(['00000000000', '11111111111', '52998224724', 'A52998224725', ''])(
    'rejects invalid CPF %s',
    (value) => expect(isValidCpf(value)).toBe(false),
  );
  it.each([
    '11.222.333/0001-81',
    '11222333000181',
    '12.ABC.345/01DE-35',
    '12.abc.345/01de-35',
  ])('accepts numeric and official alphanumeric CNPJ %s', (value) =>
    expect(isValidCnpj(value)).toBe(true),
  );
  it.each([
    '00000000000000',
    '11111111111111',
    '12ABC34501DE34',
    '12ABC34501DE3A',
    '12@ABC34501DE35',
    '11222333000180',
  ])('rejects invalid CNPJ %s', (value) =>
    expect(isValidCnpj(value)).toBe(false),
  );
  it('preserves letters and does not strip invalid symbols', () => {
    expect(normalizeDocument('12.abc.345/01de-35')).toBe('12ABC34501DE35');
    expect(normalizeDocument('12@ABC34501DE35')).toContain('@');
  });
});
