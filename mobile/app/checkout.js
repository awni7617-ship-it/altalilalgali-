import { useEffect, useState } from 'react';
import {
  View, ScrollView, KeyboardAvoidingView, Platform, Pressable, Linking, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api, useAuth } from '../lib/api';
import { useCart, basketTotals } from '../lib/cart';
import { T, Button, Field, Card, Loading, styles as ui } from '../lib/ui';
import { C, money } from '../lib/theme';

const CITIES = [
  'القدس', 'رام الله', 'البيرة', 'نابلس', 'الخليل', 'بيت لحم', 'جنين', 'طولكرم',
  'قلقيلية', 'أريحا', 'سلفيت', 'طوباس', 'غزة', 'خان يونس', 'رفح', 'دير البلح',
  'الناصرة', 'حيفا', 'يافا', 'عكا',
];

export default function Checkout() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, clear } = useCart();

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
    if (name.trim().length < 2) return setError('الرجاء إدخال الاسم الكامل');
    if (phone.replace(/\D/g, '').length < 8) return setError('الرجاء إدخال رقم هاتف صحيح');
    if (!city) return setError('الرجاء اختيار المدينة');
    if (address.trim().length < 4) return setError('الرجاء إدخال العنوان');

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
      `طلب جديد #${placed.order_no}`,
      `${placed.customer_name} — ${placed.phone}`,
      `${placed.city} — ${placed.address}`,
      '',
      ...placed.items.map((i) => `• ${i.name} × ${i.qty} — ${money(i.price * i.qty, symbol)}`),
      '',
      `التوصيل: ${placed.shipping === 0 ? 'مجاني' : money(placed.shipping, symbol)}`,
      `الإجمالي: ${money(placed.total, symbol)}`,
    ].join('\n');
    Linking.openURL(`https://wa.me/${wa}?text=${encodeURIComponent(body)}`).catch(() => {});
  }

  if (placed) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 26 }}>
        <T style={{ fontSize: 54 }}>🎉</T>
        <T style={{ fontSize: 22, fontWeight: '700', marginTop: 10 }}>تم استلام طلبك!</T>
        <T style={{ color: C.inkSoft, textAlign: 'center', marginTop: 8 }}>
          سنتواصل معك قريباً لتأكيد الطلب والتوصيل.
        </T>

        <Card style={{ marginTop: 22, alignItems: 'center', alignSelf: 'stretch' }}>
          <T style={{ color: C.inkMute }}>رقم الطلب</T>
          <T style={{ fontSize: 22, fontWeight: '700', color: C.plum700, marginTop: 4 }}>
            #{placed.order_no}
          </T>
          <T style={{ fontSize: 17, fontWeight: '700', marginTop: 12 }}>
            {money(placed.total, symbol)}
          </T>
        </Card>

        <Button
          title="إرسال الطلب على واتساب"
          kind="whatsapp"
          icon="💬"
          onPress={sendToWhatsApp}
          style={{ alignSelf: 'stretch', marginTop: 20 }}
        />
        <Button
          title="متابعة التسوق"
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
        <Field label="الاسم الكامل" value={name} onChangeText={setName} maxLength={80} autoComplete="name" />
        <Field
          label="رقم الهاتف"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="0599 000 000"
          autoComplete="tel"
          style={[ui.input, { textAlign: 'left', writingDirection: 'ltr' }]}
        />

        <T style={ui.label}>المدينة</T>
        <Pressable onPress={() => setPickCity(true)} style={[ui.input, { marginBottom: 14 }]}>
          <T style={{ color: city ? C.ink : C.inkMute }}>{city || 'اختاري المدينة'}</T>
        </Pressable>

        <Field
          label="العنوان بالتفصيل"
          value={address}
          onChangeText={setAddress}
          maxLength={200}
          placeholder="الحي، الشارع، رقم البناية"
        />
        <Field
          label="ملاحظات (اختياري)"
          value={notes}
          onChangeText={setNotes}
          maxLength={300}
          multiline
          style={[ui.input, { minHeight: 84, textAlignVertical: 'top' }]}
        />

        <Card style={{ gap: 7, marginTop: 4 }}>
          {lines.map((l) => (
            <View key={l.product.id} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
              <T style={{ flex: 1, color: C.inkSoft }} numberOfLines={1}>
                {l.product.name_ar} × {l.qty}
              </T>
              <T style={{ fontWeight: '600' }}>{money(l.product.price * l.qty, symbol)}</T>
            </View>
          ))}
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
            <T style={{ color: C.inkSoft }}>التوصيل</T>
            <T style={{ fontWeight: '600' }}>{shipping === 0 ? 'مجاني' : money(shipping, symbol)}</T>
          </View>
          <View style={{ height: 1, backgroundColor: C.line, marginVertical: 4 }} />
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
            <T style={{ fontWeight: '700', fontSize: 18 }}>الإجمالي</T>
            <T style={{ fontWeight: '700', fontSize: 18 }}>{money(total, symbol)}</T>
          </View>
        </Card>

        <T style={{ color: C.inkMute, fontSize: 12.5, marginTop: 12 }}>
          الدفع عند الاستلام. سنتواصل معك لتأكيد الطلب.
        </T>

        {!!error && <T style={{ color: C.bad, marginTop: 12 }}>{error}</T>}

        <Button title="تأكيد الطلب" icon="✓" onPress={placeOrder} busy={busy} style={{ marginTop: 18 }} />
      </ScrollView>

      <Modal visible={pickCity} animationType="slide" onRequestClose={() => setPickCity(false)}>
        <View style={{ flex: 1, backgroundColor: C.canvas, paddingTop: 60 }}>
          <T style={{ fontSize: 20, fontWeight: '700', padding: 18 }}>اختاري المدينة</T>
          <ScrollView>
            {CITIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => { setCity(c); setPickCity(false); }}
                style={{
                  padding: 17, backgroundColor: C.surface,
                  borderBottomWidth: 1, borderBottomColor: C.lineSoft,
                }}
              >
                <T style={{ fontSize: 16, color: c === city ? C.plum700 : C.ink }}>{c}</T>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ padding: 16, paddingBottom: 30 }}>
            <Button title="إلغاء" kind="ghost" onPress={() => setPickCity(false)} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
