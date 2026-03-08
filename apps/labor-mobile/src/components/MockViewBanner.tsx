import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAuthStore } from "../state/auth";
import { theme } from "../theme";

export function MockViewBanner() {
  const authMode = useAuthStore((s) => s.authMode);
  if (authMode !== "mock") return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Demo mode — viewing fake data only</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: theme.colors.chipBg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: theme.space(1.5),
    paddingHorizontal: theme.space(2),
    alignItems: "center"
  },
  text: {
    fontSize: 13,
    color: theme.colors.muted,
    fontWeight: "600"
  }
});
