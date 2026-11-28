import assert from "node:assert/strict";
import test from "node:test";
import { resolveApiUpstream } from "./api-upstream.ts";

const expected = "https://staging.example.test/functions/sortex-api";

test("uses one target for the explicit test environment", () => {
  assert.equal(resolveApiUpstream({ SORTEX_HOMOLOGATION_API_URL: expected }), expected);
  assert.equal(resolveApiUpstream({
    SORTEX_HOMOLOGATION_API_URL: expected,
    API_INTERNAL_URL: expected + "/",
    API_URL: expected,
  }), expected);
});

test("refuses divergence and redacts destination values", () => {
  for (const name of ["API_INTERNAL_URL", "API_URL", "PLAYWRIGHT_API_URL"]) {
    assert.throws(() => resolveApiUpstream({
      SORTEX_HOMOLOGATION_API_URL: expected,
      [name]: "https://secret-user:secret-pass@example.test",
    }), { message: "Os destinos da API divergem da homologação da SorteX." });
  }
  for (const value of ["https://u:p@example.test", "http://staging.example.test", "https://example.test?x=1"]) {
    assert.throws(() => resolveApiUpstream({ SORTEX_HOMOLOGATION_API_URL: value }),
      { message: "SORTEX_HOMOLOGATION_API_URL deve ser uma URL de API válida." });
  }
});

test("keeps the normal legacy precedence and permits a loopback test API", () => {
  assert.equal(resolveApiUpstream({ API_INTERNAL_URL: expected, API_URL: "https://other.example.test" }), expected);
  assert.equal(resolveApiUpstream({ API_URL: expected }), expected);
  assert.equal(resolveApiUpstream({ PLAYWRIGHT_API_URL: expected }), expected);
  assert.equal(resolveApiUpstream({}), "http://localhost:3333");
  assert.equal(resolveApiUpstream({ SORTEX_HOMOLOGATION_API_URL: "http://127.0.0.1:3338" }), "http://127.0.0.1:3338");
});
