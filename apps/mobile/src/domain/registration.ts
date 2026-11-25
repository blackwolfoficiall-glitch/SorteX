import catalog from "../../assets/municipalities.json";
import {
  isValidCpf,
  isValidCnpj,
  normalizeDocument,
} from "../../../../packages/contracts/src/documents";
import type {
  Registration,
  Municipality,
} from "../../../../packages/contracts/src/mobile";
export const states = catalog.states;
export const cities = catalog.cities as Record<string, Municipality[]>;
export const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export const search = <T extends { name: string; code?: string }>(
  items: T[],
  query: string,
) =>
  items.filter((x) =>
    fold(x.name + " " + (x.code || "")).includes(fold(query)),
  );
export const initial: Registration = {
  role: "BUYER",
  personType: "PF",
  name: "",
  cpf: "",
  email: "",
  phone: "",
  password: "",
  passwordConfirmation: "",
  postalCode: "",
  state: "",
  city: "",
  municipalityCode: "",
  neighborhood: "",
  address: "",
  addressNumber: "",
  addressComplement: "",
  termsAccepted: false,
  privacyAccepted: false,
  dataProcessingAccepted: false,
};
export function validateRegistration(
  value: Registration,
  step?: number,
): string[] {
  const errors: string[] = [];
  if (step === undefined || step === 0) {
    if (value.name.trim().length < 2) errors.push("Informe o nome completo.");
    if (!isValidCpf(value.cpf)) errors.push("CPF inválido.");
    if (
      value.phone.replace(/\D/g, "").length < 10 ||
      value.phone.replace(/\D/g, "").length > 13
    )
      errors.push("Informe telefone com DDD.");
    if (value.role === "ORGANIZER" && value.personType === "PJ") {
      if (!isValidCnpj(value.cnpj || "")) errors.push("CNPJ inválido.");
      if (!value.organizationName?.trim())
        errors.push("Informe a razão social.");
    }
  }
  if (step === undefined || step === 1) {
    if (value.postalCode.replace(/\D/g, "").length !== 8)
      errors.push("CEP deve conter oito dígitos.");
    if (
      !cities[value.state]?.some(
        (c) =>
          c.id === value.municipalityCode && fold(c.name) === fold(value.city),
      )
    )
      errors.push("Selecione município e UF correspondentes.");
    if (
      !value.neighborhood.trim() ||
      value.address.trim().length < 3 ||
      !value.addressNumber.trim()
    )
      errors.push("Preencha bairro, logradouro e número.");
  }
  if (step === undefined || step === 2) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))
      errors.push("Informe um e-mail válido.");
    if (value.password.length < 8)
      errors.push("Use uma senha com ao menos oito caracteres.");
    if (value.password !== value.passwordConfirmation)
      errors.push("As senhas não coincidem.");
    if (
      !value.termsAccepted ||
      !value.privacyAccepted ||
      !value.dataProcessingAccepted
    )
      errors.push(
        "Leia e aceite os termos, a política e o tratamento necessário dos dados.",
      );
  }
  return errors;
}
export function registrationPayload(value: Registration): Registration {
  const data = {
    ...value,
    name: value.name.trim(),
    email: value.email.trim().toLowerCase(),
    cpf: normalizeDocument(value.cpf),
    phone: value.phone.replace(/\D/g, ""),
    postalCode: value.postalCode.replace(/\D/g, ""),
  };
  if (data.role === "BUYER") {
    delete data.personType;
    delete data.cnpj;
    delete data.organizationName;
    delete data.fantasyName;
  } else if (data.personType === "PF") {
    delete data.cnpj;
    delete data.organizationName;
    delete data.fantasyName;
  } else data.cnpj = normalizeDocument(data.cnpj || "");
  return data;
}
