import type { CSSProperties, ReactNode } from "react";
import {
  premiumGradientStops,
  premiumPalettes,
  premiumShadowTokens,
  premiumShapeTokens,
  premiumTextTokens,
} from "../../../../packages/design-tokens/src/premium";
import "./premium.css";

type PremiumTheme = "light" | "dark" | "system";
const paletteKeys = [
  "bg", "surface", "text", "muted", "line", "accent", "tint", "selected", "error", "success",
] as const;
const shadowChannels = premiumShadowTokens.shadowColor
  .slice(1)
  .match(/../g)!
  .map((channel) => Number.parseInt(channel, 16))
  .join(", ");
const tokens: CSSProperties & Record<`--sxp-${string}`, string> = {
  "--sxp-purple": premiumPalettes.light.purple,
  "--sxp-blue": premiumPalettes.light.blue,
  "--sxp-white": premiumPalettes.light.white,
  "--sxp-ink": premiumPalettes.light.deep,
  "--sxp-gradient": `linear-gradient(139deg, ${premiumGradientStops.from}, ${premiumGradientStops.to})`,
  "--sxp-shadow":
    `${premiumShadowTokens.shadowOffset.width}px ${premiumShadowTokens.shadowOffset.height}px ${premiumShadowTokens.shadowRadius}px ` +
    `rgba(${shadowChannels}, ${premiumShadowTokens.shadowOpacity})`,
  "--sxp-panel-radius": `${premiumShapeTokens.panelRadius / 16}rem`,
  "--sxp-button-radius": `${premiumShapeTokens.buttonRadius / 16}rem`,
  "--sxp-action-height": `${premiumShapeTokens.actionHeight / 16}rem`,
  "--sxp-title-size": `${premiumTextTokens.title.fontSize / 16}rem`,
  "--sxp-section-size": `${premiumTextTokens.section.fontSize / 16}rem`,
  "--sxp-body-size": `${premiumTextTokens.body.fontSize / 16}rem`,
  "--sxp-body-line": String(premiumTextTokens.body.lineHeight / premiumTextTokens.body.fontSize),
  "--sxp-label-size": `${premiumTextTokens.label.fontSize / 16}rem`,
  "--sxp-title-tracking": `${premiumTextTokens.title.letterSpacing / 16}rem`,
  "--sxp-section-tracking": `${premiumTextTokens.section.letterSpacing / 16}rem`,
  "--sxp-title-weight": premiumTextTokens.title.fontWeight,
  "--sxp-section-weight": premiumTextTokens.section.fontWeight,
  "--sxp-label-weight": premiumTextTokens.label.fontWeight,
};
for (const mode of ["light", "dark"] as const) {
  for (const key of paletteKeys) {
    tokens[`--sxp-${mode}-${key}`] = premiumPalettes[mode][key];
  }
}

/**
 * Opt-in, server-rendered theme. No session or document-level theme changes.
 * Mount inside the relevant access gate. Descendants inherit theme variables
 * and typography; individual surfaces opt in to the separate primitive styles.
 */
export default function PremiumScope({ children, className, theme = "system" }: {
  children: ReactNode;
  className?: string;
  theme?: PremiumTheme;
}) {
  return (
    <div className={className ? `sx-premium ${className}` : "sx-premium"} data-sx-premium={theme} style={tokens}>
      {children}
    </div>
  );
}
