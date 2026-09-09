import { useEffect, useState } from 'react';
import {
  View, ScrollView, Image, Pressable, KeyboardAvoidingView, Platform, Switch, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { api, photoUrl } from '../../../lib/api';
import { useLang } from '../../../lib/i18n';
import { T, Button, Field, Card, Loading, ltr, styles as ui } from '../../../lib/ui';
import { C, money } from '../../../lib/theme';

const MAX_PHOTOS = 6;

export default function EditProduct() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { t, tx, row, isAr } = useLang();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rate, setRate] = useState(3.7);
  const [categories, setCategories] = useState([]);

  const [form, setForm] = useState({
    name_ar: '', name_en: '', description_ar: '', description_en: '', brand: '',
    price: '', compare_price: '', cost_usd: '', stock: '0',
    category_id: null, is_active: true, is_featured: false,
  });
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [{ categories: cats }, settings] = await Promise.all([
          api.get('/api/categories'),
          api.get('/api/admin/settings'),
        ]);
        setCategories(cats || []);
        setRate(Number(settings.settings?.usd_rate) || 3.7);

        if (!isNew) {
          const { products } = await api.get('/api/admin/products');
          const p = (products || []).find((x) => String(x.id) === String(id));
          if (p) {
            setForm({
              name_ar: p.name_ar || '', name_en: p.name_en || '',
              description_ar: p.description_ar || '', description_en: p.description_en || '',
              brand: p.brand || '',
              price: String(p.price || ''), compare_price: p.compare_price ? String(p.compare_price) : '',
              cost_usd: p.cost_usd ? String(p.cost_usd) : '', stock: String(p.stock ?? 0),
              category_id: p.category_id, is_active: !!p.is_active, is_featured: !!p.is_featured,
            });
            setPhotos((p.images || []).map((i) => i.url));
          }
        }
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function pickPhoto(fromCamera) {
    if (photos.length >= MAX_PHOTOS) {
      return Alert.alert(t('max_photos'), t('max_photos_note', { n: MAX_PHOTOS }));
    }

    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return Alert.alert(t('permission_needed'), t('permission_note'));
    }

    const options = {
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (!asset.base64) return Alert.alert(t('photo_read_failed'));

    /* The shop reads photos as data URLs, the same as the website. */
    const type = asset.mimeType || 'image/jpeg';
    setPhotos((prev) => [...prev, `data:${type};base64,${asset.base64}`]);
  }

  async function save() {
    setError('');
    if (!form.name_ar.trim() && !form.name_en.trim()) return setError(t('err_product_name'));
    if (!(Number(form.price) > 0)) return setError(t('err_product_price'));

    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        compare_price: Number(form.compare_price) || 0,
        cost_usd: Number(form.cost_usd) || 0,
        stock: parseInt(form.stock, 10) || 0,
        images: photos,
      };
      if (isNew) await api.post('/api/admin/products', payload);
      else await api.put(`/api/admin/products/${id}`, payload);
      router.back();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    /* Named in the language being read, so the prompt names the
       product the owner is actually looking at. */
    const shownName = (isAr ? form.name_ar : form.name_en) || form.name_ar || form.name_en;
    Alert.alert(t('delete_product'), t('delete_product_ask', { name: shownName }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.del(`/api/admin/products/${id}`);
            router.back();
          } catch (err) {
            Alert.alert(t('delete_failed'), err.message);
          }
        },
      },
    ]);
  }

  if (loading) return <Loading />;

  const price = Number(form.price) || 0;
  const cost = (Number(form.cost_usd) || 0) * rate;
  const profit = price - cost;
  const margin = price > 0 && cost > 0 ? Math.round((profit / price) * 100) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: isNew ? t('new_product') : t('edit_product') }} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Both languages are edited here, with the one being read
            first — a shop that sells in two languages needs both
            filled in, whichever the owner happens to be using. */}
        <Field
          label={isAr ? t('product_name') : t('name_other')}
          value={form.name_ar}
          onChangeText={set('name_ar')}
          maxLength={140}
          style={{ textAlign: 'right', writingDirection: 'rtl' }}
        />
        <Field
          label={isAr ? t('name_other') : t('product_name')}
          value={form.name_en}
          onChangeText={set('name_en')}
          maxLength={140}
          style={ltr}
        />
        <Field
          label={`${t('description')} · العربية`}
          value={form.description_ar}
          onChangeText={set('description_ar')}
          multiline
          maxLength={2000}
          style={{ minHeight: 92, textAlignVertical: 'top', textAlign: 'right', writingDirection: 'rtl' }}
        />
        <Field
          label={`${t('description')} · English`}
          value={form.description_en}
          onChangeText={set('description_en')}
          multiline
          maxLength={2000}
          style={[ltr, { minHeight: 92, textAlignVertical: 'top' }]}
        />
        <Field label={t('brand')} value={form.brand} onChangeText={set('brand')} maxLength={60} />

        <T style={ui.label}>{t('category')}</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: row, gap: 8 }}>
            {categories.map((c) => {
              const on = form.category_id === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => set('category_id')(on ? null : c.id)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1,
                    borderColor: on ? C.plum700 : C.line, backgroundColor: on ? C.plum700 : C.surface,
                  }}
                >
                  <T style={{ color: on ? '#fff' : C.inkSoft, fontSize: 14 }}>
                    {c.icon ? `${c.icon} ` : ''}{tx(c, 'name')}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={{ flexDirection: row, gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label={t('sell_price')} value={form.price} onChangeText={set('price')} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('before_discount')} value={form.compare_price} onChangeText={set('compare_price')} keyboardType="decimal-pad" />
          </View>
        </View>

        <View style={{ flexDirection: row, gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label={t('cost_dollars')} value={form.cost_usd} onChangeText={set('cost_usd')} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('quantity')} value={form.stock} onChangeText={set('stock')} keyboardType="number-pad" />
          </View>
        </View>

        {margin !== null && (
          <View style={{
            backgroundColor: profit < 0 ? C.badBg : C.okBg,
            padding: 12, borderRadius: 12, marginBottom: 16,
          }}>
            <T style={{ color: profit < 0 ? C.bad : C.ok, fontWeight: '700' }}>
              {profit < 0
                ? t('below_cost')
                : t('profit_each', { amount: money(profit), n: margin })}
            </T>
          </View>
        )}

        <Card style={{ gap: 14, marginBottom: 16 }}>
          <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between' }}>
            <T style={{ fontWeight: '600' }}>{t('shown_in_shop')}</T>
            <Switch
              value={form.is_active}
              onValueChange={set('is_active')}
              trackColor={{ true: C.ok, false: C.line }}
            />
          </View>
          <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between' }}>
            <T style={{ fontWeight: '600' }}>{t('featured')}</T>
            <Switch
              value={form.is_featured}
              onValueChange={set('is_featured')}
              trackColor={{ true: C.ok, false: C.line }}
            />
          </View>
        </Card>

        <T style={ui.label}>{t('photos')}</T>
        <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {photos.map((p, index) => (
            <View key={`${index}-${p.slice(-20)}`} style={s.thumb}>
              <Image source={{ uri: photoUrl(p) }} style={{ width: '100%', height: '100%' }} />
              <Pressable
                onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                style={s.remove}
                accessibilityLabel={t('remove_photo')}
              >
                <T style={{ color: '#fff', fontSize: 13 }}>✕</T>
              </Pressable>
              {index === 0 && (
                <View style={s.main}>
                  <T style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{t('main_photo')}</T>
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={{ flexDirection: row, gap: 10, marginBottom: 18 }}>
          <Button title={t('take_photo')} icon="📷" kind="ghost" style={{ flex: 1 }} onPress={() => pickPhoto(true)} />
          <Button title={t('from_library')} icon="🖼" kind="ghost" style={{ flex: 1 }} onPress={() => pickPhoto(false)} />
        </View>

        {!!error && <T style={{ color: C.bad, marginBottom: 12 }}>{error}</T>}

        <Button title={isNew ? t('add_product_cta') : t('save_changes')} onPress={save} busy={saving} />

        {!isNew && (
          <Button title={t('delete_product')} kind="ghost" onPress={confirmDelete} style={{ marginTop: 10 }} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = {
  thumb: {
    width: 92, height: 92, borderRadius: 12, overflow: 'hidden',
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line,
  },
  remove: {
    position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(43,31,36,0.8)', alignItems: 'center', justifyContent: 'center',
  },
  main: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.plum700, paddingVertical: 2,
  },
};
