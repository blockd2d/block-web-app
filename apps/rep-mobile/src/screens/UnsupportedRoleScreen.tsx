import React from "react";
import { Text, View } from "react-native";
import { Button, Card, ScrollScreen } from "../components";
import { theme } from "../theme";
import { useSessionStore } from "../state";

export function UnsupportedRoleScreen() {
  const session = useSessionStore();
  const role = session.unsupportedRole ?? session.me?.role ?? "unknown";

  return (
    <ScrollScreen contentContainerStyle={{ justifyContent: "center" }}>
      <View style={{ gap: theme.space(2), paddingTop: theme.space(4) }}>
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
          <Text style={{ fontSize: 22, fontWeight: "900", color: theme.colors.text, textAlign: "center" }}>Wrong app for this account</Text>
          <Text style={{ color: theme.colors.muted, textAlign: "center" }}>
            This login has the role “{String(role)}”, which is not supported in Nova Sales.
          </Text>
        </View>

        <Card>
          <View style={{ gap: theme.space(1) }}>
            <Text style={{ color: theme.colors.text, fontWeight: "900" }}>Nova Sales supports:</Text>
            <Text style={{ color: theme.colors.muted, lineHeight: 20 }}>• Rep accounts for normal use</Text>
            <Text style={{ color: theme.colors.muted, lineHeight: 20 }}>• Admin and Manager accounts for testing if enabled</Text>
            <Text style={{ color: theme.colors.muted, lineHeight: 20, marginTop: theme.space(0.5) }}>
              If you meant to use the crew app, sign out here and open the labor app instead.
            </Text>
          </View>
        </Card>

        <Button title="Back to Login" onPress={() => session.continueToLogin("Please sign in with a supported sales account.")} />
      </View>
    </ScrollScreen>
  );
}
