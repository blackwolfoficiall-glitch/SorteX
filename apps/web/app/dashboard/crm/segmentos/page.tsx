"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Plus, Tags, X } from "lucide-react";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import {
  CrmNotice,
  CrmWorkspace,
  CrmWorkspaceDialog,
} from "@/components/crm/CrmWorkspace";
import ui from "@/components/crm/crm-workspace-premium.module.css";
import {
  calculateSegment,
  createSegment,
  createTag,
  deleteSegment,
  deleteTag,
  segments,
  previewSegment,
  tags,
  updateTag,
  updateSegment,
  type CrmTag,
  type Segment,
} from "@/lib/crm/client";

const automatic = [
  "Todos os contatos",
  "Leads",
  "Clientes",
  "VIP",
  "Reservas abandonadas",
  "Pagamento pendente",
  "Compradores dos últimos 7 dias",
  "Compradores dos últimos 30 dias",
];

export default function Segmentos() {
  const organizer = useAuthorizedUser();
  return organizer ? <SegmentsView key={organizer.id} /> : null;
}

function SegmentsView() {
  const query = useSearchParams();
  const [items, setItems] = useState<Segment[]>([]);
  const [tagItems, setTagItems] = useState<CrmTag[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [segmentOpen, setSegmentOpen] = useState(query.get("action") === "new");
  const [editingId, setEditingId] = useState("");
  const [step, setStep] = useState(1);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");
  const [minSpent, setMinSpent] = useState("");
  const [minPurchases, setMinPurchases] = useState("");
  const [inactiveDays, setInactiveDays] = useState("");
  const [tagName, setTagName] = useState("");
  const [tagOpen, setTagOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  const load = useCallback(async (isCurrent: () => boolean = () => true) => {
    setLoading(true);
    setLoadError(false);
    try {
      const [segmentRows, tagRows] = await Promise.all([segments(), tags()]);
      if (!isCurrent()) return;
      setItems(segmentRows);
      setTagItems(tagRows);
    } catch {
      if (isCurrent()) setLoadError(true);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return load(() => active);
    });
    return () => {
      active = false;
    };
  }, [load]);

  async function mutate(
    action: () => Promise<unknown>,
    success: string,
    reset?: () => void,
    isDialog = false,
  ) {
    if (mutating) return;
    setError("");
    setDialogError("");
    setMessage("");
    setMutating(true);
    try {
      await action();
      reset?.();
      setMessage(success);
      await load();
    } catch {
      const text = "Não foi possível concluir a alteração. Tente novamente.";
      if (isDialog) setDialogError(text);
      else setError(text);
    } finally {
      setMutating(false);
    }
  }

  function currentRules() {
    return Object.fromEntries(
      Object.entries({
        status,
        city,
        minSpent: minSpent ? Number(minSpent) : undefined,
        minPurchases: minPurchases ? Number(minPurchases) : undefined,
        inactiveDays: inactiveDays ? Number(inactiveDays) : undefined,
      }).filter(([, value]) => value !== "" && value !== undefined),
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== 4 || !name.trim()) return;
    const body = {
      name,
      description: description || undefined,
      type: "DYNAMIC",
      isDynamic: true,
      rules: currentRules(),
    };
    void mutate(
      () => (editingId ? updateSegment(editingId, body) : createSegment(body)),
      editingId ? "Segmento atualizado." : "Segmento criado.",
      () => setSegmentOpen(false),
      true,
    );
  }

  async function goToPreview() {
    if (previewing) return;
    setPreviewing(true);
    setDialogError("");
    try {
      const result = await previewSegment({
        name: name || "Prévia",
        type: "DYNAMIC",
        isDynamic: true,
        rules: currentRules(),
      });
      setPreviewCount(result.count);
      setStep(3);
    } catch {
      setDialogError(
        "Não foi possível calcular a prévia. Confira as regras e tente novamente.",
      );
    } finally {
      setPreviewing(false);
    }
  }

  function openNewSegment() {
    setEditingId("");
    setName("");
    setDescription("");
    setStatus("");
    setCity("");
    setMinSpent("");
    setMinPurchases("");
    setInactiveDays("");
    setStep(1);
    setPreviewCount(null);
    setDialogError("");
    setSegmentOpen(true);
  }
  function editSegment(segment: Segment) {
    setDialogError("");
    setPreviewCount(null);
    const rules = segment.rules || {};
    setEditingId(segment.id);
    setName(segment.name);
    setDescription(segment.description || "");
    setStatus(String(rules.status || ""));
    setCity(String(rules.city || ""));
    setMinSpent(rules.minSpent == null ? "" : String(rules.minSpent));
    setMinPurchases(
      rules.minPurchases == null ? "" : String(rules.minPurchases),
    );
    setInactiveDays(
      rules.inactiveDays == null ? "" : String(rules.inactiveDays),
    );
    setStep(1);
    setSegmentOpen(true);
  }
  function submitTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tagName.trim()) return;
    void mutate(
      () => createTag({ name: tagName, color: "#7c3aed" }),
      "Etiqueta criada.",
      () => {
        setTagName("");
        setTagOpen(false);
      },
      true,
    );
  }

  function editTag(tag: CrmTag) {
    const name = window.prompt("Novo nome da etiqueta", tag.name)?.trim();
    if (!name || name === tag.name) return;
    void mutate(
      () => updateTag(tag.id, { name, color: tag.color }),
      "Etiqueta atualizada.",
    );
  }

  function dismissSegment() {
    if (!mutating && !previewing) setSegmentOpen(false);
  }

  return (
    <CrmWorkspace
      title="Segmentos"
      subtitle="Organize públicos dinâmicos que se atualizam conforme as regras."
      actions={
        <button
          type="button"
          className={`sx-premium-button ${ui.heroAction}`}
          onClick={openNewSegment}
          disabled={mutating}
        >
          <Plus size={18} aria-hidden="true" /> Novo segmento
        </button>
      }
    >
      {message && <CrmNotice kind="success">{message}</CrmNotice>}
      {error && <CrmNotice kind="error">{error}</CrmNotice>}
      {loading && <CrmNotice>Carregando segmentos e etiquetas…</CrmNotice>}
      {loadError && (
        <CrmNotice kind="error">
          Não foi possível carregar os segmentos e as etiquetas.
          <p>
            <button
              type="button"
              className="sx-premium-button"
              onClick={() => void load()}
            >
              Tentar novamente
            </button>
          </p>
        </CrmNotice>
      )}
      <section
        className={`sx-premium-surface ${ui.panel}`}
        aria-label="Segmentos automáticos"
      >
        <h2 className="sx-premium-section">Segmentos automáticos</h2>
        <div className={ui.autoGrid}>
          {automatic.map((label) => (
            <span key={label} className={ui.inset}>
              {label}
            </span>
          ))}
        </div>
      </section>
      {!loadError && !loading && (
        <div className={ui.detailGrid}>
          <section
            className={`sx-premium-surface ${ui.panel}`}
            aria-labelledby="crm-custom-segments"
          >
            <h2 id="crm-custom-segments" className="sx-premium-section">
              Segmentos personalizados
            </h2>
            {items.map((segment) => (
              <article key={segment.id} className={`${ui.inset} ${ui.stack}`}>
                <div className={ui.row}>
                  <div>
                    <strong>{segment.name}</strong>
                    <p className={ui.label}>
                      {segment.contactCount} contatos ·{" "}
                      {segment.type === "DYNAMIC" ? "Dinâmico" : "Manual"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`sx-premium-button ${ui.negative}`}
                    disabled={mutating}
                    aria-label={`Excluir segmento ${segment.name}`}
                    onClick={() =>
                      void mutate(
                        () => deleteSegment(segment.id),
                        "Segmento excluído.",
                      )
                    }
                  >
                    Excluir
                  </button>
                </div>
                <div className={ui.actions}>
                  <button
                    type="button"
                    className="sx-premium-button"
                    disabled={mutating}
                    aria-label={`Editar segmento ${segment.name}`}
                    onClick={() => editSegment(segment)}
                  >
                    <Pencil size={15} aria-hidden="true" /> Editar
                  </button>
                  <button
                    type="button"
                    className="sx-premium-button"
                    disabled={mutating}
                    aria-label={`Recalcular segmento ${segment.name}`}
                    onClick={() =>
                      void mutate(
                        () => calculateSegment(segment.id),
                        "Segmento recalculado.",
                      )
                    }
                  >
                    Recalcular
                  </button>
                  <Link
                    href={`/dashboard/comunicacao?tab=new&segmentId=${segment.id}`}
                    className="sx-premium-button"
                    data-variant="ghost"
                  >
                    Preparar comunicação
                  </Link>
                </div>
              </article>
            ))}
            {!items.length && (
              <p className={ui.empty}>Nenhum segmento personalizado.</p>
            )}
          </section>
          <section
            className={`sx-premium-surface ${ui.panel}`}
            aria-labelledby="crm-segment-tags"
          >
            <div className={ui.row}>
              <h2 id="crm-segment-tags" className="sx-premium-section">
                Etiquetas
              </h2>
              <button
                type="button"
                className="sx-premium-button"
                disabled={mutating}
                onClick={() => {
                  setDialogError("");
                  setTagOpen(true);
                }}
              >
                <Tags size={18} aria-hidden="true" /> Nova etiqueta
              </button>
            </div>
            {tagItems.map((tag) => (
              <div key={tag.id} className={`${ui.inset} ${ui.row}`}>
                <p>
                  <strong>{tag.name}</strong>{" "}
                  <small className={ui.label}>
                    ({tag._count?.contacts || 0})
                  </small>
                </p>
                <div className={ui.actions}>
                  <button
                    type="button"
                    className="sx-premium-button"
                    disabled={mutating}
                    onClick={() => editTag(tag)}
                    aria-label={`Editar etiqueta ${tag.name}`}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className={`sx-premium-button ${ui.negative}`}
                    disabled={mutating}
                    aria-label={`Excluir etiqueta ${tag.name}`}
                    onClick={() =>
                      void mutate(() => deleteTag(tag.id), "Etiqueta excluída.")
                    }
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {!tagItems.length && (
              <p className={ui.empty}>Nenhuma etiqueta criada.</p>
            )}
          </section>
        </div>
      )}

      {segmentOpen && (
        <CrmWorkspaceDialog
          titleId="crm-segment-dialog-title"
          onDismiss={dismissSegment}
        >
          <form onSubmit={submit} className={ui.stack}>
            <div className={ui.row}>
              <div>
                <p className={ui.label}>Etapa {step} de 4</p>
                <h2
                  id="crm-segment-dialog-title"
                  className="sx-premium-section"
                >
                  {editingId ? "Editar segmento" : "Novo segmento"}
                </h2>
              </div>
              <button
                type="button"
                className="sx-premium-button"
                onClick={dismissSegment}
                disabled={mutating || previewing}
                aria-label="Fechar"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <progress
              className={ui.dialogProgress}
              value={step}
              max={4}
              aria-label="Etapa do segmento"
            />
            {step === 1 && (
              <div className={ui.stack}>
                <label className={ui.fieldLabel}>
                  Nome
                  <input
                    required
                    value={name}
                    className={ui.field}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label className={ui.fieldLabel}>
                  Descrição opcional
                  <textarea
                    className={ui.field}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
              </div>
            )}
            {step === 2 && (
              <div className={`${ui.grid} ${ui.panelDouble}`}>
                <label className={ui.fieldLabel}>
                  Status
                  <select
                    className={ui.field}
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option value="">Qualquer status</option>
                    <option value="LEAD">Lead</option>
                    <option value="CUSTOMER">Cliente</option>
                    <option value="VIP">VIP</option>
                    <option value="INACTIVE">Inativo</option>
                  </select>
                </label>
                <label className={ui.fieldLabel}>
                  Cidade
                  <input
                    className={ui.field}
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                  />
                </label>
                <label className={ui.fieldLabel}>
                  Gasto mínimo
                  <input
                    className={ui.field}
                    type="number"
                    min="0"
                    value={minSpent}
                    onChange={(event) => setMinSpent(event.target.value)}
                  />
                </label>
                <label className={ui.fieldLabel}>
                  Compras mínimas
                  <input
                    className={ui.field}
                    type="number"
                    min="0"
                    value={minPurchases}
                    onChange={(event) => setMinPurchases(event.target.value)}
                  />
                </label>
                <label className={ui.fieldLabel}>
                  Sem comprar há X dias
                  <input
                    className={ui.field}
                    type="number"
                    min="1"
                    value={inactiveDays}
                    onChange={(event) => setInactiveDays(event.target.value)}
                  />
                </label>
              </div>
            )}
            {step === 3 && (
              <div className={ui.note}>
                <p>Prévia calculada no banco</p>
                <strong className={ui.metricValue}>{previewCount ?? 0}</strong>
                <p className={ui.label}>Contato(s) atendem às regras atuais.</p>
              </div>
            )}
            {step === 4 && (
              <div className={ui.note}>
                <strong>Confirmar segmento</strong>
                <p>
                  {name} será salvo como segmento dinâmico com{" "}
                  {previewCount ?? 0} contato(s) na contagem inicial.
                </p>
              </div>
            )}
            {dialogError && <CrmNotice kind="error">{dialogError}</CrmNotice>}
            <div className={ui.modalActions}>
              {step > 1 && (
                <button
                  type="button"
                  className="sx-premium-button"
                  disabled={mutating || previewing}
                  onClick={() => {
                    setDialogError("");
                    setStep((n) => n - 1);
                  }}
                >
                  Voltar
                </button>
              )}
              {step === 1 && (
                <button
                  type="button"
                  className="sx-premium-button"
                  data-variant="primary"
                  disabled={!name.trim()}
                  onClick={() => setStep(2)}
                >
                  Continuar
                </button>
              )}
              {step === 2 && (
                <button
                  type="button"
                  className="sx-premium-button"
                  data-variant="primary"
                  disabled={previewing}
                  onClick={() => void goToPreview()}
                >
                  {previewing ? "Calculando..." : "Calcular prévia"}
                </button>
              )}
              {step === 3 && (
                <button
                  type="button"
                  className="sx-premium-button"
                  data-variant="primary"
                  onClick={() => setStep(4)}
                >
                  Continuar
                </button>
              )}
              {step === 4 && (
                <button
                  type="submit"
                  className="sx-premium-button"
                  data-variant="primary"
                  disabled={mutating}
                >
                  {mutating
                    ? "Salvando..."
                    : editingId
                      ? "Salvar alterações"
                      : "Criar segmento"}
                </button>
              )}
            </div>
          </form>
        </CrmWorkspaceDialog>
      )}
      {tagOpen && (
        <CrmWorkspaceDialog
          titleId="crm-tag-dialog-title"
          onDismiss={() => {
            if (!mutating) setTagOpen(false);
          }}
        >
          <form onSubmit={submitTag} className={ui.stack}>
            <div className={ui.row}>
              <h2 id="crm-tag-dialog-title" className="sx-premium-section">
                Nova etiqueta
              </h2>
              <button
                className="sx-premium-button"
                type="button"
                onClick={() => setTagOpen(false)}
                disabled={mutating}
                aria-label="Fechar"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <label className={ui.fieldLabel}>
              Nome
              <input
                className={ui.field}
                required
                value={tagName}
                onChange={(event) => setTagName(event.target.value)}
              />
            </label>
            {dialogError && <CrmNotice kind="error">{dialogError}</CrmNotice>}
            <div className={ui.modalActions}>
              <button
                type="submit"
                className="sx-premium-button"
                disabled={mutating || !tagName.trim()}
                data-variant="primary"
              >
                {mutating ? "Salvando..." : "Criar etiqueta"}
              </button>
            </div>
          </form>
        </CrmWorkspaceDialog>
      )}
    </CrmWorkspace>
  );
}
