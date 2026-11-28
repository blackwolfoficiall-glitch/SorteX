"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight, Heart, LifeBuoy, LoaderCircle, LogOut, ShieldCheck, Trophy } from "lucide-react";
import PremiumScope from "@/components/premium/PremiumScope";
import { authRequest } from "@/lib/auth/client";
import { getBuyerProfile, updateBuyerProfile } from "@/lib/buyer/client";
import type { BuyerProfile } from "@/lib/buyer/types";
import "./buyer-profile-premium.css";

const fields = [
  { key: "name", label: "Nome", type: "text", autoComplete: "name" },
  { key: "phone", label: "Telefone", type: "tel", autoComplete: "tel" },
  { key: "city", label: "Cidade", type: "text", autoComplete: "address-level2" },
  { key: "state", label: "Estado (UF)", type: "text", autoComplete: "address-level1" },
] as const;

const shortcuts = [
  ["/comprador/meus-premios", "Meus prêmios", Trophy],
  ["/comprador/resultados", "Resultados", Trophy],
  ["/comprador/favoritos", "Favoritos", Heart],
  ["/comprador/notificacoes", "Notificações", Bell],
  ["/comprador/suporte", "Suporte", LifeBuoy],
  ["/esqueci-senha", "Segurança e senha", ShieldCheck],
] as const;

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; user: BuyerProfile };

type ActionStatus = "idle" | "saving" | "saved" | "save-error" | "logging-out" | "logout-error";

function hasDisplayProfile(profile: BuyerProfile | null | undefined): profile is BuyerProfile {
  return !!profile && typeof profile.name === "string" && typeof profile.email === "string";
}

export default function Perfil() {
  const router = useRouter();
  const [profile, setProfile] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [action, setAction] = useState<ActionStatus>("idle");
  const busy = action === "saving" || action === "logging-out";
  const user = profile.kind === "ready" ? profile.user : null;

  useEffect(() => {
    let active = true;
    getBuyerProfile().then((current) => {
      if (!active) return;
      if (!hasDisplayProfile(current)) {
        setProfile({ kind: "error" });
        return;
      }
      setProfile({ kind: "ready", user: current });
    }).catch(() => {
      if (active) setProfile({ kind: "error" });
    });
    return () => { active = false; };
  }, [attempt]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!user || busy) return;
    setAction("saving");
    try {
      const updated = await updateBuyerProfile({
        name: user.name, phone: user.phone, city: user.city, state: user.state,
      });
      if (!hasDisplayProfile(updated)) {
        setAction("save-error");
        return;
      }
      setProfile({ kind: "ready", user: updated });
      setAction("saved");
    } catch {
      setAction("save-error");
    }
  }

  async function logout() {
    if (busy) return;
    setAction("logging-out");
    try {
      await authRequest("/api/auth/logout", { method: "POST" });
      router.replace("/login");
    } catch {
      setAction("logout-error");
    }
  }

  return (
    <PremiumScope className="sx-buyer-profile">
      <header className="sx-premium-ticket sx-buyer-profile-hero">
        <div className="sx-buyer-profile-avatar" aria-hidden="true">
          {user?.name.trim() ? Array.from(user.name.trim())[0].toLocaleUpperCase("pt-BR") : <ShieldCheck size={26} />}
        </div>
        <div>
          <p className="sx-buyer-profile-kicker">Minha conta</p>
          <h1 className="sx-premium-title">{user?.name.trim() || "Meu perfil"}</h1>
          {user && <p>{user.email}</p>}
        </div>
      </header>

      {profile.kind === "loading" && (
        <p role="status" className="sx-premium-surface sx-buyer-profile-panel sx-buyer-profile-loading">
          <LoaderCircle className="sx-buyer-profile-spinner" size={20} aria-hidden="true" />
          Consultando seu perfil…
        </p>
      )}
      {profile.kind === "error" && (
        <section className="sx-premium-surface sx-buyer-profile-panel">
          <h2 role="alert" className="sx-premium-section sx-buyer-profile-error">Não foi possível carregar seu perfil.</h2>
          <p className="sx-premium-muted">Nenhum dado foi exibido. Tente consultar novamente.</p>
          <button type="button" className="sx-premium-button sx-buyer-profile-retry" data-variant="primary"
            onClick={() => {
              setProfile({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}>
            Tentar novamente
          </button>
        </section>
      )}
      {user && (
        <>
          <section className="sx-premium-surface sx-buyer-profile-panel" aria-labelledby="sx-buyer-profile-personal">
            <h2 id="sx-buyer-profile-personal" className="sx-premium-section">Dados pessoais</h2>
            <p className="sx-premium-muted">Revise suas informações antes de salvar.</p>
            <form onSubmit={save} aria-busy={action === "saving"} className="sx-buyer-profile-form">
              {fields.map(({ key, label, type, autoComplete }) => (
                <div className="sx-buyer-profile-field" key={key}>
                  <label htmlFor={`sx-buyer-profile-${key}`}>{label}</label>
                  <input id={`sx-buyer-profile-${key}`} name={key} type={type} autoComplete={autoComplete}
                    value={user[key] ?? ""} disabled={busy}
                    onChange={(event) => {
                      setAction("idle");
                      setProfile({ kind: "ready", user: { ...user, [key]: event.target.value } });
                    }} />
                </div>
              ))}
              <div className="sx-buyer-profile-wide sx-buyer-profile-id">
                <span className="sx-premium-muted">CPF: </span>{user.cpf || "Não informado"}
              </div>
              <div className="sx-buyer-profile-wide sx-buyer-profile-save">
                <button type="submit" className="sx-premium-button" data-variant="primary" disabled={busy}>
                  {action === "saving" ? "Salvando…" : "Salvar dados"}
                </button>
                {action === "saved" && <p role="status" className="sx-buyer-profile-success">Dados atualizados.</p>}
                {action === "save-error" && <p role="alert" className="sx-buyer-profile-error">Não foi possível confirmar a atualização. Confira seus dados e tente novamente.</p>}
              </div>
            </form>
          </section>
          <section className="sx-premium-surface sx-buyer-profile-panel" aria-labelledby="sx-buyer-profile-shortcuts">
            <h2 id="sx-buyer-profile-shortcuts" className="sx-premium-section">Acessos da conta</h2>
            <nav aria-labelledby="sx-buyer-profile-shortcuts" className="sx-buyer-profile-link-list">
              {shortcuts.map(([href, label, Icon]) => (
                <Link href={href} key={href} className="sx-buyer-profile-link">
                  <Icon size={19} aria-hidden="true" />
                  <span>{label}</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              ))}
            </nav>
          </section>
          <div className="sx-buyer-profile-signout">
            <button type="button" onClick={() => void logout()} className="sx-premium-button sx-buyer-profile-signout-button" disabled={busy}>
              <LogOut size={18} aria-hidden="true" /> {action === "logging-out" ? "Saindo…" : "Sair da conta"}
            </button>
            {action === "logout-error" && <p role="alert" className="sx-buyer-profile-error">Não foi possível encerrar a sessão. Tente novamente.</p>}
          </div>
        </>
      )}
    </PremiumScope>
  );
}
