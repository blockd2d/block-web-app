import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { ScreenContainer, Button } from "../components";
import { useAuthStore } from "../state/auth";
import { theme } from "../theme";

export function SplashScreen() {
  const { status, error } = useAuthStore();

  if (status === "boot_error") {
    return (
      <ScreenContainer centered>
        <View style={{ alignItems: "center", padding: 24 }}>
          <Text style={{ fontWeight: "900", fontSize: 20, color: theme.colors.primary, marginBottom: 8 }}>
            Block Labor
          </Text>
          <Text style={{ color: theme.colors.error, textAlign: "center", marginBottom: 16 }}>
            {error ?? "Something went wrong."}
          </Text>
          <Button title="Continue to sign in" onPress={() => useAuthStore.getState().continueToLogin()} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer centered>
      <View style={{ alignItems: "center" }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            backgroundColor: theme.colors.chipBg,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16
          }}
        >
          <Text style={{ fontWeight: "900", fontSize: 20, color: theme.colors.primary }}>BL</Text>
        </View>
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 8 }} />
        <Text style={{ marginTop: 12, color: theme.colors.muted, fontWeight: "600" }}>
          Loading…
        </Text>
      </View>
    </ScreenContainer>
  );
}
