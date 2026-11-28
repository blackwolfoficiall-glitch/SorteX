import { queryPeriod } from "@/lib/api/dashboard-period";
import {
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";

export async function GET(request: Request) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  const period = queryPeriod(new URL(request.url).searchParams);
  if (!period)
    return jsonFromUpstream(
      {
        message:
          "Informe as datas inicial e final válidas, sem datas futuras e com até 367 dias de intervalo.",
      },
      400,
      headers,
    );

  const query = new URLSearchParams(period);
  const response = await authenticatedApiFetch(`/dashboard/period?${query}`);
  for (const name of ["Retry-After", "X-Request-Id"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return jsonFromUpstream(await readJson(response), response.status, headers);
}
