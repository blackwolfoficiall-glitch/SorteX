import type {
  Session,
  Tokens,
  User,
} from "../../../../packages/contracts/src/mobile";
export interface Vault {
  read(): Promise<Tokens | null>;
  write(tokens: Tokens): Promise<void>;
  clear(): Promise<void>;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export type AuthState = {
  status: "restoring" | "signedOut" | "signedIn" | "offline" | "storageError";
  user: User | null;
  message?: string;
};
export class SortexClient {
  private tokens: Tokens | null = null;
  private state: AuthState = { status: "restoring", user: null };
  private listeners = new Set<() => void>();
  private revision = 0;
  private refreshing: Promise<void> | null = null;
  private writes: Promise<void> = Promise.resolve();
  constructor(
    readonly baseUrl: string,
    private vault: Vault,
    private transport: typeof fetch = (input, init) => fetch(input, init),
  ) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(state: AuthState) {
    this.state = state;
    this.listeners.forEach((f) => f());
  }
  private async raw<T>(
    path: string,
    method = "GET",
    body?: unknown,
    access?: string,
  ): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//") || path.includes(".."))
      throw new ApiError("Rota inválida.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const r = await this.transport(this.baseUrl + path, {
        method,
        credentials: "omit",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(access ? { Authorization: `Bearer ${access}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const text = await r.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new ApiError(
          "O servidor retornou uma resposta inválida. Tente novamente.",
          r.status,
        );
      }
      if (!r.ok) {
        const message = (data as { message?: unknown })?.message;
        throw new ApiError(
          Array.isArray(message)
            ? message.join("\n")
            : typeof message === "string"
              ? message
              : "Não foi possível concluir. Tente novamente.",
          r.status,
        );
      }
      return data as T;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(
        "Sem conexão com a API de teste. Confira a internet e tente novamente.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  publicRequest<T>(path: string, method = "GET", body?: unknown) {
    return this.raw<T>(path, method, body);
  }
  private appUser(user: User) {
    if (!user || !["BUYER", "ORGANIZER"].includes(user.role))
      throw new ApiError(
        "O acesso administrativo permanece no site. Use uma conta de comprador ou organizador.",
        403,
      );
    return user;
  }
  private async persist(tokens: Tokens, revision: number) {
    if (
      typeof tokens.accessToken !== "string" ||
      !tokens.accessToken ||
      typeof tokens.refreshToken !== "string" ||
      !tokens.refreshToken
    )
      throw new ApiError("Resposta de sessão inválida. Entre novamente.");
    this.writes = this.writes
      .catch(() => {})
      .then(async () => {
        if (this.revision === revision) await this.vault.write(tokens);
      });
    try {
      await this.writes;
    } catch {
      throw new ApiError(
        "Não foi possível proteger a sessão neste aparelho. Tente entrar novamente.",
      );
    }
    if (this.revision !== revision)
      throw new ApiError("A sessão foi encerrada.", 401);
    this.tokens = tokens;
  }
  async login(email: string, password: string) {
    const revision = ++this.revision;
    const session = await this.raw<Session>("/auth/login", "POST", {
      email: email.trim(),
      password,
    });
    this.appUser(session.user);
    if (revision !== this.revision) return;
    await this.persist(
      { accessToken: session.accessToken, refreshToken: session.refreshToken },
      revision,
    );
    try {
      const user = this.appUser(
        await this.raw<User>("/auth/me", "GET", undefined, session.accessToken),
      );
      if (revision === this.revision) this.emit({ status: "signedIn", user });
    } catch (e) {
      if (revision === this.revision) {
        if (e instanceof ApiError && [401, 403].includes(e.status))
          await this.clear(e.message);
        else
          this.emit({
            status: "offline",
            user: null,
            message:
              e instanceof Error
                ? e.message
                : "Não foi possível confirmar a sessão.",
          });
      }
      throw e;
    }
  }
  private async renew() {
    if (this.refreshing) return this.refreshing;
    const old = this.tokens,
      revision = this.revision;
    if (!old) throw new ApiError("Entre novamente.", 401);
    const work = (async () => {
      try {
        const tokens = await this.raw<Tokens>("/auth/refresh", "POST", {
          refreshToken: old.refreshToken,
        });
        await this.persist(tokens, revision);
      } catch (e) {
        if (
          e instanceof ApiError &&
          [401, 403].includes(e.status) &&
          revision === this.revision
        )
          await this.clear("Sua sessão expirou. Entre novamente.");
        throw e;
      }
    })();
    this.refreshing = work;
    try {
      await work;
    } finally {
      if (this.refreshing === work) this.refreshing = null;
    }
  }
  async restore() {
    const revision = ++this.revision;
    this.emit({ status: "restoring", user: null });
    try {
      const tokens = await this.vault.read();
      if (revision !== this.revision) return;
      if (!tokens) {
        this.emit({ status: "signedOut", user: null });
        return;
      }
      this.tokens = tokens;
      await this.renew();
      const user = this.appUser(
        await this.raw<User>(
          "/auth/me",
          "GET",
          undefined,
          this.tokens!.accessToken,
        ),
      );
      if (revision === this.revision) this.emit({ status: "signedIn", user });
    } catch (e) {
      if (revision !== this.revision) return;
      const error =
        e instanceof ApiError
          ? e
          : new ApiError("Não foi possível ler a sessão segura.");
      if (error.status === 401 || error.status === 403)
        await this.clear(error.message);
      else this.emit({ status: "offline", user: null, message: error.message });
    }
  }
  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    if (!this.tokens || this.state.status !== "signedIn")
      throw new ApiError("Entre para continuar.", 401);
    try {
      return await this.raw<T>(path, method, body, this.tokens.accessToken);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      await this.renew();
      if (!this.tokens) throw new ApiError("Entre novamente.", 401);
      try {
        return await this.raw<T>(path, method, body, this.tokens.accessToken);
      } catch (retry) {
        if (retry instanceof ApiError && retry.status === 401)
          await this.clear("Sua sessão expirou. Entre novamente.");
        throw retry;
      }
    }
  }
  private async clear(message?: string) {
    ++this.revision;
    this.tokens = null;
    this.writes = this.writes.catch(() => {}).then(() => this.vault.clear());
    try {
      await this.writes;
    } catch {
      this.emit({
        status: "storageError",
        user: null,
        message:
          "Não foi possível remover a sessão do armazenamento seguro. Tente novamente antes de fechar o aplicativo.",
      });
      throw new ApiError("Falha ao remover a sessão segura.");
    }
    this.emit({ status: "signedOut", user: null, message });
  }
  async logout() {
    const access = this.tokens?.accessToken;
    let storageError: unknown;
    try {
      await this.clear();
    } catch (e) {
      storageError = e;
    }
    if (access)
      try {
        await this.raw("/auth/logout", "POST", {}, access);
      } catch {
        if (!storageError)
          this.emit({
            status: "signedOut",
            user: null,
            message:
              "Sessão removida do aparelho. Sem rede, a revogação remota não foi confirmada; você pode encerrar outras sessões ao entrar novamente.",
          });
      }
    if (storageError) throw storageError;
  }
  async reloadUser() {
    const user = this.appUser(await this.request<User>("/auth/me"));
    this.emit({ status: "signedIn", user });
  }
}
