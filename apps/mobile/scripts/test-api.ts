/** Explicit opt-in. Creates synthetic fixtures only in the allowlisted isolated API. */
import assert from "node:assert/strict";
import { randomBytes, randomInt } from "node:crypto";
import fs from "node:fs";
import { SortexClient, type Vault } from "../src/api/client";
import { QA_API, validateApiUrl } from "../src/api/config";
import { initial, registrationPayload } from "../src/domain/registration";
import {
  isValidCpf,
  isValidCnpj,
} from "../../../packages/contracts/src/documents";
import type {
  Registration,
  Tokens,
  User,
} from "../../../packages/contracts/src/mobile";
if (process.env.SORTEX_TEST_WRITES !== "isolated-synthetic-only")
  throw Error(
    "Use SORTEX_TEST_WRITES=isolated-synthetic-only to authorize synthetic fixtures.",
  );
const base = validateApiUrl(process.env.EXPO_PUBLIC_API_URL || QA_API);
const file = process.env.SORTEX_TEST_CREDENTIAL_FILE;
if (!file || !file.startsWith("/tmp/"))
  throw Error(
    "Provide a private /tmp/ credential file; credentials are never printed.",
  );
const digits = (n: number) =>
  Array.from({ length: n }, () => randomInt(0, 10)).join("");
function doc(kind: "cpf" | "cnpj") {
  for (;;) {
    const root = digits(kind === "cpf" ? 9 : 12);
    for (let x = 0; x < 100; x++) {
      const d = root + String(x).padStart(2, "0");
      if ((kind === "cpf" ? isValidCpf : isValidCnpj)(d)) return d;
    }
  }
}
async function main() {
  const fixtures: any[] = [];
  for (const [role, personType] of [
    ["BUYER", undefined],
    ["ORGANIZER", "PF"],
    ["ORGANIZER", "PJ"],
  ] as const) {
    let stored: Tokens | null = null;
    const vault: Vault = {
      read: async () => stored,
      write: async (t) => {
        stored = t;
      },
      clear: async () => {
        stored = null;
      },
    };
    const api = new SortexClient(base, vault);
    const password = "Mobile!" + randomBytes(18).toString("hex");
    const email = `mobile-${role.toLowerCase()}-${randomBytes(6).toString("hex")}@sortex.example.invalid`;
    const form: Registration = {
      ...initial,
      role,
      personType,
      name: "Pessoa Sintética Mobile",
      cpf: doc("cpf"),
      phone: "11999990000",
      email,
      password,
      passwordConfirmation: password,
      state: "BA",
      city: "Feira de Santana",
      municipalityCode: "2910800",
      postalCode: "44001000",
      neighborhood: "Centro de Teste",
      address: "Rua Sintética",
      addressNumber: "100",
      termsAccepted: true,
      privacyAccepted: true,
      dataProcessingAccepted: true,
      ...(personType === "PJ"
        ? {
            cnpj: doc("cnpj"),
            organizationName: "Empresa Sintética Mobile Ltda",
          }
        : {}),
    };
    const user = await api.publicRequest<User>(
      "/auth/register",
      "POST",
      registrationPayload(form),
    );
    assert.equal(user.role, role);
    await api.login(email, password);
    assert.equal(api.snapshot().status, "signedIn");
    assert.equal(api.snapshot().user?.id, user.id);
    const paths =
      role === "BUYER"
        ? [
            "/buyer/home",
            "/buyer/profile",
            "/buyer/campaigns?page=1&limit=10",
            "/purchases/my",
          ]
        : [
            "/dashboard",
            "/campaigns/my",
            "/organizers/me/profile",
            "/organizer/orders?page=1&limit=20",
            "/organizer/personalization",
          ];
    for (const path of paths) await api.request(path);
    await api.request(
      role === "BUYER" ? "/buyer/profile" : "/organizers/me/account",
      "PATCH",
      { name: "Pessoa Sintética Mobile Revisada", phone: "11999990001" },
    );
    if (role === "ORGANIZER")
      await api.request("/organizer/personalization/brand", "PATCH", {
        slogan: "Demonstração mobile",
      });
    const restored = new SortexClient(base, vault);
    await restored.restore();
    assert.equal(restored.snapshot().status, "signedIn");
    await restored.logout();
    assert.equal(stored, null);
    // The revoked refresh token must not establish a new session.
    await assert.rejects(() => api.request("/auth/me"));
    await api.login(email, password);
    await api.publicRequest("/auth/forgot-password", "POST", { email });
    const invalid = {
      ...registrationPayload(form),
      email: `invalid-${randomBytes(4).toString("hex")}@sortex.example.invalid`,
      municipalityCode: "3550308",
    };
    await assert.rejects(() =>
      api.publicRequest("/auth/register", "POST", invalid),
    );
    fixtures.push({ id: user.id, role, personType, email, password });
    await api.logout();
    console.log(
      `PASS ${role} ${personType || ""}: cadastro, contratos, perfil, rotação/restauração, logout e município inválido`,
    );
  }
  fs.writeFileSync(
    file,
    JSON.stringify({
      api: base,
      createdAt: new Date().toISOString(),
      fixtures,
    }),
    { mode: 0o600 },
  );
  console.log(
    "PASS: 3 contas sintéticas; nenhuma cobrança, mensagem ou apuração. Credenciais somente no arquivo privado.",
  );
}
main().catch((e) => {
  console.error("FAIL:", e instanceof Error ? e.message : "API indisponível");
  process.exitCode = 1;
});
