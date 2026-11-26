import React, { useEffect, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Text,
  View,
  Switch,
} from "react-native";
import {
  NavigationContainer,
  useIsFocused,
  usePreventRemove,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { recoveryTokenFromUrl } from "./src/auth/callback";
import { StatusBar } from "expo-status-bar";
import { API_URL, client } from "./src/auth/runtime";
import {
  Button,
  Choice,
  Field,
  Notice,
  Page,
  s,
  money,
  status,
  colors,
} from "./src/components/ui";
import { LocationPicker } from "./src/components/LocationPicker";
import { NativeOrganizerDraft } from "./src/components/NativeOrganizerDraft";
import { OrganizerDashboardHome } from "./src/organizer/NativeOrganizerDashboard";
import { NativeOrganizerFinance } from "./src/organizer/NativeOrganizerFinance";
import { organizerFinanceSession } from "./src/organizer/finance";
import { NativeOrganizerDraftPrizes } from "./src/components/NativeOrganizerDraftPrizes";
import { NativeOrganizerCampaignLifecycle } from "./src/components/NativeOrganizerCampaignLifecycle";
import type { OrganizerCampaignState } from "./src/domain/organizer-campaign-lifecycle";
import { NativeBuyerPrizes } from "./src/buyer/NativeBuyerPrizes";
import { BuyerInboxScreen } from "./src/buyer/NativeBuyerInbox";
import { BuyerFavoritesScreen, NativeBuyerFavoriteToggle } from "./src/buyer/NativeBuyerFavorites";
import { NativeBuyerOrderHistory } from "./src/buyer/NativeBuyerOrderHistory";
import { buyerHistorySession } from "./src/buyer/order-history";
import { NativeBuyerDrawResults } from "./src/buyer/NativeBuyerDrawResults";
import { NativePublicDrawProof } from "./src/components/NativePublicDrawProof";
import { NativePublicCampaignCover } from "./src/components/NativePublicCampaignCover";
import { publicCampaignCoverSource } from "./src/domain/public-campaign-cover";
import { isEditableOrganizerCampaign } from "./src/domain/organizer-draft";
import { NativeBuyerOrder, NativeBuyerReservation } from "./src/buyer/NativeBuyerPurchase";
import {
  initial,
  registrationPayload,
  validateRegistration,
} from "./src/domain/registration";
import type {
  Registration,
  Campaign,
  Purchase,
  Page as PageResult,
} from "../../packages/contracts/src/mobile";
const Stack = createNativeStackNavigator(),
  Tabs = createBottomTabNavigator();
const reservationTestsEnabled = process.env.EXPO_PUBLIC_ENABLE_TEST_RESERVATIONS === "1";
const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "Não foi possível concluir. Tente novamente.";
function useData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    if (!path) {
      setData(null);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    client
      .request<T>(path)
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, version]);
  return { data, error, loading, retry: () => setVersion((x) => x + 1) };
}
function Load({
  state,
  children,
}: {
  state: ReturnType<typeof useData<any>>;
  children: React.ReactNode;
}) {
  return state.loading ? (
    <ActivityIndicator accessibilityLabel="Carregando" color={colors.purple} />
  ) : state.error ? (
    <View style={s.card}>
      <Notice error message={state.error} />
      <Button title="Tentar novamente" onPress={state.retry} />
    </View>
  ) : (
    <>{children}</>
  );
}
function Login({ navigation }: any) {
  const auth = useSyncExternalStore(client.subscribe, client.snapshot);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Page>
      <Text style={s.brand}>SorteX</Text>
      <Text style={s.title}>Sua campanha, em outro nível.</Text>
      <Notice message="Aplicativo de teste · dados sintéticos · ambiente isolado" />
      {!!auth.message && <Notice error message={auth.message} />}
      <View style={s.card}>
        <Text style={s.label}>Google e Apple</Text>
        <Notice message="Indisponíveis: configuração nativa e adaptador seguro da API pendentes. Continue com e-mail." />
      </View>
      <Field
        label="E-mail"
        testID="sortex-login-email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="username"
      />
      <Field
        label="Senha"
        testID="sortex-login-password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />
      {!!error && <Notice error message={error} />}
      <Button
        title="Entrar com e-mail"
        busy={busy}
        onPress={() => {
          setBusy(true);
          setError("");
          client
            .login(email, password)
            .catch((e) => setError(message(e)))
            .finally(() => setBusy(false));
        }}
      />
      <Button
        secondary
        title="Esqueci minha senha"
        onPress={() => navigation.navigate("Forgot")}
      />
      <Button
        secondary
        title="Criar conta"
        onPress={() => navigation.navigate("Register")}
      />
      {Platform.OS === "web" && (
        <Notice message="No navegador de teste, sessão somente em memória. No aplicativo nativo, armazenamento seguro do dispositivo." />
      )}
    </Page>
  );
}
function Forgot({ navigation }: any) {
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [info, setInfo] = useState("");
  return (
    <Page title="Recuperar acesso">
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
      />
      <Button
        title="Solicitar recuperação"
        busy={busy}
        onPress={() => {
          setBusy(true);
          client
            .publicRequest("/auth/forgot-password", "POST", {
              email: email.trim(),
            })
            .then(() =>
              setInfo(
                "Solicitação recebida. O ambiente isolado não envia e-mails reais. O recebimento do link não pode ser testado por e-mail.",
              ),
            )
            .catch((e) => setInfo(message(e)))
            .finally(() => setBusy(false));
        }}
      />
      {!!info && <Notice message={info} />}
      <Button
        secondary
        title="Tenho um token de teste"
        onPress={() => navigation.navigate("Reset")}
      />
    </Page>
  );
}
function Reset({ route }: any) {
  const [token, setToken] = useState(route.params?.token || ""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [info, setInfo] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Page title="Nova senha">
      <Field
        label="Token sintético de recuperação"
        value={token}
        onChangeText={setToken}
        secureTextEntry
      />
      <Field
        label="Nova senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
      />
      <Field
        label="Confirmar nova senha"
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
      />
      <Button
        title="Salvar nova senha"
        busy={busy}
        onPress={() => {
          if (password.length < 8 || password !== confirmation) {
            setInfo("Use ao menos oito caracteres e confirme a senha.");
            return;
          }
          setBusy(true);
          client
            .publicRequest("/auth/reset-password", "POST", { token, password })
            .then(() => {
              setToken("");
              setPassword("");
              setConfirmation("");
              setInfo("Senha atualizada. Volte ao login.");
            })
            .catch((e) => setInfo(message(e)))
            .finally(() => setBusy(false));
        }}
      />
      {!!info && <Notice message={info} />}
    </Page>
  );
}
function Register({ navigation }: any) {
  const [form, setForm] = useState<Registration>({ ...initial }),
    [step, setStep] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const patch = (v: Partial<Registration>) => setForm((x) => ({ ...x, ...v }));
  const field = (key: keyof Registration, label: string, extra: any = {}) => (
    <Field
      key={key}
      label={label}
      value={String(form[key] || "")}
      onChangeText={(v) => patch({ [key]: v })}
      {...extra}
    />
  );
  usePreventRemove(step > 0 && !busy, () => setStep((x) => Math.max(0, x - 1)));
  async function next() {
    const errors = validateRegistration(form, step);
    setError(errors.join("\n"));
    if (errors.length) return;
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    try {
      await client.publicRequest(
        "/auth/register",
        "POST",
        registrationPayload(form),
      );
      try {
        await client.login(form.email, form.password);
      } catch {
        setError(
          "Conta criada. Volte ao login para entrar. Não envie o cadastro novamente.",
        );
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="Crie sua conta">
      <Text style={s.brand}>SorteX</Text>
      <Notice
        message={`Etapa ${step + 1} de 3 · ${["Seu perfil", "Seu endereço", "Acesso e privacidade"][step]}`}
      />
      <View style={s.row}>
        {[0, 1, 2].map((x) => (
          <View
            key={x}
            style={{
              height: 5,
              flex: 1,
              borderRadius: 4,
              backgroundColor: x <= step ? colors.purple : "#ddd4eb",
            }}
          />
        ))}
      </View>
      {step === 0 ? (
        <>
          <Text style={s.label}>Como quer usar a SorteX?</Text>
          <View style={s.row}>
            {(["BUYER", "ORGANIZER"] as const).map((role) => (
              <Choice
                key={role}
                label={role === "BUYER" ? "Comprador" : "Organizador"}
                selected={form.role === role}
                onPress={() => patch({ role })}
              />
            ))}
          </View>
          {form.role === "ORGANIZER" && (
            <View style={s.row}>
              {(["PF", "PJ"] as const).map((personType) => (
                <Choice
                  key={personType}
                  label={
                    personType === "PF" ? "Pessoa física" : "Pessoa jurídica"
                  }
                  selected={form.personType === personType}
                  onPress={() => patch({ personType })}
                />
              ))}
            </View>
          )}
          {field(
            "name",
            form.personType === "PJ" && form.role === "ORGANIZER"
              ? "Nome do representante legal"
              : "Nome completo",
            { autoCapitalize: "words", autoComplete: "name" },
          )}
          {field(
            "cpf",
            form.personType === "PJ" && form.role === "ORGANIZER"
              ? "CPF do representante"
              : "CPF",
            { keyboardType: "number-pad" },
          )}
          {form.role === "ORGANIZER" && form.personType === "PJ" && (
            <>
              {field("cnpj", "CNPJ", { autoCapitalize: "characters" })}
              {field("organizationName", "Razão social", {
                autoCapitalize: "words",
              })}
              {field("fantasyName", "Nome fantasia (opcional)", {
                autoCapitalize: "words",
              })}
            </>
          )}
          {field("phone", "Telefone com DDD", {
            keyboardType: "phone-pad",
            autoComplete: "tel",
          })}
        </>
      ) : step === 1 ? (
        <>
          {field("postalCode", "CEP", {
            keyboardType: "number-pad",
            autoComplete: "postal-code",
          })}
          <LocationPicker uf={form.state} city={form.city} onChange={patch} />
          {field("neighborhood", "Bairro", { autoCapitalize: "words" })}
          {field("address", "Logradouro", {
            autoCapitalize: "words",
            autoComplete: "street-address",
          })}
          {field("addressNumber", "Número")}
          {field("addressComplement", "Complemento (opcional)")}
        </>
      ) : (
        <>
          {field("email", "E-mail", {
            keyboardType: "email-address",
            autoComplete: "email",
          })}
          {field("password", "Senha (mínimo de 8 caracteres)", {
            secureTextEntry: true,
            textContentType: "newPassword",
          })}
          {field("passwordConfirmation", "Confirmar senha", {
            secureTextEntry: true,
          })}
          {(
            [
              "termsAccepted",
              "privacyAccepted",
              "dataProcessingAccepted",
            ] as const
          ).map((key, i) => (
            <View key={key} style={[s.row, { alignItems: "center" }]}>
              <Switch
                accessibilityLabel={
                  [
                    "Aceitar termos de uso",
                    "Aceitar política de privacidade",
                    "Consentir tratamento necessário",
                  ][i]
                }
                value={form[key]}
                onValueChange={(v) => patch({ [key]: v })}
              />
              <Text style={[s.text, { flex: 1 }]}>
                {
                  [
                    "Li e aceito os termos de uso",
                    "Li e aceito a política de privacidade",
                    "Autorizo o tratamento necessário ao cadastro",
                  ][i]
                }
              </Text>
            </View>
          ))}
          <Button
            secondary
            title="Ler termos de uso"
            onPress={() =>
              void Linking.openURL(
                "https://sortex-fase1-review.netlify.app/termos",
              )
            }
          />
          <Button
            secondary
            title="Ler política de privacidade"
            onPress={() =>
              void Linking.openURL(
                "https://sortex-fase1-review.netlify.app/privacidade",
              )
            }
          />
          <Notice message="Use somente dados sintéticos. Nenhum pagamento ou mensagem será enviado." />
        </>
      )}
      {!!error && <Notice error message={error} />}
      <Button
        title={step === 2 ? "Concluir cadastro" : "Continuar"}
        busy={busy}
        onPress={() => void next()}
      />
      {step > 0 && (
        <Button
          secondary
          disabled={busy}
          title="Voltar à etapa anterior"
          onPress={() => setStep(step - 1)}
        />
      )}
    </Page>
  );
}
function CampaignCard({
  item,
  navigation,
}: {
  item: Campaign;
  navigation: any;
}) {
  return (
    <View style={s.card}>
      <Text style={s.title}>{item.title}</Text>
      <Notice message={status(item.status)} />
      <Text style={s.text}>
        {item.shortDescription ||
          item.mainPrizeName ||
          "Confira as informações da campanha."}
      </Text>
      {item.numberPrice !== undefined && (
        <Text style={s.text}>{money(item.numberPrice)} por título</Text>
      )}
      <Button
        secondary
        title="Ver campanha"
        onPress={() => navigation.navigate("Campaign", { item })}
      />
    </View>
  );
}
function Home({ navigation }: any) {
  const auth = useSyncExternalStore(client.subscribe, client.snapshot);
  const greeting = `Olá, ${auth.user?.name.split(" ")[0] || ""}`;
  return auth.user?.role === "ORGANIZER" ? (
    <OrganizerDashboardHome
      greeting={greeting}
      onCampaigns={() => navigation.navigate("Campaigns")}
      onFinance={() => navigation.navigate("OrganizerFinance")}
      onCampaign={(item) => navigation.navigate("Campaign", { item })}
    />
  ) : (
    <BuyerHome greeting={greeting} navigation={navigation} />
  );
}

function BuyerHome({ greeting, navigation }: { greeting: string; navigation: any }) {
  const state = useData<{ featured: Campaign[] }>("/buyer/home");
  return (
    <Page title={greeting}>
      <Notice message="Desenvolvimento · somente dados sintéticos" />
      <Button secondary title="Notificações"
        onPress={() => navigation.navigate("BuyerInbox")} />
      <Button secondary title="Favoritos"
        onPress={() => navigation.navigate("BuyerFavorites")} />
      <Load state={state}>
        {(state.data?.featured || []).map((item) => (
          <CampaignCard key={item.id} item={item} navigation={navigation} />
        ))}
        {!state.data?.featured?.length && <Notice message="Confira a aba Campanhas." />}
      </Load>
      <Button secondary title="Atualizar painel" onPress={state.retry} />
    </Page>
  );
}
function Campaigns({ navigation }: any) {
  const auth = useSyncExternalStore(client.subscribe, client.snapshot),
    organizer = auth.user?.role === "ORGANIZER";
  const [page, setPage] = useState(1);
  const focused = useIsFocused();
  const state = useData<Campaign[] | PageResult<Campaign>>(
    !focused ? null : organizer ? "/campaigns/my" : `/buyer/campaigns?page=${page}&limit=15`,
  );
  const items = Array.isArray(state.data)
    ? state.data
    : state.data?.items || [];
  return (
    <Page title="Campanhas">
      {organizer && <Button title="Criar rascunho" onPress={() => navigation.navigate("OrganizerDraft")} />}
      <Load state={state}>
        {items.map((item) => (
          <CampaignCard key={item.id} item={item} navigation={navigation} />
        ))}
        {!items.length && <Notice message="Nenhuma campanha disponível." />}
        {!Array.isArray(state.data) && state.data && (
          <>
            <Notice message={`Página ${page} de ${state.data.pages || 1}`} />
            {page > 1 && (
              <Button
                secondary
                title="Página anterior"
                onPress={() => setPage(page - 1)}
              />
            )}
            {page < state.data.pages && (
              <Button
                secondary
                title="Próxima página"
                onPress={() => setPage(page + 1)}
              />
            )}
          </>
        )}
      </Load>
    </Page>
  );
}
function CampaignDetail({ route, navigation }: any) {
  const auth = useSyncExternalStore(client.subscribe, client.snapshot),
    organizer = auth.user?.role === "ORGANIZER";
  const item = route.params.item as Campaign;
  const focused = useIsFocused();
  const state = useData<Campaign & OrganizerCampaignState & { publishedAt?: string | null }>(
    !focused ? null : organizer
      ? `/campaigns/${encodeURIComponent(item.id)}`
      : `/public/campaigns/${encodeURIComponent(item.slug)}`,
  );
  const { shortDescription, description } = state.data ?? {};
  const publicDetail = focused && !organizer && state.data?.id === item.id &&
    state.data?.slug === item.slug && state.data?.status === "PUBLISHED" ? state.data : null;
  const cover = publicDetail && publicCampaignCoverSource(
    API_URL, publicDetail, process.env.EXPO_PUBLIC_ALLOW_LOCAL_API === "1",
  );
  return (
    <Page title="Detalhes da campanha">
      <Load state={state}>
        <Text style={s.title}>{state.data?.title}</Text>
        <Notice message={status(state.data?.status || "")} />
        {publicDetail && (
          <NativePublicCampaignCover key={cover?.uri ?? publicDetail.id}
            source={cover} title={publicDetail.title} />
        )}
        {publicDetail && <NativeBuyerFavoriteToggle campaignId={publicDetail.id} />}
        <View style={s.card}>
          <Text style={s.text}>
            {(organizer ? description || shortDescription : shortDescription || description) ||
              "Sem descrição adicional."}
          </Text>
          {!organizer && shortDescription && description && description !== shortDescription && (
            <Text style={s.text}>{description}</Text>
          )}
          <Text style={s.text}>Título: {money(state.data?.numberPrice)}</Text>
          <Text style={s.text}>
            Prêmio: {state.data?.mainPrizeName || "Consulte o regulamento"}
          </Text>
        </View>
        <Text style={s.label}>Regulamento</Text>
        <Text style={s.text}>{state.data?.regulation || "Não informado."}</Text>
        {organizer && isEditableOrganizerCampaign(state.data?.status) && (
          <Button secondary title={state.data?.status === "DRAFT" ? "Editar rascunho" : "Editar campanha"}
            onPress={() => navigation.navigate("OrganizerDraft", { campaignId: item.id })} />
        )}
        {organizer && focused && state.data?.id === item.id &&
          state.data.organizerId === auth.user?.id && state.data.status === "DRAFT" &&
          state.data.publishedAt === null && (
            <Button secondary title="Gerenciar cotas premiadas"
              onPress={() => navigation.navigate("OrganizerDraftPrizes", { campaignId: item.id })} />
          )}
        {organizer && focused && auth.user && state.data?.id === item.id && (
          <NativeOrganizerCampaignLifecycle
            key={`${auth.user.id}:${item.id}`}
            client={client}
            accountId={auth.user.id}
            campaign={state.data}
            onRefresh={state.retry}
          />
        )}
        {organizer ? (
          <Button
            title="Acompanhar pedidos e participantes"
            onPress={() =>
              navigation.navigate("CampaignOrders", { campaignId: item.id })
            }
          />
        ) : (
          reservationTestsEnabled && state.data && state.data.status === "PUBLISHED" ? (
            <NativeBuyerReservation client={client} campaign={state.data}
              onOrder={(order) => navigation.navigate("Order", { item: order, totalNumbers: state.data?.totalNumbers })}
            />
          ) : (
            <Notice message="Campanha disponível para consulta. Pagamento no aplicativo ainda não está homologado." />
          )
        )}
      </Load>
    </Page>
  );
}
function OrganizerDraftScreen({ navigation, route }: any) {
  const auth = useSyncExternalStore(client.subscribe, client.snapshot);
  const revision = useSyncExternalStore(client.subscribe, client.activeSessionRevision);
  if (auth.user?.role !== "ORGANIZER" || revision === null)
    return <Page title="Rascunho"><Notice error message="Somente organizadores com sessão ativa podem editar campanhas." /></Page>;
  const campaignId = typeof route.params?.campaignId === "string" ? route.params.campaignId : undefined;
  return <NativeOrganizerDraft key={`${auth.user.id}:${revision}:${campaignId ?? "new"}`} organizerId={auth.user.id}
    revision={revision} campaignId={campaignId} onSaved={() => navigation.goBack()} />;
}
function OrganizerDraftPrizesScreen({ route }: any) {
  const auth = useSyncExternalStore(client.subscribe, client.snapshot);
  const revision = useSyncExternalStore(client.subscribe, client.activeSessionRevision);
  const campaignId = route.params?.campaignId;
  if (auth.user?.role !== "ORGANIZER" || revision === null || typeof campaignId !== "string")
    return <Page title="Cotas premiadas"><Notice error message="Abra o rascunho com uma sessão de organizador ativa." /></Page>;
  return <NativeOrganizerDraftPrizes key={`${auth.user.id}:${revision}:${campaignId}`}
    accountId={auth.user.id} revision={revision} campaignId={campaignId} />;
}
function OrganizerFinanceScreen() {
  useSyncExternalStore(client.subscribe, client.snapshot);
  useSyncExternalStore(client.subscribe, client.activeSessionRevision);
  const session = organizerFinanceSession(client);
  if (!session)
    return (
      <Page title="Financeiro">
        <Notice error message="Somente organizadores com sessão ativa podem consultar o financeiro." />
      </Page>
    );
  return (
    <NativeOrganizerFinance
      key={`${session.organizerId}:${session.revision}`}
      client={client}
      session={session}
    />
  );
}
function Orders({ navigation, route }: any) {
  const auth = useSyncExternalStore(client.subscribe, client.snapshot);
  const revision = useSyncExternalStore(client.subscribe, client.activeSessionRevision);
  const focused = useIsFocused();
  if (auth.status !== "signedIn" || !auth.user || revision === null) {
    return <Page title="Pedidos"><Notice error message="Entre para consultar seus pedidos." /></Page>;
  }
  if (auth.user.role === "ORGANIZER") {
    return <OrganizerOrders
      key={`${auth.user.id}:${revision}`}
      navigation={navigation}
      route={route}
    />;
  }
  const session = buyerHistorySession(client);
  return session && focused ? (
    <NativeBuyerOrderHistory
      key={`${session.buyerId}:${session.revision}`}
      client={client}
      session={session}
      onOrder={(id) => navigation.navigate("Order", { item: { id } })}
    />
  ) : null;
}
function OrganizerOrders({ navigation, route }: any) {
  const [page, setPage] = useState(1);
  const campaignId = route?.params?.campaignId;
  const state = useData<PageResult<Purchase>>(
    `/organizer/orders?page=${page}&limit=20${campaignId ? `&campaignId=${encodeURIComponent(campaignId)}` : ""}`,
  );
  const items = state.data?.items || [];
  return (
    <Page title={campaignId ? "Pedidos e participantes" : "Pedidos"}>
      <Load state={state}>
        {!items.length && <Notice message="Nenhum pedido encontrado." />}
        {items.map((item) => (
          <View key={item.id} style={s.card}>
            <Text style={s.label}>{item.campaign?.title || "Campanha"}</Text>
            <Text style={s.text}>
              {money(item.total)} · {status(item.status)}
            </Text>
            <Notice
              message={`${item.quantity} títulos · ${new Date(item.createdAt).toLocaleDateString("pt-BR")}`}
            />
            <Text style={s.text}>
              Participante: {item.buyer?.name || "Não informado"}
            </Text>
            <Button
              secondary
              title="Ver pedido e títulos"
              onPress={() => navigation.navigate("Order", { item })}
            />
          </View>
        ))}
        {state.data && (
          <>
            <Notice
              message={`${state.data.total} pedidos · página ${page}. Participantes correspondem aos pedidos exibidos.`}
            />
            {page > 1 && (
              <Button
                secondary
                title="Pedidos anteriores"
                onPress={() => setPage(page - 1)}
              />
            )}
            {page < state.data.pages && (
              <Button
                secondary
                title="Mais pedidos"
                onPress={() => setPage(page + 1)}
              />
            )}
          </>
        )}
      </Load>
    </Page>
  );
}
function OrderDetail({ route }: any) {
  const auth = useSyncExternalStore(client.subscribe, client.snapshot),
    organizer = auth.user?.role === "ORGANIZER",
    item = route.params.item as Purchase;
  const nativeBuyer = reservationTestsEnabled && !organizer;
  const state = useData<Purchase>(
    nativeBuyer ? null : organizer ? `/organizer/orders/${item.id}` : `/purchases/${item.id}`,
  );
  const tickets = useData<any>(
    nativeBuyer ? null : !organizer && state.data?.status === "PAID"
      ? `/purchases/${item.id}/tickets`
      : organizer ? `/organizer/orders/${item.id}` : null,
  );
  const list = Array.isArray(tickets.data)
    ? tickets.data
    : tickets.data?.tickets || [];
  if (nativeBuyer) return (
    <Page title="Pedido">
      <NativeBuyerOrder client={client} orderId={item.id}
        totalNumbers={typeof route.params.totalNumbers === "number" ? route.params.totalNumbers : undefined} />
    </Page>
  );
  return (
    <Page title="Pedido">
      <Load state={state}>
        <Text style={s.title}>{state.data?.campaign?.title}</Text>
        <Text style={s.text}>
          {money(state.data?.total)} · {status(state.data?.status || "")}
        </Text>
        {organizer && (
          <Text style={s.text}>
            Participante: {state.data?.buyer?.name || "Não informado"}
          </Text>
        )}
        <Text style={s.label}>Títulos</Text>
        <Load state={tickets}>
          {list.length ? (
            <Text selectable style={s.text}>
              {list
                .map((x: any) => String(x.number).padStart(6, "0"))
                .join(" · ")}
            </Text>
          ) : (
            <Notice message="Nenhum título confirmado disponível." />
          )}
        </Load>
        <Notice message="Resultados somente após confirmação e publicação. O aplicativo não executa apurações." />
      </Load>
    </Page>
  );
}
function Profile() {
  const auth = useSyncExternalStore(client.subscribe, client.snapshot),
    organizer = auth.user?.role === "ORGANIZER";
  const state = useData<any>(
    organizer ? "/organizers/me/profile" : "/buyer/profile",
  );
  const brand = useData<any>(organizer ? "/organizer/personalization" : null);
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [slogan, setSlogan] = useState(""),
    [location, setLocation] = useState({
      state: "",
      city: "",
      municipalityCode: "",
    }),
    [info, setInfo] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (state.data) {
      setName(
        state.data.name ||
          state.data.fullName ||
          state.data.user?.name ||
          auth.user?.name ||
          "",
      );
      setPhone(
        state.data.phone || state.data.user?.phone || auth.user?.phone || "",
      );
      setLocation({
        state: state.data.state || auth.user?.state || "",
        city: state.data.city || auth.user?.city || "",
        municipalityCode: state.data.municipalityCode || "",
      });
    }
  }, [state.data]);
  useEffect(() => {
    if (organizer && brand.data) setSlogan(brand.data.brand?.slogan || "");
  }, [brand.data]);
  async function save() {
    setBusy(true);
    setInfo("");
    try {
      if (
        !location.municipalityCode &&
        (location.state !== (state.data?.state || auth.user?.state || "") ||
          location.city !== (state.data?.city || auth.user?.city || ""))
      )
        throw Error("Selecione um município correspondente à nova UF.");
      await client.request(
        organizer ? "/organizers/me/account" : "/buyer/profile",
        "PATCH",
        { name, phone, ...(location.municipalityCode ? location : {}) },
      );
      if (organizer)
        await client.request("/organizer/personalization/brand", "PATCH", {
          slogan,
        });
      await client.reloadUser();
      setInfo("Perfil salvo.");
      state.retry();
    } catch (e) {
      setInfo(
        "Não foi possível concluir todas as alterações. Confira os valores salvos e tente novamente. " +
          message(e),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="Perfil e configurações">
      <Load state={state}>
        <Notice message={auth.user?.email || ""} />
        <Field
          label="Nome completo"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <Field
          label="Telefone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <LocationPicker
          uf={location.state}
          city={location.city}
          onChange={setLocation}
        />
        {organizer && (
          <Load state={brand}>
            <Field
              label="Slogan (opcional)"
              maxLength={60}
              value={slogan}
              onChangeText={setSlogan}
            />
          </Load>
        )}
        <View style={s.card}>
          <Text style={s.label}>Endereço cadastrado</Text>
          <Text style={s.text}>
            {[
              state.data?.buyerAddress?.address || state.data?.address,
              state.data?.buyerAddress?.addressNumber ||
                state.data?.addressNumber,
              state.data?.buyerAddress?.neighborhood ||
                state.data?.neighborhood,
              state.data?.buyerAddress?.postalCode || state.data?.postalCode,
            ]
              .filter(Boolean)
              .join(" · ") || "Não informado na conta anterior."}
          </Text>
          {organizer && (
            <Notice
              message={
                "Verificação: " +
                status(state.data?.verificationStatus || "PENDING")
              }
            />
          )}
        </View>
        <Notice message="Documentos anteriores preservados. Edição de endereço completo do comprador exige ampliação do contrato da API." />
        <Button
          title="Salvar perfil"
          busy={busy || (organizer && (brand.loading || !!brand.error))}
          onPress={() => void save()}
        />
        {!!info && <Notice message={info} />}
      </Load>
      <Button
        secondary
        title="Sair da conta"
        onPress={() => {
          client.logout().catch((e) => setInfo(message(e)));
        }}
      />
    </Page>
  );
}
function Results() {
  const auth = useSyncExternalStore(client.subscribe, client.snapshot);
  const buyerId = auth.status === "signedIn" && auth.user?.role === "BUYER"
    ? auth.user.id
    : null;
  return <BuyerResults key={buyerId ?? "signed-out"} buyerId={buyerId} />;
}

function BuyerResults({ buyerId }: { buyerId: string | null }) {
  const focused = useIsFocused();
  const [showPrizes, setShowPrizes] = useState(false);
  return (
    <Page title="Resultados">
      {buyerId ? (
        <>
          <Button secondary title={showPrizes ? "Ocultar meus prêmios" : "Meus prêmios"} onPress={() => setShowPrizes((open) => !open)} />
          {showPrizes && focused && <NativeBuyerPrizes client={client} accountId={buyerId} />}
        </>
      ) : null}
      <NativePublicDrawProof client={client} />
      {buyerId && focused && (
        <NativeBuyerDrawResults client={client} accountId={buyerId} />
      )}
    </Page>
  );
}
function MainTabs() {
  const auth = useSyncExternalStore(client.subscribe, client.snapshot);
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.purple,
        tabBarLabelStyle: { fontSize: 12 },
        tabBarIcon: () => null,
        tabBarStyle: { minHeight: 60 },
      }}
    >
      <Tabs.Screen name="Home" component={Home} options={{ title: "Início" }} />
      <Tabs.Screen
        name="Campaigns"
        component={Campaigns}
        options={{ title: "Campanhas" }}
      />
      <Tabs.Screen
        name="Orders"
        component={Orders}
        options={{ title: "Pedidos" }}
      />
      {auth.user?.role === "BUYER" && (
        <Tabs.Screen
          name="Results"
          component={Results}
          options={{ title: "Resultados" }}
        />
      )}
      <Tabs.Screen
        name="Profile"
        component={Profile}
        options={{ title: "Perfil" }}
      />
    </Tabs.Navigator>
  );
}
export default function App() {
  const auth = useSyncExternalStore(client.subscribe, client.snapshot);
  useEffect(() => {
    void client.restore().catch(() => {});
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {auth.status === "restoring" ? (
        <Page title="SorteX" standalone>
          <ActivityIndicator color={colors.purple} />
          <Notice message="Restaurando sua sessão com segurança…" />
        </Page>
      ) : auth.status === "offline" || auth.status === "storageError" ? (
        <Page title="Vamos reconectar" standalone>
          <Notice error message={auth.message || "Sem conexão."} />
          <Button
            title="Tentar novamente"
            onPress={() =>
              void (
                auth.status === "storageError"
                  ? client.logout()
                  : client.restore()
              ).catch(() => {})
            }
          />
          <Button
            secondary
            title="Remover sessão deste aparelho"
            onPress={() => void client.logout().catch(() => {})}
          />
        </Page>
      ) : (
        <NavigationContainer
          linking={{
            prefixes: ["sortex-dev://"],
            getStateFromPath: (path) => {
              const token = recoveryTokenFromUrl("sortex-dev://" + path);
              return token && auth.status === "signedOut"
                ? {
                    routes: [
                      { name: "Login" },
                      { name: "Reset", params: { token } },
                    ],
                  }
                : undefined;
            },
            config: { screens: { Reset: "reset-password" } },
          }}
        >
          <Stack.Navigator
            screenOptions={{
              headerTintColor: colors.purple,
              headerBackButtonDisplayMode: "minimal",
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            {auth.status === "signedIn" ? (
              <>
                <Stack.Screen
                  name="Main"
                  component={MainTabs}
                  options={{ title: "SorteX · Teste" }}
                />
                {auth.user?.role === "BUYER" && (
                  <Stack.Screen name="BuyerInbox" component={BuyerInboxScreen}
                    options={{ title: "Notificações" }} />
                )}
                {auth.user?.role === "BUYER" && (
                  <Stack.Screen name="BuyerFavorites" component={BuyerFavoritesScreen}
                    options={{ title: "Favoritos" }} />
                )}
                <Stack.Screen
                  name="Campaign"
                  component={CampaignDetail}
                  options={{ title: "Campanha" }}
                />
                <Stack.Screen
                  name="OrganizerDraft"
                  component={OrganizerDraftScreen}
                  options={{ title: "Editor de campanha" }}
                />
                {auth.user?.role === "ORGANIZER" && (
                  <Stack.Screen name="OrganizerDraftPrizes" component={OrganizerDraftPrizesScreen}
                    options={{ title: "Cotas premiadas" }} />
                )}
                {auth.user?.role === "ORGANIZER" && (
                  <Stack.Screen
                    name="OrganizerFinance"
                    component={OrganizerFinanceScreen}
                    options={{ title: "Financeiro" }}
                  />
                )}
                <Stack.Screen
                  name="CampaignOrders"
                  component={Orders}
                  options={{ title: "Acompanhamento" }}
                />
                <Stack.Screen
                  name="Order"
                  component={OrderDetail}
                  options={{ title: "Pedido" }}
                />
              </>
            ) : (
              <>
                <Stack.Screen
                  name="Login"
                  component={Login}
                  options={{ title: "Bem-vindo" }}
                />
                <Stack.Screen
                  name="Register"
                  component={Register}
                  options={{ title: "Cadastro" }}
                />
                <Stack.Screen
                  name="Forgot"
                  component={Forgot}
                  options={{ title: "Recuperação" }}
                />
                <Stack.Screen
                  name="Reset"
                  component={Reset}
                  options={{ title: "Nova senha" }}
                />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}
