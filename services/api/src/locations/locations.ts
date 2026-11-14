import { BadRequestException } from '@nestjs/common';
import catalog from './data/municipalities.json';

export const states = catalog.states;
export const citiesByState = catalog.cities as Record<
  string,
  { id: string; name: string }[]
>;
const normalize = (value: string) =>
  value
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** The same versioned official IBGE snapshot is served to clients and checked here. */
export function validateMunicipality(
  state?: string | null,
  city?: string | null,
  code?: string | null,
) {
  const uf = state?.trim().toUpperCase() ?? '';
  const found = citiesByState[uf]?.find((item) => item.id === code);
  if (!found || !city || normalize(found.name) !== normalize(city)) {
    throw new BadRequestException(
      'Selecione um município válido para a UF e o código IBGE informados.',
    );
  }
  return { state: uf, city: found.name, municipalityCode: found.id };
}

/** Only validate changed legacy locations; unrelated edits must remain possible. */
export function changedMunicipality(
  data: { state?: string; city?: string; municipalityCode?: string },
  current: {
    state?: string | null;
    city?: string | null;
    municipalityCode?: string | null;
  },
): Partial<{ state: string; city: string; municipalityCode: string }> {
  const state = data.state ?? current.state;
  const city = data.city ?? current.city;
  if (
    (data.state === undefined || data.state === current.state) &&
    (data.city === undefined || data.city === current.city) &&
    (data.municipalityCode === undefined ||
      data.municipalityCode === current.municipalityCode)
  )
    return {};
  const code =
    data.municipalityCode ??
    citiesByState[state?.toUpperCase() ?? '']?.find(
      (item) => city && normalize(item.name) === normalize(city),
    )?.id;
  return validateMunicipality(state, city, code);
}
