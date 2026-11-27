type AdvisorClient = {
  request<T>(path: string, method?: string, body?: unknown): Promise<T>;
};

export const advisorPrompts = [
  ["Dashboard", "Como estão minhas vendas?"],
  ["CRM", "Como está meu CRM?"],
  ["Financeiro", "Como está meu financeiro?"],
  ["SorteX Ads", "Qual a origem das vendas?"],
] as const;

export async function organizerAdvisorAvailable(client: AdvisorClient) {
  const response = await client.request<{ aiPilotAvailable?: boolean }>("/ai-sortex/advisor");
  return response?.aiPilotAvailable === true;
}

export async function askOrganizerAdvisor(
  client: AdvisorClient,
  prompt: typeof advisorPrompts[number][1],
  allowAi: boolean,
) {
  const result = await client.request<{
    answer?: unknown;
    mode?: unknown;
  }>("/ai-sortex/advisor/chat", "POST", { question: prompt, allowAi });
  if (!result || typeof result.answer !== "string" || !result.answer.trim()
      || result.answer.length > 1600) throw new Error("Resposta indisponível.");
  const source = result.mode === "GEMINI" ? "Google Gemini"
    : result.mode === "OPENAI" ? "OpenAI" : "Regras locais, sem IA externa";
  return { answer: result.answer, source };
}
