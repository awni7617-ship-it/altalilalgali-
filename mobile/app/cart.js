import { useCallback, useState } from 'react';
import { View, ScrollView, Image, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { api, photoUrl } from '../lib/api';
import { useCart, basketTotals } from '../lib/cart';
import { T, Button, Loading, Empty, PhotoBlank, Card } from '../lib/ui';
import { C, money } from '../lib/theme';

export default function Cart() {
  const router = useRouter();
  const { items, setQty, remove } = useCart();
  const [shop, setShop] = useState(null);

  useFocusEffect(useCallback(() => {
    api.get('/api/shop').then(setShop).catch(() => setShop({ products: [], settings: {} }));
  }, []));

  if (!shop) return <Loading />;

  const symbol = shop.settings?.currency_symbol || '₪';

  /* Match the basket against the live catalogue, so a product that
   * sold out or vanished cannot be ordered. */
  const lines = items
    .map((entry) => {
      const product = (shop.products || []).find((p) => p.id === entry.id);
      return product ? { product, qty: Math.min(entry.qty, Math.max(1, product.stock)) } : null;
    })
    .filter(Boolean);

  if (lines.length === 0) {
    return (
      <Empty icon="🛍️" title="سلتكِ فارغة" note="أضيفي منتجاتكِ المفضلة وابدئي التسوق.">
        <Button title="تصفّحي المتجر" onPress={() => router.replace('/')} style={{ marginTop: 20 }} />
      </Empty>
    );
  }

  const { subtotal, shipping, total, freeOver } = basketTotals(lines, shop.settings);
  const missing = freeOver - subtotal;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30, gap: 12 }}>
        {lines.map(({ product, qty }) => {
          const photo = photoUrl(product.image);
          return (
            <Card key={product.id} style={{ flexDirection: 'row-reverse', gap: 12, padding: 12 }}>
              <View style={s.thumb}>
                {photo
                  ? <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} />
                  : <PhotoBlank letter={(product.name_ar || '').slice(0, 1)} size={24} />}
              </View>

              <View style={{ flex: 1, gap: 4 }}>
                <T numberOfLines={2} style={{ fontWeight: '600' }}>{product.name_ar}</T>
                <T style={{ color: C.inkMute, fontSize: 13 }}>
                  {money(product.price, symbol)} × {qty} = {money(product.price * qty, symbol)}
                </T>

                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginTop: 6 }}>
                  <View style={s.stepper}>
                    <Pressable
                      onPress={() => setQty(product.id, qty - 1)}
                      disabled={qty <= 1}
                      style={s.stepBtn}
                      accessibilityLabel="أقل"
                    >
                      <T style={{ fontSize: 18, color: qty <= 1 ? C.line : C.inkSoft }}>−</T>
                    </Pressable>
                    <T style={{ minWidth: 28, textAlign: 'center', fontWeight: '700' }}>{qty}</T>
                    <Pressable
                      onPress={() => setQty(product.id, qty + 1)}
                      disabled={qty >= product.stock}
                      style={s.stepBtn}
                      accessibilityLabel="أكثر"
                    >
                      <T style={{ fontSize: 18, color: qty >= product.stock ? C.line : C.inkSoft }}>＋</T>
                    </Pressable>
                  </View>

                  <Pressable onPress={() => remove(product.id)} accessibilityRole="button">
                    <T style={{ color: C.inkMute, fontSize: 13 }}>🗑 حذف</T>
                  </Pressable>
                </View>
              </View>
            </Card>
          );
        })}

        {freeOver > 0 && (
          <View style={[s.note, shipping === 0 ? { backgroundColor: C.okBg } : { backgroundColor: C.warnBg }]}>
            <T style={{ color: shipping === 0 ? C.ok : C.warn, fontWeight: '700', textAlign: 'center' }}>
              {shipping === 0
                ? '🚚  التوصيل مجاني على هذا الطلب'
                : `أضيفي ${money(missing, symbol)} للحصول على توصيل مجاني`}
            </T>
          </View>
        )}

        <Card style={{ gap: 8 }}>
          <Row label="المجموع" value={money(subtotal, symbol)} />
          <Row label="التوصيل" value={shipping === 0 ? 'مجاني' : money(shipping, symbol)} />
          <View style={{ height: 1, backgroundColor: C.line, marginVertical: 4 }} />
          <Row label="الإجمالي" value={money(total, symbol)} big />
        </Card>
      </ScrollView>

      <View style={s.bottom}>
        <Button title="إتمام الطلب" onPress={() => router.push('/checkout')} />
      </View>
    </View>
  );
}

function Row({ label, value, big }) {
  return (
    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
      <T style={{ color: big ? C.ink : C.inkSoft, fontWeight: big ? '700' : '400', fontSize: big ? 18 : 15 }}>
        {label}
      </T>
      <T style={{ fontWeight: '700', fontSize: big ? 18 : 15 }}>{value}</T>
    </View>
  );
}

const s = {
  thumb: { width: 66, height: 66, borderRadius: 10, overflow: 'hidden', backgroundColor: C.surface2 },
  stepper: {
    flexDirection: 'row-reverse', alignItems: 'center',
    borderWidth: 1, borderColor: C.line, borderRadius: 999,
  },
  stepBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  note: { padding: 11, borderRadius: 12 },
  bottom: {
    padding: 14, paddingBottom: 28, backgroundColor: C.surface,
    borderTopWidth: 1, borderTopColor: C.line,
  },
};
