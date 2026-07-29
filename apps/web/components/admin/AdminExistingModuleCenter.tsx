"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import { hasAdminPermission } from "@/lib/admin/authorization";

type Mode = "affiliates" | "crm" | "media";
type Row = Record<string, unknown> & { id?: string };
const config = {
  affiliates: {
    title: "Afiliados",
    subtitle: "Afiliados, conversões e solicitações de repasse",
    permission: "FINANCE_WRITE" as const,
  },
  crm: {
    title: "CRM",
    subtitle: "Saúde operacional das comunicações e automações",
    permission: "AUDIT_READ" as const,
  },
  media: {
    title: "Mídia",
    subtitle: "Templates, renderizações e falhas de geração",
    permission: "CONTENT_WRITE" as const,
  },
};

export default function AdminExistingModuleCenter({ mode }: { mode: Mode }) {
  const user = useAuthorizedUser();
  const canAct = Boolean(
    user && hasAdminPermission(user, config[mode].permission),
  );
  const [summary, setSummary] = useState<Row>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (mode === "affiliates") {
        const [affiliates, conversions, payouts] = await Promise.all([
          api<Row[]>("affiliates"),
          api<Row[]>("affiliate-conversions"),
          api<Row[]>("affiliate-payouts"),
        ]);
        setSummary({
          afiliados: affiliates.length,
          conversoes: conversions.length,
          repasses: payouts.length,
        });
        setRows([
          ...affiliates.map((row) => ({ ...row, recordType: "Afiliado" })),
          ...conversions.map((row) => ({ ...row, recordType: "Conversão" })),
          ...payouts.map((row) => ({ ...row, recordType: "Repasse" })),
        ]);
      } else {
        const base = mode === "crm" ? "crm" : "media";
        const [overview, failures] = await Promise.all([
          api<Row>(`${base}/overview`),
          api<Row[]>(`${base}/failures`),
        ]);
        setSummary(overview);
        setRows(failures);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o módulo.",
      );
    } finally {
      setLoading(false);
    }
  }, [mode]);
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);
  const shown = rows.filter((row) =>
    JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
  );
  async function suspend(id: string) {
    const reason = window.prompt("Motivo obrigatório da suspensão:");
    if (
      !reason ||
      reason.trim().length < 5 ||
      !window.confirm("Confirma a suspensão do afiliado?")
    )
      return;
    try {
      await api(`affiliates/${id}/suspend`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível suspender.",
      );
    }
  }
  return (
    <main className="p-5 pt-20 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">
              Administração
            </p>
            <h1 className="mt-2 text-3xl font-black">{config[mode].title}</h1>
            <p className="mt-1 text-slate-500">{config[mode].subtitle}</p>
          </div>
          <button
            onClick={load}
            aria-label="Atualizar módulo"
            className="rounded-xl border bg-white p-3"
          >
            <RefreshCw size={18} />
          </button>
        </header>
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-4 text-red-700"
          >
            {error}
            <button onClick={load} className="ml-3 font-bold underline">
              Tentar novamente
            </button>
          </div>
        )}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(summary)
            .filter(([, value]) => typeof value !== "object")
            .map(([key, value]) => (
              <div
                key={key}
                className="rounded-2xl border bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-bold uppercase text-slate-500">
                  {key}
                </p>
                <p className="mt-2 text-2xl font-black">{String(value ?? 0)}</p>
              </div>
            ))}
        </div>
        <label className="relative mt-6 block max-w-xl">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar registros"
            className="h-11 w-full rounded-xl border bg-white pl-10 pr-3"
          />
        </label>
        {loading ? (
          <div className="grid h-64 place-items-center">
            <LoaderCircle className="animate-spin text-violet-600" />
          </div>
        ) : shown.length ? (
          <div className="mt-5 overflow-x-auto rounded-2xl border bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-4">Registro</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row, index) => (
                  <tr key={String(row.id ?? index)} className="border-t">
                    <td className="p-4 font-bold">
                      {String(
                        row.name ??
                          row.email ??
                          row.failureReason ??
                          row.errorMessage ??
                          row.id,
                      )}
                    </td>
                    <td>
                      {String(
                        row.recordType ??
                          row.channel ??
                          row.type ??
                          "Operacional",
                      )}
                    </td>
                    <td>{String(row.status ?? "—")}</td>
                    <td>
                      {row.createdAt || row.updatedAt
                        ? new Date(
                            String(row.createdAt ?? row.updatedAt),
                          ).toLocaleString("pt-BR")
                        : "—"}
                    </td>
                    <td>
                      {mode === "affiliates" &&
                      row.recordType === "Afiliado" &&
                      canAct &&
                      row.status !== "SUSPENDED" ? (
                        <button
                          onClick={() => void suspend(String(row.id))}
                          className="rounded-lg border px-3 py-2 text-xs font-bold"
                        >
                          Suspender
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border bg-white p-12 text-center">
            <ShieldAlert className="mx-auto text-slate-300" />
            <p className="mt-3 text-slate-500">
              Nenhum registro operacional encontrado.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/platform/${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      payload.message ?? "Não foi possível concluir a solicitação.",
    );
  return payload;
}
