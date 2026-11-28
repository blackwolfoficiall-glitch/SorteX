import React, { useState } from "react";
import { Image, StyleSheet, Text } from "react-native";
import { colors, s } from "./ui";
import type { publicCampaignCoverSource } from "../domain/public-campaign-cover";

const styles = StyleSheet.create({
  cover: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 16,
    backgroundColor: colors.bg,
  },
});

export function NativePublicCampaignCover({
  source,
  title,
}: {
  source: ReturnType<typeof publicCampaignCoverSource>;
  title: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!source || failed) return <Text style={s.muted}>Imagem de capa indisponível.</Text>;

  return (
    <Image
      source={source}
      accessible
      accessibilityLabel={`Capa da campanha ${title}`}
      resizeMode="cover"
      style={styles.cover}
      onError={() => setFailed(true)}
    />
  );
}
