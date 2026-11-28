import React from "react";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Pressable } from "react-native";

export function canObserveNativeBuyerTabPress(api: string, allowLocal: boolean, optIn: boolean) {
  return optIn && allowLocal && api === "http://127.0.0.1:3338";
}

/**
 * The iOS campaign tab uses the same direct Pressable responder as other
 * primary actions. Navigation still owns the handler, events and route state.
 */
export function NativeBuyerCampaignTabButton({
  children,
  style,
  testID,
  onPress,
  onLongPress,
  disabled,
  "aria-label": label,
  "aria-selected": selected,
  accessibilityLargeContentTitle,
  accessibilityShowsLargeContentViewer,
  observePress = false,
}: BottomTabBarButtonProps & { observePress?: boolean }) {
  const [pressObserved, setPressObserved] = React.useState(false);
  const press = observePress && onPress
    ? ((event) => {
      // This only acknowledges RN's real onPress, not dispatch or route focus.
      // Preserve the genuine callback even if it fails. Add no navigation path.
      try {
        onPress(event);
      } finally {
        setPressObserved(true);
      }
    }) satisfies NonNullable<BottomTabBarButtonProps["onPress"]> : onPress;
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      accessibilityValue={observePress ? {
        text: pressObserved ? "sortex-xcui-tab-press-observed" : "sortex-xcui-tab-press-idle",
      } : undefined}
      accessibilityLargeContentTitle={accessibilityLargeContentTitle}
      accessibilityShowsLargeContentViewer={accessibilityShowsLargeContentViewer}
      disabled={disabled}
      style={[{ cursor: "pointer" }, style]}
      testID={testID}
      onPress={press}
      onLongPress={onLongPress}
    >
      {children}
    </Pressable>
  );
}
