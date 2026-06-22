import { StyleSheet, Text, TextInput, View } from "react-native";
import type { KeyboardTypeOptions, TextInputProps } from "react-native";

import { theme } from "@/constants/theme";

type AppTextInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  errorText?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  accessibilityLabel?: string;
} & Pick<TextInputProps, "autoCapitalize" | "autoComplete" | "textContentType">;

export const AppTextInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  errorText,
  multiline = false,
  keyboardType = "default",
  accessibilityLabel,
  ...textInputProps
}: AppTextInputProps) => (
  <View style={styles.wrapper}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      accessibilityLabel={accessibilityLabel ?? label}
      keyboardType={keyboardType}
      multiline={multiline}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textSubtle}
      style={[styles.input, multiline && styles.multiline, errorText && styles.inputError]}
      value={value}
      {...textInputProps}
    />
    {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.sm,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.typography.sm,
    fontWeight: "700",
  },
  input: {
    minHeight: 52,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: theme.typography.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.white,
  },
  multiline: {
    minHeight: 112,
    paddingTop: theme.spacing.lg,
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  error: {
    color: theme.colors.error,
    fontSize: theme.typography.sm,
  },
});
