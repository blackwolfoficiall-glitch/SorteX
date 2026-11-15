// Receita Federal / Serpro: manual-dv-cnpj.pdf (numeric and alphanumeric CNPJ).
// Remove formatting only, never discard letters or silently repair invalid characters.
export const normalizeDocument = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[.\-/\s]/g, '');

export function isValidCpf(value: string): boolean {
  const cpf = normalizeDocument(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const size of [9, 10]) {
    const sum = [...cpf.slice(0, size)].reduce(
      (total, digit, index) => total + Number(digit) * (size + 1 - index),
      0,
    );
    const remainder = sum % 11;
    if (Number(cpf[size]) !== (remainder < 2 ? 0 : 11 - remainder))
      return false;
  }
  return true;
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeDocument(value);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj))
    return false;
  for (const size of [12, 13]) {
    const sum = [...cnpj.slice(0, size)]
      .reverse()
      .reduce(
        (total, char, index) =>
          total + (char.charCodeAt(0) - 48) * (2 + (index % 8)),
        0,
      );
    const remainder = sum % 11;
    if (Number(cnpj[size]) !== (remainder < 2 ? 0 : 11 - remainder))
      return false;
  }
  return true;
}
