import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, FlatList, Image, Pressable, RefreshControl, TextInput, ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect, Link, Stack } from 'expo-router';
import { api, photoUrl, useAuth } from '../lib/api';
import { useCart } from '../lib/cart';
import { useLang } from '../lib/i18n';
import { T, Button, Badge, Loading, Empty, PhotoBlank, LangToggle, styles as ui } from '../lib/ui';
import { C, money, shadow } from '../lib/theme';

export default function Shop() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const { count, add } = useCart();
  const { t, tx, row } = useLang();

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');

  /* Signed out means there is nothing to show — the shop is private. */
  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  const load = useCallback(async () => {
    try {
      setData(await api.get('/api/shop'));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { if (user) load(); }, [user, load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const products = useMemo(() => {
    const all = data?.products || [];
    const q = query.trim().toLowerCase();
    return all
      .filter((p) => (category ? p.category_slug === category : true))
      .filter((p) => (q
        ? `${p.name_ar} ${p.name_en} ${p.brand}`.toLowerCase().includes(q)
        : true))
      .sort((a, b) => Number(b.in_stock) - Number(a.in_stock));
  }, [data, category, query]);

  if (!ready || (!data && !error)) return <Loading label={t('loading_shop')} />;

  if (error) {
    return (
      <Empty icon="⚠️" title={t('shop_load_failed')} note={error}>
        <Button title={t('retry')} onPress={load} style={{ marginTop: 18 }} />
      </Empty>
    );
  }

  const settings = data.settings || {};
  const symbol = settings.currency_symbol || '₪';
  const categories = (data.categories || []).filter((c) => c.product_count > 0);
  /* The shop stores both languages of the banner; use the one being read. */
  const announcement = tx(settings, 'announcement');

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <LangToggle compact />
              <Pressable
                onPress={() => router.push('/account')}
                accessibilityLabel={t('account')}
                hitSlop={10}
              >
                <T style={{ fontSize: 21 }}>{user?.is_admin ? '👑' : '👤'}</T>
              </Pressable>
            </View>
          ),
        }}
      />
      <View style={[s.bar, { flexDirection: row }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('search_ph')}
          placeholderTextColor={C.inkMute}
          style={[ui.input, { flex: 1, paddingVertical: 10 }]}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <Pressable
          onPress={() => router.push('/cart')}
          accessibilityRole="button"
          accessibilityLabel={t('cart_a11y', { n: count })}
          style={s.cartBtn}
        >
          <T style={{ fontSize: 20 }}>🛍️</T>
          {count > 0 && (
            <View style={[s.cartCount, row === 'row' ? { right: 2 } : { left: 2 }]}>
              <T style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{count}</T>
            </View>
          )}
        </Pressable>
      </View>

      <FlatList
        data={products}
        keyExtractor={(p) => String(p.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 14 }}
        contentContainerStyle={{ gap: 12, paddingVertical: 12, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.plum700} />}
        ListHeaderComponent={
          <View>
            {!!announcement && (
              <View style={s.announce}>
                <T style={{ color: '#fff', fontSize: 13, textAlign: 'center' }}>
                  {announcement}
                </T>
              </View>
            )}

            {user?.is_admin && (
              <Link href="/owner" asChild>
                <Pressable style={s.ownerStrip}>
                  <T style={{ color: '#fff', fontWeight: '700' }}>👑  {t('dashboard')}</T>
                </Pressable>
              </Link>
            )}

            {categories.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[s.chips, { flexDirection: row }]}
              >
                {[{ slug: '', name_ar: t('all'), name_en: t('all'), icon: '✨' }, ...categories].map((c) => {
                  const on = category === c.slug;
                  return (
                    <Pressable
                      key={c.slug || 'all'}
                      onPress={() => setCategory(c.slug)}
                      style={[s.chip, on && { backgroundColor: C.plum700, borderColor: C.plum700 }]}
                    >
                      <T style={[s.chipText, on && { color: '#fff' }]}>
                        {c.icon ? `${c.icon} ` : ''}{tx(c, 'name')}
                      </T>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        }
        ListEmptyComponent={
          <Empty icon="🔍" title={t('no_match')} note={t('no_match_note')} />
        }
        renderItem={({ item }) => (
          <ProductTile
            product={item}
            symbol={symbol}
            onOpen={() => router.push(`/product/${item.id}`)}
            onAdd={() => add(item.id, 1)}
          />
        )}
      />
    </View>
  );
}

function ProductTile({ product, symbol, onOpen, onAdd }) {
  const { t, tx, row } = useLang();
  const name = tx(product, 'name');
  const photo = photoUrl(product.image);
  const sale = product.compare_price > product.price;

  return (
    <Pressable onPress={onOpen} style={[s.tile, shadow]} accessibilityRole="button">
      <View style={s.tilePhoto}>
        {photo
          ? <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          : <PhotoBlank letter={name.slice(0, 1)} size={38} />}

        {!product.in_stock && (
          <View style={s.soldOut}>
            <Badge text={t('sold_out')} tone="slate" />
          </View>
        )}
        {sale && product.in_stock && (
          <View style={[s.tag, row === 'row' ? { left: 8 } : { right: 8 }]}>
            <Badge
              tone="bad"
              text={t('discount_n', { n: Math.round((1 - product.price / product.compare_price) * 100) })}
            />
          </View>
        )}
      </View>

      <View style={{ padding: 10, gap: 3 }}>
        {!!product.brand && (
          <T style={{ fontSize: 10.5, color: C.inkMute, letterSpacing: 0.6 }}>
            {product.brand.toUpperCase()}
          </T>
        )}
        <T numberOfLines={2} style={{ fontSize: 14, fontWeight: '600', minHeight: 38 }}>
          {name}
        </T>

        {product.in_stock && product.stock <= 3 && (
          <T style={{ fontSize: 12, color: C.warn, fontWeight: '700' }}>
            {t('only_left', { n: product.stock })}
          </T>
        )}

        <View style={[s.tileFoot, { flexDirection: row }]}>
          <View style={{ flex: 1 }}>
            <T style={{ fontSize: 16, fontWeight: '700', color: C.plum700 }}>
              {money(product.price, symbol)}
            </T>
            {sale && (
              <T style={{ fontSize: 12, color: C.inkMute, textDecorationLine: 'line-through' }}>
                {money(product.compare_price, symbol)}
              </T>
            )}
          </View>
          <Pressable
            onPress={onAdd}
            disabled={!product.in_stock}
            accessibilityRole="button"
            accessibilityLabel={t('add_to_cart')}
            style={[s.plus, !product.in_stock && { backgroundColor: C.line }]}
          >
            <T style={{ color: '#fff', fontSize: 20, lineHeight: 24 }}>＋</T>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const s = {
  bar: {
    alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.line,
  },
  cartBtn: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.plum50,
  },
  cartCount: {
    position: 'absolute', top: 2, minWidth: 19, height: 19, borderRadius: 10,
    backgroundColor: C.plum700, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  announce: { backgroundColor: C.plum800, paddingVertical: 8, paddingHorizontal: 14 },
  ownerStrip: {
    backgroundColor: C.plum700, margin: 14, marginBottom: 0, padding: 14,
    borderRadius: 14, alignItems: 'center',
  },
  chips: { gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  chip: {
    paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999,
    borderWidth: 1, borderColor: C.line, backgroundColor: C.surface,
  },
  chipText: { fontSize: 14, fontWeight: '600', color: C.inkSoft },
  tile: {
    flex: 1, backgroundColor: C.surface, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: C.line,
  },
  tilePhoto: { aspectRatio: 1, backgroundColor: C.surface2 },
  soldOut: {
    position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  /* Side is chosen per language where it is used, so the badge sits
     in the corner the eye reaches first either way. */
  tag: { position: 'absolute', top: 8 },
  tileFoot: { alignItems: 'center', gap: 8, marginTop: 6 },
  plus: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.plum700,
    alignItems: 'center', justifyContent: 'center',
  },
};
