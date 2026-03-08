import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator
} from "react-native";
import { theme } from "./theme";

export function Card({
  children,
  style
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === "secondary" && styles.buttonSecondary,
        disabled && styles.buttonDisabled
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[styles.buttonText, variant === "secondary" && styles.buttonTextSecondary]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export function ScreenContainer({
  children,
  centered
}: {
  children: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <View style={[styles.screen, centered && styles.centered]}>{children}</View>
  );
}

export function LoadingSpinner() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.loadingText}>Loading…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.space(2),
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.space(2),
    paddingHorizontal: theme.space(3),
    borderRadius: theme.radius.md,
    alignItems: "center"
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16
  },
  buttonTextSecondary: {
    color: theme.colors.text
  },
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    padding: theme.space(2)
  },
  centered: {
    justifyContent: "center",
    alignItems: "center"
  },
  loadingText: {
    marginTop: theme.space(2),
    color: theme.colors.muted
  }
});
