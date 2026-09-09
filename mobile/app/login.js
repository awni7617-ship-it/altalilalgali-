import { useState } from 'react';
import {
  View, ScrollView, KeyboardAvoidingView, Platform, Pressable, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/api';
import { useLang } from '../lib/i18n';
import { T, Button, Field, LangToggle, ltr } from '../lib/ui';
import { C } from '../lib/theme';

export default function Login() {
  const router = useRouter();
  const { signIn, register } = useAuth();
  const insets = useSafeAreaInsets();
  const { t, row } = useLang();

  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isLogin = mode === 'login';

  async function submit() {
    setError('');
    const address = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return setError(t('err_email'));
    if (!password) return setError(t('err_password_required'));
    if (!isLogin && password.length < 8) return setError(t('err_password_short'));
    if (!isLogin && password !== repeat) return setError(t('err_password_match'));

    setBusy(true);
    try {
      const user = isLogin
        ? await signIn(address, password)
        : await register({ email: address, password, name: name.trim() });
      router.replace(user.is_admin ? '/owner' : '/');
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.plum900 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1, justifyContent: 'center', padding: 22,
          paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Image
            source={require('../assets/icon.png')}
            style={{ width: 74, height: 74, borderRadius: 20, marginBottom: 14 }}
          />
          <T style={{ fontSize: 25, fontWeight: '700', color: '#fff' }}>{t('app_name')}</T>
          <T style={{ color: '#e6cdd3', marginTop: 6 }}>
            {isLogin ? t('sign_in_sub') : t('register_sub')}
          </T>
        </View>

        <View style={{ backgroundColor: C.surface, borderRadius: 22, padding: 20 }}>
          <View style={[s.tabs, { flexDirection: row }]}>
            {[['login', t('sign_in')], ['register', t('register_tab')]].map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => { setMode(key); setError(''); }}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === key }}
                style={[s.tab, mode === key && s.tabOn]}
              >
                <T style={[s.tabText, mode === key && { color: C.plum800 }]}>{label}</T>
              </Pressable>
            ))}
          </View>

          {!isLogin && (
            <Field
              label={t('full_name')}
              value={name}
              onChangeText={setName}
              autoComplete="name"
              maxLength={80}
            />
          )}

          <Field
            label={t('email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="name@example.com"
            style={ltr}
          />

          <Field
            label={t('password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            style={ltr}
          />

          {!isLogin && (
            <Field
              label={t('confirm_password')}
              value={repeat}
              onChangeText={setRepeat}
              secureTextEntry
              autoComplete="new-password"
              style={ltr}
            />
          )}

          {!!error && <T style={{ color: C.bad, marginBottom: 12 }}>{error}</T>}

          <Button
            title={isLogin ? t('sign_in_cta') : t('create_account')}
            onPress={submit}
            busy={busy}
          />
        </View>

        {/* Before signing in is exactly when someone needs to change the
            language — everything after this point assumes they can read it. */}
        <LangToggle style={{ marginTop: 22 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = {
  tabs: {
    backgroundColor: C.surface2, borderRadius: 999,
    padding: 4, marginBottom: 18,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  tabOn: { backgroundColor: C.surface },
  tabText: { fontWeight: '700', color: C.inkSoft, fontSize: 14.5 },
};
