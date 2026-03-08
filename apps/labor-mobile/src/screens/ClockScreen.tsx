import React from "react";
import { View, Text } from "react-native";
import { ScreenContainer, Button } from "../components";
import { useAuthStore } from "../state/auth";
import { useTodayShiftState, useClockIn, useClockOut } from "../hooks/useClock";
import { theme } from "../theme";

export function ClockScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const { data: shift, isLoading } = useTodayShiftState(userId ?? undefined);
  const clockInMutation = useClockIn(userId ?? undefined);
  const clockOutMutation = useClockOut(userId ?? undefined);
  const clockedIn = shift?.clockedIn ?? false;

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 20, fontWeight: "800", color: theme.colors.text }}>
        Clock In / Out
      </Text>
      <Text style={{ marginTop: 8, color: theme.colors.muted }}>
        Start and end your shift.
      </Text>
      {isLoading ? (
        <Text style={{ marginTop: 24, color: theme.colors.muted }}>Loading…</Text>
      ) : (
        <View style={{ marginTop: 24 }}>
          <View
            style={{
              padding: 16,
              backgroundColor: theme.colors.surface,
              borderRadius: 8,
              marginBottom: 16
            }}
          >
            <Text style={{ fontWeight: "700", color: theme.colors.text }}>
              Status: {clockedIn ? "Clocked in" : "Clocked out"}
            </Text>
            {shift?.lastEventAt ? (
              <Text style={{ marginTop: 4, fontSize: 13, color: theme.colors.muted }}>
                Last event: {new Date(shift.lastEventAt).toLocaleString()}
              </Text>
            ) : null}
          </View>
          {!clockedIn ? (
            <Button
              title={clockInMutation.isPending ? "Clocking in…" : "Clock in"}
              onPress={() => clockInMutation.mutate()}
              disabled={clockInMutation.isPending}
            />
          ) : (
            <Button
              title={clockOutMutation.isPending ? "Clocking out…" : "Clock out"}
              onPress={() => clockOutMutation.mutate()}
              disabled={clockOutMutation.isPending}
              variant="secondary"
            />
          )}
        </View>
      )}
    </ScreenContainer>
  );
}
