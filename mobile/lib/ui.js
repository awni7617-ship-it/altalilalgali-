/* Shared pieces, so every screen looks like the same shop. */
import { Text, View, Pressable, ActivityIndicator, StyleSheet, TextInput } from 'react-native';
import { C, shadow } from './theme';

/** Arabic reads right-to-left; every label here defaults to that. */
export function T({ style, children, ...rest }) {
  return <Text style={[styles.text, style]} {...rest}>{children}</Text>;
}

export function Button({ title, onPress, kind = 'solid', busy, disabled, style, icon }) {
  const isSolid = kind === 'solid';
  const isGhost = kind === 'ghost';
  const isDanger = kind === 'danger';
  const isWhats = kind === 'whatsapp';
  const off = disabled || busy;

  return (
    <Pressable
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      style={({ pressed }) => [
        styles.btn,
        isSolid && { backgroundColor: C.plum700 },
        isDanger && { backgroundColor: C.bad },
        isWhats && { backgroundColor: C.whatsapp },
        isGhost && { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },
        off && { opacity: 0.5 },
        pressed && !off && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={isGhost ? C.plum700 : '#fff'} />
      ) : (
        <T style={[styles.btnText, isGhost && { color: C.plum700 }]}>
          {icon ? `${icon}  ` : ''}{title}
        </T>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, error, ...rest }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {!!label && <T style={styles.label}>{label}</T>}
      <TextInput
        placeholderTextColor={C.inkMute}
        style={[styles.input, !!error && { borderColor: C.bad }]}
        {...rest}
      />
      {!!error && <T style={styles.error}>{error}</T>}
      {!!hint && !error && <T style={styles.hint}>{hint}</T>}
    </View>
  );
}

export function Card({ style, children }) {
  return <View style={[styles.card, shadow, style]}>{children}</View>;
}

export function Badge({ text, tone = 'plum' }) {
  const tones = {
    plum: [C.plum100, C.plum700],
    ok: [C.okBg, C.ok],
    warn: [C.warnBg, C.warn],
    bad: [C.badBg, C.bad],
    slate: [C.slateBg, C.slate],
    gold: [C.goldBg, C.gold],
  };
  const [bg, fg] = tones[tone] || tones.plum;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <T style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{text}</T>
    </View>
  );
}

export function Loading({ label }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={C.plum700} />
      {!!label && <T style={{ color: C.inkMute, marginTop: 12 }}>{label}</T>}
    </View>
  );
}

export function Empty({ icon = '🛍️', title, note, children }) {
  return (
    <View style={styles.center}>
      <T style={{ fontSize: 44, marginBottom: 8 }}>{icon}</T>
      <T style={{ fontSize: 18, fontWeight: '700', color: C.inkSoft, marginBottom: 4 }}>{title}</T>
      {!!note && <T style={{ color: C.inkMute, textAlign: 'center' }}>{note}</T>}
      {children}
    </View>
  );
}

/** A stand-in tile for a product with no photo yet. */
export function PhotoBlank({ letter, size = 44 }) {
  return (
    <View style={styles.blank}>
      <T style={{ fontSize: size, color: C.plum500, fontWeight: '700' }}>{letter || '💄'}</T>
    </View>
  );
}

export const styles = StyleSheet.create({
  text: { writingDirection: 'rtl', textAlign: 'right', color: C.ink, fontSize: 15 },
  btn: {
    minHeight: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 22, flexDirection: 'row',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: C.inkSoft, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 13, fontSize: 16, backgroundColor: C.surface, color: C.ink,
    textAlign: 'right', writingDirection: 'rtl',
  },
  hint: { fontSize: 12.5, color: C.inkMute, marginTop: 5 },
  error: { fontSize: 13, color: C.bad, marginTop: 5 },
  card: {
    backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  blank: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.plum50,
  },
});
