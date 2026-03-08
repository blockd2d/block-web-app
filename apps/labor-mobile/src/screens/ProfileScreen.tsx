import React from "react";
import { View, Text } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { ScreenContainer, Button } from "../components";
import { useAuthStore } from "../state/auth";
import { resetMockState } from "../lib/mock";
import { theme } from "../theme";

export function ProfileScreen() {
  const { user, logout, authMode, exitMockView } = useAuthStore();
  const queryClient = useQueryClient();

  const handleExitMockView = () => {
    exitMockView();
  };

  const handleResetMockData = () => {
    resetMockState();
    queryClient.invalidateQueries();
  };

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 20, fontWeight: "800", color: theme.colors.text }}>
        Profile & Settings
      </Text>
      {user?.name ? (
        <Text style={{ marginTop: 8, color: theme.colors.text }}>{user.name}</Text>
      ) : null}
      {user?.email ? (
        <Text style={{ marginTop: 4, color: theme.colors.muted }}>{user.email}</Text>
      ) : null}
      <View style={{ marginTop: 24 }}>
        {authMode === "mock" ? (
          <>
            <Button title="Exit Mock View" onPress={handleExitMockView} variant="secondary" />
            <View style={{ marginTop: 12 }}>
              <Button title="Reset Mock Data" onPress={handleResetMockData} variant="secondary" />
            </View>
          </>
        ) : (
          <Button title="Sign out" onPress={() => logout()} variant="secondary" />
        )}
      </View>
    </ScreenContainer>
  );
}
