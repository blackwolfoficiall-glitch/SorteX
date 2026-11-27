"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import {
  Bell,
  Ellipsis,
  House,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import PremiumScope from "@/components/premium/PremiumScope";
import { authRequest } from "@/lib/auth/client";
import { getPersonalization } from "@/lib/organizer-platform/client";
import {
  organizerActiveRoute,
  organizerNavigation,
  organizerPaths,
} from "./organizer-navigation";
import "./organizer-navigation.css";

const desktopWidth = "(min-width: 1024px)";

function useOrganizerOnboarding() {
  const pathname = usePathname();
  return useSearchParams().get("onboarding") === "1" &&
    pathname === "/dashboard/personalizacao";
}

export function OrganizerShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const onboarding = useOrganizerOnboarding();
  const compact = collapsed && !onboarding;
  return (
    <div
      className="sx-organizer-shell min-h-screen bg-zinc-100"
      data-sidebar-size={compact ? "compact" : "full"}
    >
      <PremiumScope className="sxorg-navigation-theme">
        <Sidebar
          collapsed={compact}
          onToggleCollapse={onboarding ? undefined : () => setCollapsed((value) => !value)}
        />
      </PremiumScope>
      <main id="organizer-main" className="sxorg-main">
        {children}
      </main>
    </div>
  );
}

export default function Sidebar({
  collapsed = false,
  onToggleCollapse,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const onboarding = useOrganizerOnboarding();
  const user = useAuthorizedUser();
  const [moreOpen, setMoreOpen] = useState(false);
  const [brand, setBrand] = useState({
    profileImage: false,
    publicName: "",
  });
  const trigger = useRef<HTMLButtonElement>(null);
  const closeControl = useRef<HTMLButtonElement>(null);
  const activeRoute = organizerActiveRoute(pathname);
  const activeTab =
    pathname === organizerPaths.create ? organizerPaths.create : activeRoute;

  useEffect(() => {
    let active = true;
    getPersonalization()
      .then(({ brand }) => {
        if (active)
          setBrand({
            profileImage: Boolean(brand.profileImageUrl),
            publicName: brand.publicName,
          });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!moreOpen || onboarding) return;
    const viewport = window.matchMedia(desktopWidth);
    const savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeControl.current?.focus();
    const onResize = (event: MediaQueryListEvent) => {
      if (event.matches) setMoreOpen(false);
    };
    viewport.addEventListener("change", onResize);
    return () => {
      viewport.removeEventListener("change", onResize);
      document.body.style.overflow = savedOverflow;
    };
  }, [moreOpen, onboarding]);

  function closeMore(restoreFocus = false) {
    setMoreOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }

  function handleMoreKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMore(true);
      return;
    }
    if (event.key !== "Tab") return;
    const controls = event.currentTarget.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled])",
    );
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  async function logout() {
    await authRequest("/api/auth/logout", { method: "POST" }).catch(
      () => undefined,
    );
    router.replace("/login");
  }

  const name = brand.publicName || user?.name || "Organizador";
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const tabPaths: readonly string[] = [
    organizerPaths.home,
    organizerPaths.campaigns,
    organizerPaths.create,
    organizerPaths.copilot,
  ];

  const avatar = brand.profileImage && user ? (
    <Image
      src={`/api/brand-assets/${user.id}/profile`}
      width={40}
      height={40}
      unoptimized
      alt=""
      className="sxorg-avatar"
    />
  ) : (
    <span aria-hidden="true" className="sxorg-avatar">
      {name.trim().charAt(0).toUpperCase() || "O"}
    </span>
  );

  return (
    <>
      <aside
        id="organizer-sidebar"
        aria-label="Painel do organizador"
        className="sxorg-rail"
        data-collapsed={collapsed}
      >
        <div className="sxorg-rail-header">
          <Link
            href={organizerPaths.home}
            aria-label="SorteX"
            className="sxorg-wordmark"
          >
            <span className="sxorg-wordmark-icon" aria-hidden="true">X</span>
            <span className="sxorg-rail-label" aria-hidden="true">Sorte<span>X</span></span>
          </Link>
          {onToggleCollapse && (
            <button
              type="button"
              className="sxorg-icon-button"
              aria-label={collapsed ? "Expandir menu do organizador" : "Recolher menu do organizador"}
              aria-expanded={!collapsed}
              aria-controls="organizer-sidebar-content"
              onClick={onToggleCollapse}
            >
              <CollapseIcon size={19} aria-hidden="true" />
            </button>
          )}
        </div>
        <div id="organizer-sidebar-content">
          <Link
            href={organizerPaths.profile}
            className="sxorg-profile"
            aria-label={`Abrir perfil de ${name}`}
            title={collapsed ? name : undefined}
          >
            {avatar}
            <span className="sxorg-profile-details sxorg-rail-label">
              <span>Organizador</span>
              <strong>{name}</strong>
              {user?.verified && <small>Organizador Verificado</small>}
            </span>
          </Link>
          {onboarding ? (
            <div className="sxorg-setup sxorg-rail-label">
              <SetupNotice onLogout={logout} />
            </div>
          ) : (
            <ModuleLinks activeRoute={activeRoute} compact={collapsed} />
          )}
        </div>
      </aside>
      {!onboarding && (
        <header className="sxorg-mobile-header">
          <Link href={organizerPaths.home} aria-label="SorteX · painel do organizador" className="sxorg-wordmark">
            <span className="sxorg-wordmark-icon" aria-hidden="true">X</span>
            <span aria-hidden="true">Sorte<span>X</span></span>
          </Link>
          <div className="sxorg-mobile-tools">
            <button type="button" disabled aria-label="Notificações do organizador indisponíveis" title="Notificações do organizador indisponíveis" className="sxorg-icon-button sxorg-unavailable-bell">
              <Bell size={20} aria-hidden="true" />
            </button>
            <Link href={organizerPaths.profile} className="sxorg-mobile-profile" aria-label={`Abrir perfil de ${name}`}>
              {avatar}
            </Link>
          </div>
        </header>
      )}
      {onboarding ? (
        <div className="sxorg-mobile-setup">
          <SetupNotice onLogout={logout} />
        </div>
      ) : (
        <nav
          aria-label="Navegação rápida do organizador"
          className="sxorg-mobile-tabs"
        >
          <TabLink href={organizerPaths.home} name="Início" icon={House} active={activeTab === organizerPaths.home} />
          <TabLink href={organizerPaths.campaigns} name="Campanhas" icon={Ticket} active={activeTab === organizerPaths.campaigns} />
          <TabLink href={organizerPaths.create} name="Criar" icon={Plus} active={activeTab === organizerPaths.create} create />
          <TabLink href={organizerPaths.copilot} name="Copilot" icon={Sparkles} active={activeTab === organizerPaths.copilot} />
          <button
            ref={trigger}
            type="button"
            className="sxorg-tab"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-controls={moreOpen ? "organizer-more-menu" : undefined}
            data-current={Boolean(activeRoute) && !tabPaths.includes(activeTab)}
            onClick={() => setMoreOpen(true)}
          >
            <Ellipsis size={20} aria-hidden="true" />
            <span>Mais</span>
          </button>
        </nav>
      )}
      {!onboarding && moreOpen && (
        <div className="sxorg-more-overlay">
          <div aria-hidden="true" className="sxorg-more-scrim" onClick={() => closeMore(true)} />
          <section
            id="organizer-more-menu"
            aria-labelledby="organizer-more-title"
            aria-modal="true"
            role="dialog"
            className="sxorg-more"
            onKeyDown={handleMoreKeys}
          >
            <div className="sxorg-more-heading">
              <h2 id="organizer-more-title">Mais opções do organizador</h2>
              <button
                type="button"
                ref={closeControl}
                className="sxorg-icon-button"
                aria-label="Fechar menu"
                onClick={() => closeMore(true)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <ModuleLinks activeRoute={activeRoute} onNavigate={() => closeMore()} />
          </section>
        </div>
      )}
    </>
  );
}

