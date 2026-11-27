import { test } from "node:test";
import assert from "node:assert/strict";
import { isLoginReady } from "../src/auth/login-input";
import { SortexClient, type Vault } from "../src/api/client";
import { QA_API, TEST_API, validateApiUrl } from "../src/api/config";
import { BuyerSandboxPix } from "../src/buyer/sandbox-pix";
import {
  initial,
  validateRegistration,
  registrationPayload,
  cities,
  search,
  states,
} from "../src/domain/registration";
import {
  isValidCpf,
  isValidCnpj,
} from "../../../packages/contracts/src/documents";
import type { Tokens } from "../../../packages/contracts/src/mobile";
const user = {
  id: "synthetic",
  name: "Teste",
  role: "BUYER",
  email: "test@sortex.example.invalid",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
function setup(
  handler: (path: string, options?: RequestInit) => Promise<Response>,
) {
  let value: Tokens | null = null;
  const vault: Vault = {
    read: async () => value,
    write: async (t) => {
      value = t;
    },
    clear: async () => {
      value = null;
    },
  };
  const transport = ((url: string, options?: RequestInit) =>
    handler(url.replace(TEST_API, ""), options)) as typeof fetch;
  return {
    client: new SortexClient(TEST_API, vault, transport),
    vault,
    transport,
    stored: () => value,
  };
}
test("login waits for both controlled values without trimming the password", () => {
  const email = "tester@sortex.example.invalid";
  assert.equal(isLoginReady("", ""), false);
  assert.equal(isLoginReady("  ", "12345678"), false);
  assert.equal(isLoginReady(email, ""), false);
  assert.equal(isLoginReady(email, "1234567"), false);
  assert.equal(isLoginReady(email, "🔒123456"), false);
  assert.equal(isLoginReady(email, "🔒1234567"), true);
  assert.equal(isLoginReady(email, " 123456 "), true);
});
test("API principal, credenciais e proxy arbitrário recusados", () => {
  assert.equal(validateApiUrl(TEST_API), TEST_API);
  assert.equal(validateApiUrl(QA_API + "/"), QA_API);
  assert.throws(() => validateApiUrl(QA_API.replace("sortexqa", "other")));
  assert.throws(() => validateApiUrl(QA_API + "/another/path"));
  for (const url of [
    "https://sortex-homologacao.netlify.app",
    "https://user:pass@sortex-fase1-review.netlify.app",
    "https://evil.example",
    TEST_API + "?token=x",
  ])
    assert.throws(() => validateApiUrl(url));
  assert.equal(
    validateApiUrl("http://127.0.0.1:3338", true),
    "http://127.0.0.1:3338",
  );
});
test("documentos: CPF, CNPJ numérico e alfanumérico; rejeição de caracteres", () => {
  assert.ok(isValidCpf("529.982.247-25"));
  assert.ok(isValidCnpj("11.222.333/0001-81"));
  assert.ok(isValidCnpj("12.ABC.345/01DE-35"));
  assert.ok(!isValidCpf("11111111111"));
  assert.ok(!isValidCnpj("11!222333000181"));
});
test("catálogo completo, pesquisa sem acentos e município consistente", () => {
  assert.equal(states.length, 27);
  assert.ok(search(cities.BA!, "Feira").some((c) => c.id === "2910800"));
  assert.ok(search(states, "sao").some((s) => s.code === "SP"));
  const v = {
    ...initial,
    state: "BA",
    city: "Feira de Santana",
    municipalityCode: "3550308",
  };
  assert.ok(validateRegistration(v, 1).some((e) => e.includes("município")));
});
test("payload não reaproveita identidade PJ ao escolher comprador/PF", () => {
  const v = {
    ...initial,
    cnpj: "11.222.333/0001-81",
    organizationName: "Teste",
  };
  assert.equal(registrationPayload(v).cnpj, undefined);
  assert.equal(
    registrationPayload({ ...v, role: "ORGANIZER", personType: "PF" })
      .organizationName,
    undefined,
  );
});
test("refresh simultâneo tem uma única rotação e retry preserva autenticação", async () => {
  let refresh = 0;
  const app = setup(async (p, o) => {
    if (p === "/auth/login")
      return response({ user, accessToken: "old", refreshToken: "r1" });
    if (p === "/auth/refresh") {
      refresh++;
      await new Promise((r) => setTimeout(r, 15));
      return response({ accessToken: "new", refreshToken: "r2" });
    }
    if (p === "/auth/me") return response(user);
    return new Headers(o?.headers).get("Authorization") === "Bearer new"
      ? response({ ok: true })
      : response({ message: "expirou" }, 401);
  });
  await app.client.login(user.email, "synthetic");
  await Promise.all([app.client.request("/data"), app.client.request("/data")]);
  assert.equal(refresh, 1);
  assert.equal(app.stored()?.refreshToken, "r2");
});
test("sem rede durante restauração preserva sessão segura para retry", async () => {
  const app = setup(async () => {
    throw Error("offline");
  });
  await app.vault.write({ accessToken: "a", refreshToken: "r" });
  await app.client.restore();
  assert.equal(app.client.snapshot().status, "offline");
  assert.ok(app.stored());
});
test("refresh revogado remove sessão local", async () => {
  const app = setup(async () => response({ message: "revogado" }, 401));
  await app.vault.write({ accessToken: "a", refreshToken: "r" });
  await app.client.restore();
  assert.equal(app.client.snapshot().status, "signedOut");
  assert.equal(app.stored(), null);
});
test("resposta tardia do refresh não ressuscita logout", async () => {
  let release: () => void = () => {};
  const wait = new Promise<void>((r) => {
    release = r;
  });
  const app = setup(async (p) => {
    if (p === "/auth/login")
      return response({ user, accessToken: "a", refreshToken: "r" });
    if (p === "/auth/me") return response(user);
    if (p === "/auth/refresh") {
      await wait;
      return response({ accessToken: "b", refreshToken: "r2" });
    }
    if (p === "/auth/logout") return response({ ok: true });
    return response({}, 401);
  });
  await app.client.login(user.email, "synthetic");
  const pending = app.client.request("/data").catch(() => {});
  await new Promise((r) => setTimeout(r, 5));
  await app.client.logout();
  release();
  await pending;
  assert.equal(app.stored(), null);
  assert.equal(app.client.snapshot().status, "signedOut");
});
test("administrador não é admitido no aplicativo", async () => {
  const app = setup(async () =>
    response({
      user: { ...user, role: "ADMIN" },
      accessToken: "a",
      refreshToken: "r",
    }),
  );
  await assert.rejects(() => app.client.login(user.email, "synthetic"));
  assert.equal(app.stored(), null);
});

import { recoveryTokenFromUrl, validateChallenge } from "../src/auth/callback";
test("retorno ao app rejeita origem, token duplicado e sessão em URL", () => {
  const t = "a".repeat(64);
  assert.equal(
    recoveryTokenFromUrl("sortex-dev://reset-password?token=" + t),
    t,
  );
  for (const u of [
    "https://evil.example/?token=" + t,
    "sortex-dev://oauth?accessToken=secret",
    "sortex-dev://reset-password?token=" + t + "&token=" + t,
  ])
    assert.equal(recoveryTokenFromUrl(u), null);
});
test("desafio nativo exige state/nonce e validade limitada", () => {
  const challenge = {
    state: "a".repeat(43),
    nonce: "b".repeat(43),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  };
  assert.equal(validateChallenge(challenge), challenge);
  assert.throws(() => validateChallenge({ ...challenge, nonce: "" }));
  assert.throws(() =>
    validateChallenge({ ...challenge, expiresAt: "invalid" }),
  );
});
test("falha do armazenamento ao sair bloqueia a interface autenticada", async () => {
  const vault: Vault = {
    read: async () => null,
    write: async () => {},
    clear: async () => {
      throw Error("keychain unavailable");
    },
  };
  const api = new SortexClient(TEST_API, vault, (async (url: string) =>
    response(
      url.endsWith("/auth/login")
        ? { user, accessToken: "a", refreshToken: "r" }
        : user,
    )) as typeof fetch);
  await api.login(user.email, "synthetic");
  await assert.rejects(() => api.logout());
  assert.equal(api.snapshot().status, "storageError");
  assert.equal(api.snapshot().user, null);
  await assert.rejects(() => api.request("/buyer/profile"));
});
import fs from "node:fs";
import path from "node:path";
import {
  isValidCpf as serverCpf,
  isValidCnpj as serverCnpj,
} from "../../../services/api/src/common/brazilian-documents";
test("contratos puros e catálogo permanecem compatíveis com o servidor", () => {
  const root = path.resolve(import.meta.dirname, "../../..");
  assert.deepEqual(
    JSON.parse(
      fs.readFileSync(
        path.join(root, "apps/mobile/assets/municipalities.json"),
        "utf8",
      ),
    ),
    JSON.parse(
      fs.readFileSync(
        path.join(root, "services/api/src/locations/data/municipalities.json"),
        "utf8",
      ),
    ),
  );
  for (let i = 0; i < 100; i++) {
    const suffix = String(i).padStart(2, "0");
    for (const root of [
      "112223330001",
      "12ABC34501DE",
      "000000000000",
      "FFFFFFFFFFFF",
    ])
      assert.equal(isValidCnpj(root + suffix), serverCnpj(root + suffix));
    for (const root of ["529982247", "111111111", "000000000"])
      assert.equal(isValidCpf(root + suffix), serverCpf(root + suffix));
  }
});
test("requisição da conta anterior não é repetida com a sessão de outra pessoa", async () => {
  let release: () => void = () => {};
  const wait = new Promise<void>((r) => {
    release = r;
  });
  let logins = 0,
    mutations = 0;
  const app = setup(async (p) => {
    if (p === "/auth/login") {
      logins++;
      return response({
        user: { ...user, id: String(logins) },
        accessToken: "a" + logins,
        refreshToken: "r" + logins,
      });
    }
    if (p === "/auth/me") return response({ ...user, id: String(logins) });
    if (p === "/auth/logout") return response({});
    if (p === "/buyer/profile") {
      mutations++;
      await wait;
      return response({}, 401);
    }
    throw Error("Não deveria renovar/repetir sob nova sessão");
  });
  await app.client.login(user.email, "synthetic");
  const mutation = app.client
    .request("/buyer/profile", "PATCH", { name: "Conta antiga" })
    .catch(() => {});
  await app.client.logout();
  await app.client.login("other@sortex.example.invalid", "synthetic");
  release();
  await mutation;
  assert.equal(mutations, 1);
  assert.equal(app.client.snapshot().user?.id, "2");
  assert.equal(app.stored()?.accessToken, "a2");
});
test("falha remota tardia do logout não encerra uma nova sessão", async () => {
  let release: () => void = () => {};
  const wait = new Promise<void>((r) => {
    release = r;
  });
  let n = 0;
  const app = setup(async (p) => {
    if (p === "/auth/login")
      return response({ user, accessToken: "a" + ++n, refreshToken: "r" + n });
    if (p === "/auth/me") return response({ ...user, id: String(n) });
    if (p === "/auth/logout") {
      await wait;
      throw Error("offline");
    }
    return response({});
  });
  await app.client.login(user.email, "synthetic");
  const logout = app.client.logout();
  await new Promise((r) => setTimeout(r, 0));
  await app.client.login("other@sortex.example.invalid", "synthetic");
  release();
  await logout;
  assert.equal(app.client.snapshot().status, "signedIn");
  assert.equal(app.client.snapshot().user?.id, "2");
});
test("perfil retornado da sessão anterior não substitui o novo usuário", async () => {
  let release: () => void = () => {};
  const wait = new Promise<void>((r) => {
    release = r;
  });
  let n = 0,
    me = 0;
  const app = setup(async (p) => {
    if (p === "/auth/login")
      return response({ user, accessToken: "a" + ++n, refreshToken: "r" + n });
    if (p === "/auth/me") {
      const current = n;
      if (++me === 2) await wait;
      return response({ ...user, id: String(current) });
    }
    return response({});
  });
  await app.client.login(user.email, "synthetic");
  const reload = app.client.reloadUser();
  await app.client.logout();
  await app.client.login("other@sortex.example.invalid", "synthetic");
  release();
  await reload;
  assert.equal(app.client.snapshot().user?.id, "2");
});

test("Pix nativo exige opt-in, HTTPS conhecido, comprador e config explícita", async () => {
  const calls: string[] = [];
  let remote: unknown = {
    enabled: true,
    environment: "production",
    method: "PIX",
    provider: "MERCADO_PAGO",
  };
  const signed = {
    baseUrl: QA_API,
    snapshot: () =>
      ({ status: "signedIn", user }) as ReturnType<SortexClient["snapshot"]>,
    request: async <T>(path: string) => {
      calls.push(path);
      return remote as T;
    },
  };
  assert.equal(
    await new BuyerSandboxPix(signed, user.id, false).enabled(),
    false,
  );
  assert.equal(
    await new BuyerSandboxPix(
      { ...signed, baseUrl: "http://127.0.0.1:3338" },
      user.id,
      true,
    ).enabled(),
    false,
  );
  for (const baseUrl of [
    TEST_API,
    "https://sortex-homologacao.netlify.app",
    QA_API + ".example.test",
  ]) {
    const disabled = new BuyerSandboxPix({ ...signed, baseUrl }, user.id, true);
    assert.equal(await disabled.enabled(), false);
    await assert.rejects(disabled.create("purchase-1", true), /indisponível/);
  }
  await assert.rejects(
    new BuyerSandboxPix(signed, "different-user", true).enabled(),
    /conta de comprador/,
  );
  assert.deepEqual(calls, []);

  const api = new BuyerSandboxPix(signed, user.id, true);
  await assert.rejects(api.create("purchase-1", false), /apenas para teste/);
  await assert.rejects(api.create("purchase-1", true), /indisponível/);
  assert.deepEqual(calls, ["/payments/native-sandbox-pix/config"]);
  remote = {
    enabled: true,
    environment: "sandbox",
    method: "PIX",
    provider: "MERCADO_PAGO",
  };
  assert.equal(await api.enabled(), true);
});

test("Pix nativo vincula solicitação e resposta ao pedido, sem enviar valor ou dados de banco", async () => {
  const calls: unknown[] = [];
  let payment = {
    id: "pix-1",
    purchaseId: "purchase-1",
    status: "PENDING",
    environment: "sandbox",
    amount: 1.5,
    expiresAt: null,
    awaitingProvider: false,
  };
  const api = new BuyerSandboxPix(
    {
      baseUrl: QA_API,
      snapshot: () =>
        ({ status: "signedIn", user }) as ReturnType<SortexClient["snapshot"]>,
      request: async <T>(path: string, method?: string, body?: unknown) => {
        calls.push([path, method, body]);
        return (
          path.endsWith("/config")
            ? {
                enabled: true,
                environment: "sandbox",
                method: "PIX",
                provider: "MERCADO_PAGO",
              }
            : payment
        ) as T;
      },
    },
    user.id,
    true,
  );
  assert.deepEqual(await api.create("purchase-1", true), payment);
  assert.deepEqual(calls, [
    ["/payments/native-sandbox-pix/config", undefined, undefined],
    [
      "/payments/native-sandbox-pix",
      "POST",
      { purchaseId: "purchase-1", acceptedTerms: true },
    ],
  ]);
  payment = { ...payment, purchaseId: "other-purchase" };
  await assert.rejects(api.get("purchase-1"), /deste pedido/);
  payment = { ...payment, purchaseId: "purchase-1", environment: "production" };
  await assert.rejects(api.get("purchase-1"), /deste pedido/);
});
