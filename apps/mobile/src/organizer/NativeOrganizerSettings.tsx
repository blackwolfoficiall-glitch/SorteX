import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { PremiumButton, PremiumField, PremiumMessage, PremiumPage, PremiumPanel,
  premiumTypography, usePremiumTheme } from "../theme/premium";
import { loadSettingsDocument, loadSettingsLegal, loadSettingsPlan, organizerSettingsSections,
  type LegalDocumentEntry, type SettingsClient, type SettingsSession } from "./settings";

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Bahia" });
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const subscriptionStatus: Record<string, string> = {
  TRIAL: "Em teste", ACTIVE: "Ativa", PAST_DUE: "Em atraso", CANCELLED: "Cancelada", SUSPENDED: "Suspensa",
};
const requestTypes: Record<string, string> = {
  ACCESS: "Acesso aos dados", EXPORT: "Exportação", CORRECTION: "Correção", DELETION: "Exclusão",
  ANONYMIZATION: "Anonimização", RESTRICTION: "Restrição",
};
const requestStatus: Record<string, string> = {
  OPEN: "Aberta", UNDER_REVIEW: "Em análise", COMPLETED: "Concluída", REJECTED: "Rejeitada", CANCELLED: "Cancelada",
};
const translated = (dictionary: Record<string, string>, key: string) =>
  Object.hasOwn(dictionary, key) ? dictionary[key]! : "Não identificado";
type SessionProps = { client: SettingsClient; session: SettingsSession };
type View = "menu" | "plan" | "legal";
function useSettingsRead<T>(client: SettingsClient, { organizerId, revision }: SettingsSession,
  load: (client: SettingsClient, session: SettingsSession) => Promise<T | null>) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; data: T | null }>();
  useEffect(() => {
    let active = true;
    void load(client, { organizerId, revision }).then((data) => {
      if (active && data !== null) setResult({ attempt, data });
    }).catch(() => { if (active) setResult({ attempt, data: null }); });
    return () => { active = false; };
  }, [attempt, client, organizerId, revision, load]);
  return { value: result?.attempt === attempt ? result.data : undefined, retry: () => setAttempt((n) => n + 1) };
}
function ReadState({ title, failed, retry }: { title: string; failed: boolean; retry: () => void }) {
  const theme = usePremiumTheme();
  return failed ? <PremiumPanel>
    <PremiumMessage error message={"Não foi possível consultar " + title + "."} />
    <PremiumButton title="Tentar novamente" onPress={retry} />
  </PremiumPanel> : <ActivityIndicator accessibilityLabel={"Carregando " + title} color={theme.accent} />;
}

