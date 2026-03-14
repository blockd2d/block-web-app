import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "./theme";

export function Screen(props: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, props.style]}>{props.children}</View>;
}

type ScrollScreenProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: "always" | "never" | "handled";
};

export function ScrollScreen(props: ScrollScreenProps) {
  const insets = useSafeAreaInsets();

  const tabBarHeight = useBottomTabBarHeight();

  // For tab screens, tabBarHeight already accounts for the home indicator; for non-tab screens,
  // use the safe-area inset so the last element is always reachable.
  const bottomPadding = Math.max(tabBarHeight, insets.bottom) + theme.space(2);

  return (
    <ScrollView
      style={[styles.scroll, props.style]}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: bottomPadding },
        props.contentContainerStyle
      ]}
      keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? "handled"}
    >
      {props.children}
    </ScrollView>
  );
}

export function ScreenHeader(props: { title: string; right?: React.ReactNode; subtitle?: string }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.h1}>{props.title}</Text>
        {!!props.subtitle && <Text style={styles.sub}>{props.subtitle}</Text>}
      </View>
      {props.right ? <View style={{ marginLeft: theme.space(1) }}>{props.right}</View> : null}
    </View>
  );
}

export function Card(props: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, props.style]}>{props.children}</View>;
}

export function Button(props: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
}) {
  const variant = props.variant ?? "primary";
  const bg =
    variant === "primary"
      ? theme.colors.primary
      : variant === "danger"
        ? theme.colors.danger
        : theme.colors.chipBg;

  const textColor = variant === "secondary" ? theme.colors.text : theme.colors.primaryText;

  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled || props.loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: props.disabled ? 0.5 : pressed ? 0.9 : 1 }
      ]}
    >
      {props.loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.btnText, { color: textColor }]}>{props.title}</Text>}
    </Pressable>
  );
}

export function Chip(props: { label: string; active?: boolean; onPress?: () => void }) {
  const active = !!props.active;
  return (
    <Pressable
      onPress={props.onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? theme.colors.chipActiveBg : theme.colors.chipBg }
      ]}
    >
      <Text style={{ color: active ? theme.colors.chipActiveText : theme.colors.text, fontWeight: "700" }}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export function Input(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
}) {
  return (
    <View style={{ marginBottom: theme.space(2) }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={theme.colors.muted}
        secureTextEntry={props.secureTextEntry}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={props.multiline}
        numberOfLines={props.numberOfLines}
        style={[
          styles.input,
          props.multiline ? { minHeight: 120, textAlignVertical: "top", paddingTop: 12 } : null
        ]}
      />
    </View>
  );
}

export function SelectField<T extends string>(props: {
  label: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedLabel = props.options.find((o) => o.value === props.value)?.label ?? String(props.value);

  return (
    <View style={{ marginBottom: theme.space(2) }}>
      <Text style={styles.label}>{props.label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.input,
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: pressed ? 0.92 : 1
          }
        ]}
      >
        <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "800" }}>{selectedLabel}</Text>
        <Text style={{ color: theme.colors.muted, fontWeight: "900" }}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", padding: theme.space(2), justifyContent: "center" }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: theme.space(2)
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "900", color: theme.colors.text, marginBottom: theme.space(1) }}>
              {props.label}
            </Text>
            <View style={{ gap: 8 }}>
              {props.options.map((opt) => {
                const active = opt.value === props.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      props.onChange(opt.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      {
                        minHeight: 48,
                        borderRadius: theme.radius.md,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        backgroundColor: active ? theme.colors.chipActiveBg : theme.colors.chipBg,
                        paddingHorizontal: theme.space(1.5),
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.9 : 1
                      }
                    ]}
                  >
                    <Text style={{ fontWeight: "900", color: active ? theme.colors.chipActiveText : theme.colors.text }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function Banner(props: { tone: "info" | "warning" | "success" | "danger"; text: string }) {
  const tone = props.tone;
  const bg =
    tone === "info"
      ? theme.colors.infoBg
      : tone === "warning"
        ? theme.colors.warningBg
        : tone === "success"
          ? theme.colors.successBg
          : theme.colors.dangerBg;

  const fg =
    tone === "info"
      ? theme.colors.info
      : tone === "warning"
        ? theme.colors.warning
        : tone === "success"
          ? theme.colors.success
          : theme.colors.danger;

  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontWeight: "700" }}>{props.text}</Text>
    </View>
  );
}

export function EmptyState(props: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <View style={{ paddingVertical: theme.space(4), gap: theme.space(1) }}>
      <Text style={{ fontSize: 18, fontWeight: "800", color: theme.colors.text }}>{props.title}</Text>
      <Text style={{ color: theme.colors.muted, lineHeight: 20 }}>{props.body}</Text>
      {props.action ? <View style={{ marginTop: theme.space(2) }}>{props.action}</View> : null}
    </View>
  );
}

export function SkeletonRow() {
  return (
    <View style={{ paddingVertical: theme.space(1) }}>
      <View style={{ height: 14, backgroundColor: theme.colors.border, borderRadius: 6, width: "70%" }} />
      <View style={{ height: 10, backgroundColor: theme.colors.border, borderRadius: 6, width: "45%", marginTop: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: theme.space(2),
    paddingTop: theme.space(2),
    backgroundColor: theme.colors.bg
  },
  scroll: {
    flex: 1,
    backgroundColor: theme.colors.bg
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.space(2),
    paddingTop: theme.space(2)
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingBottom: theme.space(1)
  },
  h1: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.text
  },
  sub: {
    marginTop: 4,
    color: theme.colors.muted
  },
  card: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.space(2)
  },
  btn: {
    minHeight: theme.tapMinHeight,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.space(2)
  },
  btnText: {
    fontSize: 16,
    fontWeight: "800"
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: theme.space(1.5),
    paddingVertical: theme.space(1),
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.muted,
    marginBottom: 6
  },
  input: {
    minHeight: theme.tapMinHeight,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(1.5),
    color: theme.colors.text,
    fontSize: 16
  },
  banner: {
    borderRadius: theme.radius.md,
    padding: theme.space(1.5),
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.space(1.5)
  }
});
