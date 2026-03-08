import React from "react";
import { View, Text } from "react-native";
import { ScreenContainer, Button } from "../components";
import { useAuthStore } from "../state/auth";
import { theme } from "../theme";

export function ProfileScreen() {
  const { user, logout } = useAuthStore();

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 20, fontWeight: "800", color: theme.colors.text }}>
        Profile & Settings
      </Text>
      {user?.email ? (
        <Text style={{ marginTop: 8, color: theme.colors.muted }}>{user.email}</Text>
      ) : null}
      <View style={{ marginTop: 24 }}>
        <Button title="Sign out" onPress={() => logout()} variant="secondary" />
      </View>
    </ScreenContainer>
  );
}