export function NativeOrganizerSettings({ client, session, onProfile }: SessionProps & { onProfile: () => void }) {
  const [section, setSection] = useState<View>("menu");
  const page = section === "plan" ? "Meu plano" : section === "legal" ? "Central Jurídica" : "Configurações";
  return <PremiumPage title={page} top={false} bottom>
    {section !== "menu" && <PremiumButton title="Voltar a Configurações" onPress={() => setSection("menu")} />}
    {section === "plan" && <PlanContent client={client} session={session} />}
    {section === "legal" && <LegalContent client={client} session={session} />}
    {section === "menu" && organizerSettingsSections.map((item) => {
      const open = item.id === "profile" ? onProfile : item.id === "plan" ? () => setSection("plan")
        : item.id === "legal" ? () => setSection("legal") : null;
      return <PremiumPanel key={item.id} title={item.title}>
        <PremiumMessage message={item.description} />
        {open ? <PremiumButton title={"Abrir " + item.title} onPress={open} /> : null}
      </PremiumPanel>;
    })}
  </PremiumPage>;
}
function PlanContent({ client, session }: SessionProps) {
  const { value, retry } = useSettingsRead(client, session, loadSettingsPlan);
  if (!value) return <ReadState title="o plano" failed={value === null} retry={retry} />;
  return <>
    <PremiumMessage message="Consulta de homologação. Nesta tela não é possível contratar, cancelar ou efetuar cobranças." />
    {value.plan ? <PremiumPanel title={value.plan.name}>
      {value.plan.description && <PremiumMessage message={value.plan.description} />}
      <PremiumMessage message={"Preço mensal de referência: " + brl.format(value.plan.monthlyPrice)} />
      {value.plan.features.map((item) => <PremiumMessage key={item.id}
        message={item.name + ": " + (typeof item.value === "boolean" ? item.value ? "Incluído" : "Não incluído" : item.value)} />)}
    </PremiumPanel> : <PremiumMessage message="Nenhum plano informado pela API." />}
    <PremiumPanel title="Consumo e assinatura">
      <PremiumMessage message={"Campanhas registradas: " + value.campaigns} />
      {value.subscription ? <>
        <PremiumMessage message={"Situação da assinatura: " + translated(subscriptionStatus, value.subscription.status)} />
        <PremiumMessage message={value.subscription.autoRenew ? "Renovação automática registrada." : "Sem renovação automática registrada."} />
        {value.subscription.nextRenewalAt && <PremiumMessage
          message={"Próxima renovação registrada: " + date.format(new Date(value.subscription.nextRenewalAt))} />}
      </> : <PremiumMessage message="Nenhuma assinatura registrada." />}
    </PremiumPanel>
  </>;
}
function LegalContent({ client, session }: SessionProps) {
  const { value, retry } = useSettingsRead(client, session, loadSettingsLegal);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LegalDocumentEntry | null>(null);
  if (!value) return <ReadState title="a Central Jurídica" failed={value === null} retry={retry} />;
  if (selected) return <LegalDocumentContent key={selected.slug + ":" + selected.version} client={client}
    session={session} document={selected} onBack={() => setSelected(null)} />;
  const q = query.trim().toLocaleLowerCase("pt-BR");
  const docs = value.documents.filter((doc) => !q || (doc.title + " " + doc.category).toLocaleLowerCase("pt-BR").includes(q));
  return <>
    <PremiumMessage message="Consulta de versões, aceites e solicitações já registradas. Não registra novos aceites nem solicitações aqui." />
    <PremiumField label="Pesquisar documentos" value={query} onChangeText={setQuery} />
    {!docs.length && <PremiumMessage message={value.documents.length ? "Nenhum documento encontrado." : "Nenhum documento publicado."} />}
    {docs.map((doc) => <PremiumPanel key={doc.slug} title={doc.title}>
      <PremiumMessage message={"Versão " + doc.version + " · " + doc.category} />
      <PremiumMessage message={value.acceptances.some((entry) => entry.slug === doc.slug && entry.version === doc.version)
        ? "Aceite desta versão registrado." : "Sem aceite desta versão."} />
      <PremiumButton title={"Ler " + doc.title} onPress={() => setSelected(doc)} />
    </PremiumPanel>)}
    <PremiumPanel title="Histórico de aceites">
      {!value.acceptances.length && <PremiumMessage message="Nenhum aceite registrado." />}
      {value.acceptances.map((entry) => <PremiumMessage key={entry.id}
        message={entry.title + " · versão " + entry.version + " · " + date.format(new Date(entry.acceptedAt))} />)}
    </PremiumPanel>
    <PremiumPanel title="Solicitações de dados">
      {!value.requests.length && <PremiumMessage message="Nenhuma solicitação registrada." />}
      {value.requests.map((entry) => <PremiumMessage key={entry.id}
        message={translated(requestTypes, entry.type) + " · " + translated(requestStatus, entry.status) +
          " · " + date.format(new Date(entry.requestedAt))} />)}
    </PremiumPanel>
  </>;
}
function LegalDocumentContent({ client, session, document, onBack }: SessionProps & {
  document: LegalDocumentEntry; onBack: () => void;
}) {
  const theme = usePremiumTheme();
  const load = React.useCallback((api: SettingsClient, active: SettingsSession) =>
    loadSettingsDocument(api, active, document), [document]);
  const { value, retry } = useSettingsRead(client, session, load);
  return <>
    <PremiumButton title="Voltar aos documentos" onPress={onBack} />
    {!value ? <ReadState failed={value === null} title="o documento" retry={retry} /> :
      <PremiumPanel title={value.document.title}>
        <PremiumMessage message={"Versão " + value.document.version + " · " + value.document.category} />
        {value.kind === "rich-on-web"
          ? <PremiumMessage message="O texto integral desta versão, com conteúdo formatado, está disponível na Central Jurídica do site. Nenhum aceite foi registrado." />
          : value.blocks.map((block, index) => <Text key={index} selectable
              style={[premiumTypography.body, { color: theme.text }]}>{block}</Text>)}
      </PremiumPanel>}
  </>;
}
