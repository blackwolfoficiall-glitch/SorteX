import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

const paths = {
  home: "M3 11.25 12 3l9 8.25V21h-6v-6H9v6H3z",
  ticket: "M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6zm11 1v2m0 2v2m0 2v2",
  copilot: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zm7 11v6m-3-3h6M5 3v4M3 5h4",
  plus: "M12 5v14M5 12h14",
  bell: "M8 18h8m-6 3h4m-8-3H4l2-3v-4a6 6 0 0 1 12 0v4l2 3h-2",
  trophy: "M8 4h8v6a4 4 0 0 1-8 0V4zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 2v5m-4 1h8",
  link: "M10 13.5l4-4M8.5 15l-1 1a3.5 3.5 0 1 1-5-5l4-4a3.5 3.5 0 0 1 5 0m1 10a3.5 3.5 0 0 0 5 0l4-4a3.5 3.5 0 0 0-5-5l-1 1",
  wallet: "M3 7h17a1 1 0 0 1 1 1v11H3V7zm0 0 13-3v3m5 4h-5v4h5m-4.5-2h.1",
} as const;

export type OrganizerIconName = keyof typeof paths | "more";

/** Decorative artwork only; the parent control provides the action's accessible name. */
export function OrganizerIcon({ name, color, size = 21 }: { name: OrganizerIconName; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false} accessibilityElementsHidden>
      {name === "more" ? [5, 12, 19].map((x) => <Circle key={x} cx={x} cy={12} r={1.65} fill={color} />)
        : <Path d={paths[name]} fill="none" stroke={color} strokeWidth={1.85} strokeLinecap="round" strokeLinejoin="round" />}
    </Svg>
  );
}
