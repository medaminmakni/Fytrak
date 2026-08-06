import { forwardRef, useState } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { iconSize, radius, spacing, touchTarget, typography } from "../theme/tokens";

export interface TextFieldProps extends Omit<TextInputProps, "style" | "placeholderTextColor"> {
  label?: string;
  /** Guidance shown under the field. Hidden while an error is showing. */
  helperText?: string;
  /** A validation message. Its presence is what puts the field in the error state. */
  errorText?: string;
  required?: boolean;
  /** Renders a visibility toggle and starts obscured. Use instead of `secureTextEntry`. */
  password?: boolean;
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * The one text field.
 *
 * There were 76 bare `<TextInput>` elements across 26 files, each re-declaring
 * its own well colour, radius, padding and placeholder colour, and most of them
 * had no label and no way to show a validation message. This owns all of that.
 *
 * The error state is driven by `errorText` rather than a separate `hasError`
 * flag, so a field cannot end up looking wrong without saying why.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    helperText,
    errorText,
    required = false,
    password = false,
    leadingIcon,
    containerStyle,
    editable = true,
    ...inputProps
  },
  ref,
) {
  const [isObscured, setIsObscured] = useState(password);
  const hasError = Boolean(errorText);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.requiredMark}> *</Text> : null}
        </Text>
      ) : null}

      <View
        style={[
          styles.well,
          !editable && styles.wellDisabled,
          hasError && styles.wellError,
        ]}
      >
        {leadingIcon ? (
          <Ionicons name={leadingIcon} size={iconSize.md} color={colors.textTertiary} />
        ) : null}

        <TextInput
          ref={ref}
          style={styles.input}
          placeholderTextColor={colors.textTertiary}
          editable={editable}
          secureTextEntry={password && isObscured}
          accessibilityLabel={label}
          accessibilityHint={errorText ?? helperText}
          accessibilityState={{ disabled: !editable }}
          {...inputProps}
        />

        {password ? (
          <Pressable
            onPress={() => setIsObscured((previous) => !previous)}
            accessibilityRole="button"
            accessibilityLabel={isObscured ? "Show password" : "Hide password"}
            hitSlop={12}
          >
            <Ionicons
              name={isObscured ? "eye-outline" : "eye-off-outline"}
              size={iconSize.md}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>

      {/*
        Error replaces helper rather than stacking under it, so the field's
        height does not jump between valid and invalid.
      */}
      {hasError ? (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {errorText}
        </Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
  requiredMark: {
    color: colors.danger,
  },
  well: {
    minHeight: touchTarget.large,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.nested,
    backgroundColor: colors.surfaceInset,
  },
  wellDisabled: {
    backgroundColor: colors.surface,
  },
  /*
   * The error state is the one place this system draws an outline. Colour alone
   * cannot carry it — the message below is the primary signal — but a field
   * that is merely tinted red is easy to miss inside a long form.
   */
  wellError: {
    borderWidth: 1,
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  helperText: {
    ...typography.label,
    color: colors.textTertiary,
  },
  errorText: {
    ...typography.label,
    color: colors.danger,
  },
});
