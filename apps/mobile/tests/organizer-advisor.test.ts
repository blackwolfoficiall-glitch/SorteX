import { strict as assert } from "node:assert";
import { test } from "node:test";
import { advisorPrompts, askOrganizerAdvisor, organizerAdvisorAvailable } from "../src/organizer/organizer-advisor";

test("uses authenticated read and closed opt-in over the shared Advisor endpoints", async () => {
  const calls: unknown[][] = [];
  const client = {
    async request<T>(...args: unknown[]) {
      calls.push(args);
      return (calls.length === 1 ? { aiPilotAvailable: true } :
        { answer: "Consulta de teste", mode: calls.length === 2 ? "DETERMINISTIC" : "GEMINI" }) as T;
    },
  };
  assert.equal(await organizerAdvisorAvailable(client), true);
  assert.equal((await askOrganizerAdvisor(client, advisorPrompts[1][1], false)).source, "Regras locais, sem IA externa");
  assert.equal((await askOrganizerAdvisor(client, advisorPrompts[3][1], true)).source, "Google Gemini");
  assert.deepEqual(calls, [
    ["/ai-sortex/advisor"],
    ["/ai-sortex/advisor/chat", "POST", { question: "Como está meu CRM?", allowAi: false }],
    ["/ai-sortex/advisor/chat", "POST", { question: "Qual a origem das vendas?", allowAi: true }],
  ]);
});

test("does not advertise an unconfigured or malformed API as AI", async () => {
  const client = { async request<T>() { return {} as T; } };
  assert.equal(await organizerAdvisorAvailable(client), false);
  await assert.rejects(askOrganizerAdvisor(client, advisorPrompts[0][1], false), /indisponível/);
});


test("labels only the fixed upstream quota fallback when the answer is local", async () => {
  const responses = [
    { mode: "DETERMINISTIC", fallbackReason: "PROVIDER_RATE_LIMIT" },
    { mode: "OPENAI", fallbackReason: "PROVIDER_RATE_LIMIT" },
    { mode: "DETERMINISTIC", fallbackReason: "Private upstream text" },
  ];
  for (const [index, response] of responses.entries()) {
    const client = { async request<T>() { return { answer: "Consulta de teste", ...response } as T; } };
    const answer = await askOrganizerAdvisor(client, advisorPrompts[0][1], true);
    assert.equal(answer.providerLimited, index === 0);
    assert.equal(JSON.stringify(answer).includes("Private upstream text"), false);
  }
});
