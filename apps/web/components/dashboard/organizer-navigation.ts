import {
  Bot,
  Boxes,
  ClipboardList,
  Gift,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Palette,
  Plug,
  Settings,
  Share2,
  Ticket,
  Trophy,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

export const organizerPaths = {
  home: "/dashboard",
  campaigns: "/dashboard/campanhas",
  create: "/dashboard/campanhas/nova",
  copilot: "/dashboard/ia",
  profile: "/perfil",
} as const;

// Both presentations render these same 17 links. Deep routes and aliases
// remain wherever their modules already link them.
export const organizerNavigation = [
  {
    id: "operation",
    label: "Operação",
    items: [
      [LayoutDashboard, "Dashboard", organizerPaths.home],
      [Ticket, "Campanhas", organizerPaths.campaigns],
      [Trophy, "Ganhadores", "/dashboard/campanhas/ganhadores"],
      [ClipboardList, "Pedidos", "/dashboard/pedidos"],
      [Boxes, "Mini Campanhas", "/dashboard/mini-campanhas"],
      [Gift, "Promoções", "/dashboard/promocoes"],
      [Trophy, "Cotas premiadas", "/dashboard/ganhadores"],
    ],
  },
  {
    id: "growth",
    label: "Crescimento",
    items: [
      [Users, "CRM Intelligence", "/dashboard/crm"],
      [Bot, "IA SorteX", organizerPaths.copilot],
      [Megaphone, "SorteX Ads", "/dashboard/ads"],
      [Share2, "Afiliados", "/dashboard/afiliados"],
      [MessageCircle, "Comunicação", "/dashboard/comunicacao"],
    ],
  },
  {
    id: "management",
    label: "Gestão",
    items: [
      [Wallet, "Financeiro", "/dashboard/financeiro"],
      [Palette, "Personalização", "/dashboard/personalizacao"],
      [Plug, "Integrações", "/dashboard/integracoes"],
      [Settings, "Configurações", "/dashboard/configuracoes"],
      [UserRound, "Perfil", organizerPaths.profile],
    ],
  },
] as const;

export function organizerActiveRoute(pathname: string) {
  let best = "";
  for (const { items } of organizerNavigation)
    for (const [, , href] of items)
      if (
        href.length > best.length &&
        (pathname === href ||
          (href !== organizerPaths.home && pathname.startsWith(`${href}/`)))
      )
        best = href;
  return best;
}
