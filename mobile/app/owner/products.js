import { useCallback, useState } from 'react';
import { View, ScrollView, Image, Pressable, Switch, TextInput, RefreshControl, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { api, photoUrl } from '../../lib/api';
import { useLang } from '../../lib/i18n';
import { T, Card, Button, Loading, Empty, PhotoBlank, styles as ui } from '../../lib/ui';
import { C, money } from '../../lib/theme';

export default function Products() {
  const router = useRouter();
  const { t, tx, row, align, dir } = useLang();
  const [products, setProducts] = useState(null);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { products: list } = await api.get('/api/admin/products');
      setProducts(list);
    } catch {
      setProducts([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggleActive(product, value) {
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, is_active: value } : p)));
    try {
      await api.patch(`/api/admin/products/${product.id}`, { is_active: value });
    } catch (err) {
      /* Put the switch back where it was if the shop refused. */
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, is_active: !value } : p)));
      Alert.alert(t('save_failed'), err.message);
    }
  }

  async function saveStock(product, text) {
    const stock = Math.max(0, parseInt(text, 10) || 0);
    try {
      await api.patch(`/api/admin/products/${product.id}`, { stock });
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, stock } : p)));
    } catch (err) {
      Alert.alert(t('save_failed'), err.message);
    }
  }

  if (products === null) return <Loading />;

  const shown = query.trim()
    ? products.filter((p) => `${p.name_ar} ${p.name_en} ${p.sku}`.toLowerCase()
        .includes(query.trim().toLowerCase()))
    : products;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.line, gap: 10 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('search_products_ph')}
          placeholderTextColor={C.inkMute}
          style={[ui.input, { paddingVertical: 10, textAlign: align, writingDirection: dir }]}
          clearButtonMode="while-editing"
        />
        <Button title={t('add_product')} icon="＋" onPress={() => router.push('/owner/product/new')} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 40, gap: 10 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={C.plum700}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
          />
        }
      >
        {shown.length === 0 && <Empty icon="🧴" title={t('no_products')} note={t('no_products_note')} />}

        {shown.map((product) => {
          const photo = photoUrl(product.image);
          const name = tx(product, 'name');
          return (
            <Card key={product.id} style={{ gap: 12, opacity: product.is_active ? 1 : 0.6 }}>
              <Pressable
                onPress={() => router.push(`/owner/product/${product.id}`)}
                style={{ flexDirection: row, gap: 12 }}
              >
                <View style={{ width: 62, height: 62, borderRadius: 10, overflow: 'hidden', backgroundColor: C.surface2 }}>
                  {photo
                    ? <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} />
                    : <PhotoBlank letter={name.slice(0, 1)} size={22} />}
                </View>
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '600' }} numberOfLines={2}>{name}</T>
                  <T style={{ color: C.plum700, fontWeight: '700', marginTop: 4 }}>
                    {money(product.price)}
                  </T>
                  {!!product.cost_usd && (
                    <T style={{ color: C.inkMute, fontSize: 12 }}>
                      {t('cost_usd_is', { amount: product.cost_usd })}
                    </T>
                  )}
                </View>
              </Pressable>

              <View style={{ flexDirection: row, alignItems: 'center', gap: 14 }}>
                <View style={{ flexDirection: row, alignItems: 'center', gap: 8, flex: 1 }}>
                  <T style={{ color: C.inkSoft, fontSize: 13.5 }}>{t('quantity')}</T>
                  <TextInput
                    defaultValue={String(product.stock)}
                    keyboardType="number-pad"
                    onEndEditing={(e) => saveStock(product, e.nativeEvent.text)}
                    style={[ui.input, { width: 78, paddingVertical: 7, textAlign: 'center' }]}
                  />
                </View>

                <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
                  <T style={{ color: C.inkSoft, fontSize: 13.5 }}>{t('shown')}</T>
                  <Switch
                    value={!!product.is_active}
                    onValueChange={(v) => toggleActive(product, v)}
                    trackColor={{ true: C.ok, false: C.line }}
                  />
                </View>
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}
