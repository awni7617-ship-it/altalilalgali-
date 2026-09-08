import { useEffect, useState } from 'react';
import { View, ScrollView, Image, Pressable, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { api, photoUrl } from '../../lib/api';
import { useCart } from '../../lib/cart';
import { T, Button, Badge, Loading, Empty, PhotoBlank } from '../../lib/ui';
import { C, money } from '../../lib/theme';

const WIDTH = Dimensions.get('window').width;

export default function Product() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { add } = useCart();

  const [product, setProduct] = useState(null);
  const [settings, setSettings] = useState({});
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [one, shop] = await Promise.all([
          api.get(`/api/products/${id}`),
          api.get('/api/shop'),
        ]);
        setProduct(one.product);
        setSettings(shop.settings || {});
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [id]);

  if (error) return <Empty icon="⚠️" title="تعذّر فتح المنتج" note={error} />;
  if (!product) return <Loading />;

  const symbol = settings.currency_symbol || '₪';
  const photos = (product.images || []).map((i) => photoUrl(i.url)).filter(Boolean);
  const sale = product.compare_price > product.price;
  const max = Math.max(1, product.stock);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: product.name_ar }} />

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ width: WIDTH, height: WIDTH, backgroundColor: C.surface2 }}>
          {photos.length ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / WIDTH))}
            >
              {photos.map((uri) => (
                <Image key={uri} source={{ uri }} style={{ width: WIDTH, height: WIDTH }} resizeMode="cover" />
              ))}
            </ScrollView>
          ) : (
            <PhotoBlank letter={(product.name_ar || '').slice(0, 1)} size={80} />
          )}

          {photos.length > 1 && (
            <View style={s.dots}>
              {photos.map((p, i) => (
                <View key={p} style={[s.dot, i === photoIndex && { backgroundColor: C.plum700 }]} />
              ))}
            </View>
          )}
        </View>

        <View style={{ padding: 18, gap: 6 }}>
          {!!product.brand && (
            <T style={{ color: C.inkMute, fontSize: 12, letterSpacing: 0.8 }}>
              {product.brand.toUpperCase()}
            </T>
          )}
          <T style={{ fontSize: 23, fontWeight: '700', lineHeight: 32 }}>{product.name_ar}</T>

          <View style={{ flexDirection: 'row-reverse', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
            <T style={{ fontSize: 27, fontWeight: '700', color: C.plum700 }}>
              {money(product.price, symbol)}
            </T>
            {sale && (
              <T style={{ fontSize: 15, color: C.inkMute, textDecorationLine: 'line-through' }}>
                {money(product.compare_price, symbol)}
              </T>
            )}
          </View>

          <View style={{ flexDirection: 'row-reverse', marginTop: 10 }}>
            {product.in_stock
              ? <Badge tone="ok" text={product.stock <= 5 ? `متوفر — باقي ${product.stock}` : 'متوفر'} />
              : <Badge tone="slate" text="نفدت الكمية" />}
          </View>

          {!!product.description_ar && (
            <T style={{ color: C.inkSoft, lineHeight: 26, marginTop: 16 }}>
              {product.description_ar}
            </T>
          )}
        </View>
      </ScrollView>

      {product.in_stock && (
        <View style={s.bottom}>
          <View style={s.stepper}>
            <Pressable
              onPress={() => setQty((q) => Math.max(1, q - 1))}
              style={s.stepBtn}
              accessibilityLabel="أقل"
            >
              <T style={{ fontSize: 20, color: C.inkSoft }}>−</T>
            </Pressable>
            <T style={{ minWidth: 34, textAlign: 'center', fontWeight: '700', fontSize: 16 }}>{qty}</T>
            <Pressable
              onPress={() => setQty((q) => Math.min(max, q + 1))}
              style={s.stepBtn}
              accessibilityLabel="أكثر"
            >
              <T style={{ fontSize: 20, color: C.inkSoft }}>＋</T>
            </Pressable>
          </View>

          <Button
            title="أضيفي إلى السلة"
            icon="🛍️"
            style={{ flex: 1 }}
            onPress={() => {
              add(product.id, qty);
              router.push('/cart');
            }}
          />
        </View>
      )}
    </View>
  );
}

const s = {
  dots: {
    position: 'absolute', bottom: 12, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.8)' },
  bottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12,
    padding: 14, paddingBottom: 28,
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line,
  },
  stepper: {
    flexDirection: 'row-reverse', alignItems: 'center',
    borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 4,
  },
  stepBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
};
