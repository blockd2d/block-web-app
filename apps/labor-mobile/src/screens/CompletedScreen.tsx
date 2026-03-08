import React from "react";
import { View, Text, ScrollView } from "react-native";
import { ScreenContainer } from "../components";
import { theme } from "../theme";

export function CompletedScreen() {
  return (
    <ScreenContainer>
      <Text style={{ fontSize: 20, fontWeight: "800", color: theme.colors.text }}>
        Completed
      </Text>
      <Text style={{ marginTop: 8, color: theme.colors.muted }}>
        Recently completed jobs will appear here.
      </Text>
      <ScrollView style={{ flex: 1, marginTop: 16 }} />
    </ScreenContainer>
  );
}
