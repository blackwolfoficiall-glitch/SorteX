/** SorteX Premium: platform-neutral, no runtime dependencies. */
const common = {
  purple: "#7734F5",
  blue: "#285BEA",
  white: "#FFFFFF",
  deep: "#191238",
} as const;

export const premiumPalettes = {
  light: {
    ...common,
    dark: false,
    bg: "#F3F0FF",
    surface: "#FFFFFF",
    text: "#191238",
    muted: "#5B5373",
    line: "#DDD5F1",
    accent: "#5E26C5",
    tint: "#E9DEFF",
    selected: "#191238",
    error: "#9E183B",
    success: "#0D5B45",
  },
  dark: {
    ...common,
    dark: true,
    bg: "#14102A",
    surface: "#231B40",
    text: "#FCFAFF",
    muted: "#C9BEDF",
    line: "#403358",
    accent: "#C9AAFF",
    tint: "#332450",
    selected: "#4A3472",
    error: "#FFB5C7",
    success: "#A0E7CC",
  },
} as const;

export const premiumTextTokens = {
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.9 },
  section: { fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: "700" },
} as const;

export const premiumShadowTokens = {
  shadowColor: "#4C2E91",
  shadowOpacity: 0.13,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 7 },
  elevation: 4,
} as const;

export const premiumGradientStops = {
  from: "#7130F2",
  to: "#234ED2",
} as const;

export const premiumShapeTokens = {
  panelRadius: 20,
  buttonRadius: 16,
  actionHeight: 48,
} as const;
