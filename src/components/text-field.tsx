/**
 * Labelled input from the Figma "msft_TextInput" component: white, 2px gray outline, radius 10.
 * `secure` adds the eye toggle; `multiline` is the 80-tall "Describe…" box.
 */
import { useState, type ComponentRef, type Ref } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { FigmaIcon } from '@/components/icons/figma-icon';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { useLayoutRtl, useT } from '@/i18n';

interface TextFieldProps extends Omit<TextInputProps, 'style' | 'secureTextEntry'> {
  label?: string;
  /** Password field with a show/hide toggle. */
  secure?: boolean;
  /** Shown under the field in red; also marks the field invalid for screen readers. */
  error?: string | null;
  /** Small gray note under the field when there's no error. */
  hint?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

export function TextField({ label, secure, error, hint, multiline, onFocus, onBlur, ref, ...input }: TextFieldProps) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  const t = useT('common');
  const rtl = useLayoutRtl();
  // Web inputs default to dir="auto", which reads an empty field as left-to-right, so in Arabic the
  // placeholder sat on the left. Empty: follow the layout. Typed: auto again, so an email stays LTR.
  // (Native inputs already follow the layout direction.)
  const webDir = Platform.OS === 'web' && !input.value ? { dir: rtl ? 'rtl' : 'ltr' } : null;
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.box, multiline && styles.multiline, focused && styles.focused, !!error && styles.invalid]}>
        <TextInput
          ref={ref}
          {...input}
          {...webDir}
          multiline={multiline}
          secureTextEntry={secure && hidden}
          placeholderTextColor={Colors.textFaint}
          accessibilityLabel={input.accessibilityLabel ?? label}
          aria-invalid={!!error}
          onFocus={e => { setFocused(true); onFocus?.(e); }}
          onBlur={e => { setFocused(false); onBlur?.(e); }}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden(h => !h)}
            hitSlop={8}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={hidden ? t('field.showPassword') : t('field.hidePassword')}>
            <FigmaIcon name="eye-off" size={18} color={Colors.ink} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { ...Type.label },
  box: {
    gap: Spacing.sm, // keeps the eye toggle off the text, whichever side it sits (RTL puts it on the left)
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 2,
    borderColor: Colors.controlBorder,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
  },
  multiline: { minHeight: 96, alignItems: 'flex-start', paddingVertical: Spacing.md },
  focused: { borderColor: Colors.primary },
  invalid: { borderColor: Colors.danger },
  input: { ...Type.input, flex: 1, paddingVertical: 12, outlineStyle: 'none' } as object,
  inputMultiline: { paddingVertical: 0, textAlignVertical: 'top', minHeight: 70 },
  eye: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center', marginEnd: -6 },
  error: { ...Type.caption, color: Colors.danger },
  hint: { ...Type.caption },
});
