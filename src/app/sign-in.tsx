import { router } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FigmaColors } from '@/constants/theme';

type Mode = 'signin' | 'signup';

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  function handleContinue() {
    // Skip real auth — go straight into the app
    router.replace('/venue');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">

          {/* Logo / wordmark */}
          <View style={styles.hero}>
            <View style={styles.logoMark}>
              <Text style={styles.logoLetter}>v</Text>
            </View>
            <Text style={styles.wordmark}>venU</Text>
            <Text style={styles.tagline}>Find your next event. Volunteer. Connect.</Text>
          </View>

          {/* Mode toggle */}
          <View style={styles.toggle}>
            <Pressable
              style={[styles.toggleBtn, mode === 'signin' && styles.toggleBtnActive]}
              onPress={() => setMode('signin')}>
              <Text style={[styles.toggleLabel, mode === 'signin' && styles.toggleLabelActive]}>
                Sign In
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, mode === 'signup' && styles.toggleBtnActive]}
              onPress={() => setMode('signup')}>
              <Text style={[styles.toggleLabel, mode === 'signup' && styles.toggleLabelActive]}>
                Sign Up
              </Text>
            </Pressable>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#aaa"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {mode === 'signup' && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#aaa"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                />
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              onPress={handleContinue}>
              <Text style={styles.ctaLabel}>
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
            </Pressable>

            {mode === 'signin' && (
              <Pressable style={styles.forgotBtn}>
                <Text style={styles.forgotLabel}>Forgot password?</Text>
              </Pressable>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 40,
    justifyContent: 'center',
  },

  // Hero
  hero: { alignItems: 'center', marginBottom: 40, gap: 8 },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: FigmaColors.darkGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoLetter: { fontSize: 42, fontWeight: '700', color: '#fff', lineHeight: 50 },
  wordmark: { fontSize: 36, fontWeight: '700', color: FigmaColors.darkGray, letterSpacing: -1 },
  tagline: { fontSize: 14, color: '#888', textAlign: 'center' },

  // Toggle
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 28,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3, elevation: 2 },
  toggleLabel: { fontSize: 15, fontWeight: '500', color: '#888' },
  toggleLabelActive: { color: FigmaColors.darkGray, fontWeight: '600' },

  // Form
  form: { gap: 16 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: FigmaColors.darkGray },
  input: {
    height: 50,
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: FigmaColors.darkGray,
    backgroundColor: '#fafafa',
  },
  cta: {
    height: 52,
    borderRadius: 14,
    backgroundColor: FigmaColors.darkGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaPressed: { opacity: 0.8 },
  ctaLabel: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  forgotBtn: { alignItems: 'center', paddingVertical: 4 },
  forgotLabel: { fontSize: 13, color: '#888' },
});