function SetupNotice({ onLogout }: { onLogout: () => Promise<void> }) {
  return (
    <>
      <p className="sxorg-setup-title">Configuração inicial</p>
      <p>Salve as configurações ou pule por agora para liberar a navegação do painel.</p>
      <button type="button" onClick={() => void onLogout()}>Sair da conta</button>
    </>
  );
}

function ModuleLinks({
  activeRoute,
  compact = false,
  onNavigate,
}: {
  activeRoute: string;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav
      aria-label="Menu do organizador"
      className="sxorg-module-nav"
      data-testid="organizer-module-navigation"
    >
      {organizerNavigation.map(({ id, label, items }) => (
        <div key={id} className="sxorg-module-group">
          <p className="sxorg-group-label" aria-hidden="true">{label}</p>
          <ul aria-label={label}>
            {items.map(([Icon, name, href]) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-label={name}
                  title={compact ? name : undefined}
                  aria-current={activeRoute === href ? "page" : undefined}
                  className="sxorg-module-link"
                >
                  <Icon size={18} aria-hidden="true" />
                  <span className="sxorg-rail-label">{name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function TabLink({
  href,
  name,
  icon: Icon,
  active,
  create = false,
}: {
  href: string;
  name: string;
  icon: typeof House;
  active: boolean;
  create?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={create ? "Criar campanha" : undefined}
      aria-current={active ? "page" : undefined}
      className={`sxorg-tab${create ? " sxorg-tab-create" : ""}`}
    >
      <span className="sxorg-tab-icon">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span>{name}</span>
    </Link>
  );
}
