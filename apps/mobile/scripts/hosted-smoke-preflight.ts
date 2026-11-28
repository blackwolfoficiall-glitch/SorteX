import { setTimeout as wait } from "node:timers/promises";

type Health = { version: string; environment: string };
type Ready = { database: string; storage: string };

export async function verifyHostedReadiness(
  expected: string,
  sample: () => Promise<readonly [Health, Health, Ready]>,
  delay: (ms: number) => Promise<unknown> = wait,
): Promise<readonly [Health, Health, Ready]> {
  if (!/^[a-f0-9]{40}$/.test(expected) || expected.length !== 40)
    throw new Error("A revisão QA esperada não é um SHA completo.");
  let consecutive = 0;
  for (let attempt = 0; attempt < 6; attempt++) {
    let result: Awaited<ReturnType<typeof sample>> | undefined;
    try {
      result = await sample();
    } catch {
      // A request timeout or transient error is not proof of readiness.
    }
    if (
      result?.[0]?.version === expected &&
      result[1]?.version === expected &&
      result[1].environment === "production" &&
      result[2]?.database === "up"
    ) {
      if (++consecutive === 2) return result;
    } else {
      consecutive = 0;
    }
    if (attempt < 5) await delay(3500);
  }
  throw new Error(
    "Next e cliente móvel não confirmaram duas leituras seguidas da mesma API QA. Nenhum cadastro foi iniciado.",
  );
}
