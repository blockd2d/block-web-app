import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Button, Input } from "../components";
import { theme } from "../theme";
import { useSessionStore } from "../state";
import { config, hasApiConfig } from "../lib/runtimeConfig";

export function LoginScreen() {
  const session = useSessionStore();
  const [email, setEmail] = useState(config.mockMode ? "rep@mock.test" : "");
  const [password, setPassword] = useState(config.mockMode ? "password" : "");

  const showConfigWarning = !config.mockMode && !hasApiConfig();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg, padding: theme.space(2), justifyContent: "center" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ gap: theme.space(2) }}>
        <View style={{ alignItems: "center", gap: theme.space(1) }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: theme.colors.chipBg,
              alignItems: "center",
              justifyContent: "center",
              borderColor: theme.colors.border,
              borderWidth: 1
            }}
          >
            <Text style={{ fontWeight: "900", color: theme.colors.text }}>NS</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: "900", color: theme.colors.text }}>Nova Sales</Text>
          <Text style={{ color: theme.colors.muted, textAlign: "center" }}>Assigned clusters + walking route workflow for sales reps.</Text>
        </View>

        {!!session.authError && (
          <View style={{ backgroundColor: theme.colors.dangerBg, padding: theme.space(1.5), borderRadius: theme.radius.md }}>
            <Text style={{ color: theme.colors.danger, fontWeight: "800" }}>{session.authError}</Text>
          </View>
        )}

        <Input label="Email" value={email} onChangeText={setEmail} placeholder="name@company.com" />
        <Input label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />

        <Button
          title={config.mockMode ? "Log in (Mock)" : "Log in"}
          onPress={() => session.login(email.trim(), password)}
          loading={session.status === "loading"}
          disabled={showConfigWarning}
        />

        <View style={{ alignItems: "center" }}>
          <Text style={{ color: theme.colors.muted, fontWeight: "700" }}>{config.mockMode ? "MOCK MODE ENABLED" : "Using Block API"}</Text>
          {showConfigWarning ? (
            <Text style={{ marginTop: 6, color: theme.colors.warning, fontWeight: "800", textAlign: "center" }}>
              Missing API URL. Set EXPO_PUBLIC_API_URL.
            </Text>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
