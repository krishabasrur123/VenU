import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius, Shadow, Type } from '@/constants/theme';

/**
 * Figma buttons (radius 10, Alexandria label):
 * - primary: filled blue ("Send Request", "Save and continue")
 * - dark: filled ink ("Sign In", "Create Account")
 * - secondary: white with an ink outline (landing "Create Account")
 * - outline: white with a blue outline ("Chat with volunteer")
 * - neutral: light gray tile ("Cancel")
 * - danger: white with a red outline
 * - link: underlined blue text
 */
export type ButtonVariant = 'primary' | 'dark' | 'secondary' | 'outline' | 'neutral' | 'danger' | 'link';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** md: 44 tall, 15pt label. lg: 52 tall, 20pt label (full-width screen actions). */
  size?: 'md' | 'lg';
  /** Shown before the label, e.g. `<FigmaIcon name="add-circle" size={18} />`. */
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function Button({ label, onPress, variant = 'primary', size = 'md', icon, disabled, loading, style, accessibilityHint }: ButtonProps) {
  const inactive = disabled || loading;
  const filled = variant === 'primary' || variant === 'dark';
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole={variant === 'link' ? 'link' : 'button'}
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' && styles.lg,
        styles[variant],
        pressed && (filled ? Shadow.pressed : styles.pressed),
        pressed && filled && styles.pressedFilled,
        inactive && styles.inactive,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={filled ? Colors.onPrimary : Colors.primary} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[size === 'lg' ? Type.buttonLarge : Type.button, labelStyles[variant]]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderWidth: 2, borderColor: 'transparent' },
  lg: { minHeight: 52 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dark: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  secondary: { backgroundColor: Colors.surface, borderColor: Colors.ink },
  outline: { backgroundColor: Colors.surface, borderColor: Colors.primary },
  neutral: { backgroundColor: Colors.surfaceAlt, borderColor: Colors.controlBorder, borderWidth: 1 },
  danger: { backgroundColor: Colors.surface, borderColor: Colors.danger },
  link: { minHeight: 36, paddingHorizontal: 0, borderWidth: 0 },
  pressed: { opacity: 0.75 },
  pressedFilled: { opacity: 0.92 },
  inactive: { opacity: 0.5 },
});

const labelStyles = StyleSheet.create({
  primary: { color: Colors.onPrimary },
  dark: { color: Colors.onPrimary },
  secondary: { color: Colors.ink },
  outline: { color: Colors.primary },
  neutral: { color: Colors.ink },
  danger: { color: Colors.danger },
  link: { color: Colors.primary, textDecorationLine: 'underline', fontSize: 14 },
});
