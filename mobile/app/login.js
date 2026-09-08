import { useState } from 'react';
import {
  View, ScrollView, KeyboardAvoidingView, Platform, Pressable, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/api';
import { T, Button, Field, styles as ui } from '../lib/ui';
import { C } from '../lib/theme';

export default function Login() {
  const router = useRouter();
  const { signIn, register } = useAuth();
  const insets = useSafeAreaInsets();

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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      return setError('الرجاء إدخال بريد إلكتروني صحيح');
    }
    if (!password) return setError('الرجاء إدخال كلمة المرور');
    if (!isLogin && password.length < 8) return setError('كلمة المرور يجب أن تكون ٨ أحرف على الأقل');
    if (!isLogin && password !== repeat) return setError('كلمتا المرور غير متطابقتين');

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
          <T style={{ fontSize: 25, fontWeight: '700', color: '#fff' }}>الطليل الغالي</T>
          <T style={{ color: '#e6cdd3', marginTop: 6 }}>
            {isLogin ? 'سجّلي الدخول للمتابعة' : 'أنشئي حسابك للتسوق'}
          </T>
        </View>

        <View style={{ backgroundColor: C.surface, borderRadius: 22, padding: 20 }}>
          <View style={s.tabs}>
            {[['login', 'تسجيل الدخول'], ['register', 'حساب جديد']].map(([key, label]) => (
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
              label="الاسم الكامل"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              maxLength={80}
            />
          )}

          <Field
            label="البريد الإلكتروني"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="name@example.com"
            style={[ui.input, { textAlign: 'left', writingDirection: 'ltr' }]}
          />

          <Field
            label="كلمة المرور"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            style={[ui.input, { textAlign: 'left', writingDirection: 'ltr' }]}
          />

          {!isLogin && (
            <Field
              label="تأكيد كلمة المرور"
              value={repeat}
              onChangeText={setRepeat}
              secureTextEntry
              autoComplete="new-password"
              style={[ui.input, { textAlign: 'left', writingDirection: 'ltr' }]}
            />
          )}

          {!!error && <T style={{ color: C.bad, marginBottom: 12 }}>{error}</T>}

          <Button
            title={isLogin ? 'دخول' : 'إنشاء الحساب'}
            onPress={submit}
            busy={busy}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = {
  tabs: {
    flexDirection: 'row-reverse', backgroundColor: C.surface2, borderRadius: 999,
    padding: 4, marginBottom: 18,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  tabOn: { backgroundColor: C.surface },
  tabText: { fontWeight: '700', color: C.inkSoft, fontSize: 14.5 },
};
