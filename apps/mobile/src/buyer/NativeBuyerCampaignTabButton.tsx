import React from "react";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Pressable } from "react-native";

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
}: BottomTabBarButtonProps) {
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      accessibilityLargeContentTitle={accessibilityLargeContentTitle}
      accessibilityShowsLargeContentViewer={accessibilityShowsLargeContentViewer}
      disabled={disabled}
      style={[{ cursor: "pointer" }, style]}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {children}
    </Pressable>
  );
}
