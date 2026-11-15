import {
  changedMunicipality,
  citiesByState,
  states,
  validateMunicipality,
} from './locations';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
describe('official IBGE snapshot and validation', () => {
  it('contains 27 UFs and 5571 unique seven-digit codes including the new MT municipality', () => {
    const cities = Object.values(citiesByState).flat();
    expect(states).toHaveLength(27);
    expect(cities).toHaveLength(5571);
    expect(new Set(cities.map((c) => c.id)).size).toBe(cities.length);
    expect(cities.every((c) => /^\d{7}$/.test(c.id))).toBe(true);
    expect(
      citiesByState.MT.some((c) => c.name === 'Boa Esperança do Norte'),
    ).toBe(true);
    expect(
      readFileSync(resolve(__dirname, 'data/municipalities.json'), 'utf8'),
    ).toBe(
      readFileSync(
        resolve(
          process.cwd(),
          '../../apps/web/public/data/municipalities.json',
        ),
        'utf8',
      ),
    );
  });
  it('canonicalizes the matching triple and searches accented names', () => {
    expect(validateMunicipality('ba', 'feira de santana', '2910800')).toEqual({
      state: 'BA',
      city: 'Feira de Santana',
      municipalityCode: '2910800',
    });
    expect(
      citiesByState.BA.filter((c) => c.name.startsWith('Fe')).map(
        (c) => c.name,
      ),
    ).toEqual(expect.arrayContaining(['Feira de Santana', 'Feira da Mata']));
  });
  it.each([
    ['SP', 'Feira de Santana', '2910800'],
    ['BA', 'Salvador', '2910800'],
    ['BA', 'Salvador', ''],
    ['XX', 'Salvador', '2927408'],
  ])('rejects mismatched state/city/code', (uf, city, id) =>
    expect(() => validateMunicipality(uf, city, id)).toThrow(),
  );
  it('does not retrofit unchanged legacy text or let a changed code bypass validation', () => {
    expect(
      changedMunicipality({}, { state: 'BA', city: 'Legacy text' }),
    ).toEqual({});
    expect(
      changedMunicipality(
        { city: 'Legacy text' },
        { state: 'BA', city: 'Legacy text' },
      ),
    ).toEqual({});
    expect(() =>
      changedMunicipality(
        { municipalityCode: '9999999' },
        { state: 'BA', city: 'Salvador' },
      ),
    ).toThrow();
    expect(
      changedMunicipality(
        { city: 'Salvador' },
        { state: 'BA', city: 'Legacy text' },
      ),
    ).toEqual({ city: 'Salvador', state: 'BA', municipalityCode: '2927408' });
  });
});
