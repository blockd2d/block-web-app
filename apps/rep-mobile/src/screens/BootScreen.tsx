import React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Banner, Button, Card } from "../components";
import { useSessionStore, useUIStore } from "../state";
import { config, hasApiConfig } from "../lib/runtimeConfig";
import { theme } from "../theme";

function kv(label: string, value: string) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: theme.space(1) }}>
      <Text style={{ color: theme.colors.muted, fontWeight: "800" }}>{label}</Text>
      <Text style={{ color: theme.colors.text, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}

export function BootScreen() {
  const session = useSessionStore();
  const ui = useUIStore();

  const showError = session.status === "boot_error" || !!session.bootError;

  const apiLabel = config.mockMode ? "MOCK" : hasApiConfig() ? "Configured" : "Missing";
  const onlineLabel = ui.isOnline ? "Online" : "Offline";

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: theme.colors.bg,
        padding: theme.space(2),
        justifyContent: "center"
      }}
    >
      <View style={{ alignItems: "center" }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            backgroundColor: theme.colors.chipBg,
            borderWidth: 1,
            borderColor: theme.colors.border,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ fontWeight: "900", color: theme.colors.text }}>NS</Text>
        </View>
        <Text style={{ marginTop: 14, fontSize: 20, fontWeight: "900", color: theme.colors.text }}>Starting…</Text>
        <Text style={{ marginTop: 6, color: theme.colors.muted, textAlign: "center" }}>{session.bootMessage || "Preparing the app."}</Text>

        {!showError ? (
          <View style={{ marginTop: 16 }}>
            <ActivityIndicator />
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: theme.space(3), gap: theme.space(2) }}>
        <Card>
          <View style={{ gap: theme.space(1) }}>
            {kv("Step", session.bootPhase)}
            {kv("Mock mode", config.mockMode ? "ON" : "OFF")}
            {kv("Network", onlineLabel)}
            {kv("API", apiLabel)}
          </View>
        </Card>

        {session.bootLog?.length ? (
          <Card>
            <Text style={{ color: theme.colors.text, fontWeight: "900", marginBottom: theme.space(1) }}>Progress</Text>
            <View style={{ gap: 8 }}>
              {session.bootLog.slice(-8).map((it) => (
                <Text key={`${it.at}`} style={{ color: theme.colors.muted, fontWeight: "700" }}>
                  • {it.message}
                </Text>
              ))}
            </View>
          </Card>
        ) : null}

        {showError ? (
          <View style={{ gap: theme.space(1.5) }}>
            <Banner tone="danger" text={session.bootError ?? "Something went wrong during startup."} />
            <View style={{ gap: theme.space(1) }}>
              <Button title="Retry" onPress={() => session.bootstrap()} />
              <Button title="Continue to Login" variant="secondary" onPress={() => session.continueToLogin(session.bootError ?? "Startup failed.")} />
            </View>
            <Text style={{ color: theme.colors.muted, textAlign: "center", marginTop: theme.space(1) }}>
              If you’re offline, retry after reconnecting.
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
