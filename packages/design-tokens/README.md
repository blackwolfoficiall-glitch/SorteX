# SorteX Premium design tokens

`src/premium.ts` is the common, runtime-independent source for the palette,
title/body scale, gradient stops, card/button sizes and shadow parameters.
The native theme consumes the tokens through React Native StyleSheet; its
original values and system-font behavior are unchanged.

Web routes opt in via `@/components/premium/PremiumScope`, placed **inside**
their existing access gate. Use CSS vars `--sxp-bg`, `--sxp-surface`,
`--sxp-text`, `--sxp-muted`, `--sxp-line`, `--sxp-accent`, `--sxp-tint`,
`--sxp-selected`, `--sxp-purple`, `--sxp-blue`, `--sxp-white`,
`--sxp-ink`, `--sxp-error`, `--sxp-success`, `--sxp-focus`,
`--sxp-gradient`, `--sxp-shadow`, `--sxp-font-heading` and
`--sxp-font-body`. Use the opt-in classes in `premium.css` rather than
overriding legacy utilities globally. The wrapper sets no spacing, height
or route structure. By default it follows the device appearance; explicit
`theme="light"` or `theme="dark"` are also supported. No campaign-specific
custom branding or buyer/admin theme preference is changed by this package.

No new npm dependencies. Next resolves the file via the existing project root;
Metro must keep `packages/design-tokens` in its watch folders.
