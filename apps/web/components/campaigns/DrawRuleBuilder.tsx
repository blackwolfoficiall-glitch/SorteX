"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Sparkles, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  getDrawRuleTemplates,
  saveDrawRuleTemplate,
  simulateDrawRule,
} from "@/lib/campaigns/client";
import type {
  DrawRuleDigit,
  DrawRuleSimulation,
  DrawRuleTemplate,
} from "@/lib/campaigns/types";

export default function DrawRuleBuilder({
  templateId,
  customRule,
  onTemplate,
  onCustom,
}: {
  templateId?: string;
  customRule?: Record<string, unknown>;
  onTemplate: (id?: string) => void;
  onCustom: (rule: Record<string, unknown>) => void;
}) {
  const [templates, setTemplates] = useState<DrawRuleTemplate[]>([]);
  const [digits, setDigits] = useState<DrawRuleDigit[]>(
    (customRule?.digits as DrawRuleDigit[]) || [
      { prize: 1, position: 4, order: 0 },
    ],
  );
  const [simulation, setSimulation] = useState<DrawRuleSimulation | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    getDrawRuleTemplates()
      .then(setTemplates)
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar os modelos.",
        ),
      );
  }, []);

  function update(next: DrawRuleDigit[]) {
    setDigits(next);
    onCustom({ digits: next });
    onTemplate(undefined);
  }
  async function simulate() {
    try {
      setSimulation(await simulateDrawRule({ digits }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Regra inválida.");
    }
  }
  async function save() {
    if (!name.trim()) return setError("Informe um nome para o modelo.");
    try {
      const template = await saveDrawRuleTemplate({
        name,
        description: "Modelo personalizado do organizador",
        ruleDefinition: { digits },
      });
      setTemplates((current) => [...current, template]);
      onTemplate(template.id);
      setName("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o modelo.",
      );
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm font-bold">Modelo pronto</label>
        <select
          value={templateId || ""}
          onChange={(event) => {
            const id = event.target.value || undefined;
            onTemplate(id);
            const template = templates.find((item) => item.id === id);
            if (template) {
              setDigits(template.ruleDefinition.digits);
              onCustom(template.ruleDefinition);
            }
          }}
          className="mt-2 h-12 w-full rounded-xl border bg-white px-4"
        >
          <option value="">Regra personalizada</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>
      <div className="rounded-2xl bg-violet-50 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-black">Construtor de dígitos</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              update([
                ...digits,
                { prize: 1, position: 4, order: digits.length },
              ])
            }
          >
            <Plus size={15} /> Dígito
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {digits.map((digit, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <select
                value={digit.prize}
                onChange={(event) =>
                  update(
                    digits.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, prize: Number(event.target.value) }
                        : item,
                    ),
                  )
                }
                className="h-11 rounded-xl border px-3"
              >
                {[1, 2, 3, 4, 5].map((prize) => (
                  <option key={prize} value={prize}>
                    {prize}º prêmio
                  </option>
                ))}
              </select>
              <select
                value={digit.position}
                onChange={(event) =>
                  update(
                    digits.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, position: Number(event.target.value) }
                        : item,
                    ),
                  )
                }
                className="h-11 rounded-xl border px-3"
              >
                {[0, 1, 2, 3, 4].map((position) => (
                  <option key={position} value={position}>
                    Posição {position + 1}
                  </option>
                ))}
              </select>
              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  update(
                    digits
                      .filter((_, itemIndex) => itemIndex !== index)
                      .map((item, order) => ({ ...item, order })),
                  )
                }
                disabled={digits.length === 1}
              >
                <Trash2 size={17} />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={simulate}>
          <Sparkles size={17} /> Simular
        </Button>
        <Input
          className="h-10 max-w-xs"
          placeholder="Nome do modelo"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button variant="outline" onClick={save}>
          <Save size={17} /> Salvar modelo
        </Button>
      </div>
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      {simulation && (
        <div className="rounded-2xl bg-zinc-950 p-5 text-white">
          <p className="text-xs uppercase tracking-wide text-zinc-400">
            Resultados fictícios
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {simulation.prizes.map((prize) => (
              <span
                key={prize.prize}
                className="rounded-lg bg-white/10 px-3 py-2 text-sm"
              >
                {prize.prize}º: {prize.number}
              </span>
            ))}
          </div>
          <p className="mt-5 text-sm text-zinc-400">Número final gerado</p>
          <p className="mt-1 text-4xl font-black tracking-[0.25em] text-green-400">
            {simulation.finalNumber}
          </p>
        </div>
      )}
    </div>
  );
}
