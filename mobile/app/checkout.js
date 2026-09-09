import { useEffect, useState } from 'react';
import {
  View, ScrollView, KeyboardAvoidingView, Platform, Pressable, Linking, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api, useAuth } from '../lib/api';
import { useCart, basketTotals } from '../lib/cart';
import { CITIES, useLang } from '../lib/i18n';
import { T, Button, Field, Card, Loading, ltr, styles as ui } from '../lib/ui';
import { C, money } from '../lib/theme';

const cityName = (stored, lang) => {
  const found = CITIES.find((c) => c.ar === stored);
  return found ? found[lang] : String(stored || '');
};

export default function Checkout() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, clear } = useCart();
  const { t, tx, row, lang } = useLang();

  const [shop, setShop] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [pickCity, setPickCity] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState(null);

  useEffect(() => {
    api.get('/api/shop').then(setShop).catch(() => setShop({ products: [], settings: {} }));
  }, []);

  useEffect(() => {
    if (user) {
      setName((v) => v || user.name || '');
      setPhone((v) => v || user.phone || '');
      setCity((v) => v || user.city || '');
      setAddress((v) => v || user.address || '');
    }
  }, [user]);

  if (!shop) return <Loading />;

  const symbol = shop.settings?.currency_symbol || '₪';
  const lines = items
    .map((entry) => {
      const product = (shop.products || []).find((p) => p.id === entry.id);
      return product ? { product, qty: Math.min(entry.qty, Math.max(1, product.stock)) } : null;
    })
    .filter(Boolean);

  const { subtotal, shipping, total } = basketTotals(lines, shop.settings);

  async function placeOrder() {
    setError('');
    if (name.trim().length < 2) return setError(t('err_name'));
    if (phone.replace(/\D/g, '').length < 8) return setError(t('err_phone'));
    if (!city) return setError(t('err_city'));
    if (address.trim().length < 4) return setError(t('err_address'));

    setBusy(true);
    try {
      const { order } = await api.post('/api/orders', {
        name: name.trim(),
        phone: phone.trim(),
        city,
        address: address.trim(),
        notes: notes.trim(),
        items: lines.map((l) => ({ id: l.product.id, qty: l.qty })),
      });
      clear();
      setPlaced(order);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function sendToWhatsApp() {
    const wa = String(shop.settings?.whatsapp || '').replace(/\D/g, '');
    if (!wa || !placed) return;
    const body = [
      `${t('wa_new_order')} #${placed.order_no}`,
      `${placed.customer_name} — ${placed.phone}`,
      `${placed.city} — ${placed.address}`,
      '',
      ...placed.items.map((i) => `• ${i.name} × ${i.qty} — ${money(i.price * i.qty, symbol)}`),
      '',
      `${t('delivery')}: ${placed.shipping === 0 ? t('free') : money(placed.shipping, symbol)}`,
      `${t('total')}: ${money(placed.total, symbol)}`,
    ].join('\n');
    Linking.openURL(`https://wa.me/${wa}?text=${encodeURIComponent(body)}`).catch(() => {});
  }

  if (placed) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 26 }}>
        <T style={{ fontSize: 54 }}>🎉</T>
        <T style={{ fontSize: 22, fontWeight: '700', marginTop: 10 }}>{t('order_received')}</T>
        <T style={{ color: C.inkSoft, textAlign: 'center', marginTop: 8 }}>
          {t('order_thanks')}
        </T>

        <Card style={{ marginTop: 22, alignItems: 'center', alignSelf: 'stretch' }}>
          <T style={{ color: C.inkMute }}>{t('order_no')}</T>
          <T style={{ fontSize: 22, fontWeight: '700', color: C.plum700, marginTop: 4 }}>
            #{placed.order_no}
          </T>
          <T style={{ fontSize: 17, fontWeight: '700', marginTop: 12 }}>
            {money(placed.total, symbol)}
          </T>
        </Card>

        <Button
          title={t('send_whatsapp')}
          kind="whatsapp"
          icon="💬"
          onPress={sendToWhatsApp}
          style={{ alignSelf: 'stretch', marginTop: 20 }}
        />
        <Button
          title={t('continue_shopping')}
          kind="ghost"
          onPress={() => router.replace('/')}
          style={{ alignSelf: 'stretch', marginTop: 10 }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Field label={t('full_name')} value={name} onChangeText={setName} maxLength={80} autoComplete="name" />
        <Field
          label={t('phone')}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="0599 000 000"
          autoComplete="tel"
          style={ltr}
        />

        <T style={ui.label}>{t('city')}</T>
        <Pressable onPress={() => setPickCity(true)} style={[ui.input, { marginBottom: 14 }]}>
          <T style={{ color: city ? C.ink : C.inkMute }}>
            {city ? cityName(city, lang) : t('choose_city')}
          </T>
        </Pressable>

        <Field
          label={t('address')}
          value={address}
          onChangeText={setAddress}
          maxLength={200}
          placeholder={t('address_ph')}
        />
        <Field
          label={t('notes')}
          value={notes}
          onChangeText={setNotes}
          maxLength={300}
          multiline
          style={{ minHeight: 84, textAlignVertical: 'top' }}
        />

        <Card style={{ gap: 7, marginTop: 4 }}>
          {lines.map((l) => (
            <View key={l.product.id} style={{ flexDirection: row, justifyContent: 'space-between' }}>
              <T style={{ flex: 1, color: C.inkSoft }} numberOfLines={1}>
                {tx(l.product, 'name')} × {l.qty}
              </T>
              <T style={{ fontWeight: '600' }}>{money(l.product.price * l.qty, symbol)}</T>
            </View>
          ))}
          <View style={{ flexDirection: row, justifyContent: 'space-between' }}>
            <T style={{ color: C.inkSoft }}>{t('delivery')}</T>
            <T style={{ fontWeight: '600' }}>{shipping === 0 ? t('free') : money(shipping, symbol)}</T>
          </View>
          <View style={{ height: 1, backgroundColor: C.line, marginVertical: 4 }} />
          <View style={{ flexDirection: row, justifyContent: 'space-between' }}>
            <T style={{ fontWeight: '700', fontSize: 18 }}>{t('total')}</T>
            <T style={{ fontWeight: '700', fontSize: 18 }}>{money(total, symbol)}</T>
          </View>
        </Card>

        <T style={{ color: C.inkMute, fontSize: 12.5, marginTop: 12 }}>
          {t('cod_note')}
        </T>

        {!!error && <T style={{ color: C.bad, marginTop: 12 }}>{error}</T>}

        <Button title={t('place_order')} icon="✓" onPress={placeOrder} busy={busy} style={{ marginTop: 18 }} />
      </ScrollView>

      <Modal visible={pickCity} animationType="slide" onRequestClose={() => setPickCity(false)}>
        <View style={{ flex: 1, backgroundColor: C.canvas, paddingTop: 60 }}>
          <T style={{ fontSize: 20, fontWeight: '700', padding: 18 }}>{t('choose_city')}</T>
          <ScrollView>
            {CITIES.map((c) => (
              <Pressable
                key={c.ar}
                /* The Arabic name is what gets stored, in either
                   language, so one order does not name its city
                   differently from the next. */
                onPress={() => { setCity(c.ar); setPickCity(false); }}
                style={{
                  padding: 17, backgroundColor: C.surface,
                  borderBottomWidth: 1, borderBottomColor: C.lineSoft,
                }}
              >
                <T style={{ fontSize: 16, color: c.ar === city ? C.plum700 : C.ink }}>{c[lang]}</T>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ padding: 16, paddingBottom: 30 }}>
            <Button title={t('cancel')} kind="ghost" onPress={() => setPickCity(false)} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
