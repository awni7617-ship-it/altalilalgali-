import { useEffect, useState } from 'react';
import {
  View, ScrollView, Image, Pressable, KeyboardAvoidingView, Platform, Switch, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { api, photoUrl } from '../../../lib/api';
import { T, Button, Field, Card, Loading, styles as ui } from '../../../lib/ui';
import { C, money } from '../../../lib/theme';

const MAX_PHOTOS = 6;

export default function EditProduct() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rate, setRate] = useState(3.7);
  const [categories, setCategories] = useState([]);

  const [form, setForm] = useState({
    name_ar: '', name_en: '', description_ar: '', brand: '',
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
              description_ar: p.description_ar || '', brand: p.brand || '',
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
      return Alert.alert('الحد الأقصى', `يمكن إضافة ${MAX_PHOTOS} صور فقط.`);
    }

    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return Alert.alert('الإذن مطلوب', 'يحتاج التطبيق إذن الوصول للصور لإضافة صور المنتجات.');
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
    if (!asset.base64) return Alert.alert('تعذّر قراءة الصورة');

    /* The shop reads photos as data URLs, the same as the website. */
    const type = asset.mimeType || 'image/jpeg';
    setPhotos((prev) => [...prev, `data:${type};base64,${asset.base64}`]);
  }

  async function save() {
    setError('');
    if (!form.name_ar.trim() && !form.name_en.trim()) return setError('الرجاء إدخال اسم المنتج');
    if (!(Number(form.price) > 0)) return setError('الرجاء إدخال سعر بيع أكبر من صفر');

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
    Alert.alert('حذف المنتج', `حذف "${form.name_ar}" من المتجر؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.del(`/api/admin/products/${id}`);
            router.back();
          } catch (err) {
            Alert.alert('تعذّر الحذف', err.message);
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
      <Stack.Screen options={{ title: isNew ? 'منتج جديد' : 'تعديل منتج' }} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Field label="اسم المنتج" value={form.name_ar} onChangeText={set('name_ar')} maxLength={140} />
        <Field
          label="الاسم بالإنجليزية"
          value={form.name_en}
          onChangeText={set('name_en')}
          maxLength={140}
          style={[ui.input, { textAlign: 'left', writingDirection: 'ltr' }]}
        />
        <Field
          label="الوصف"
          value={form.description_ar}
          onChangeText={set('description_ar')}
          multiline
          maxLength={2000}
          style={[ui.input, { minHeight: 92, textAlignVertical: 'top' }]}
        />
        <Field label="الماركة" value={form.brand} onChangeText={set('brand')} maxLength={60} />

        <T style={ui.label}>القسم</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
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
                    {c.icon ? `${c.icon} ` : ''}{c.name_ar}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="سعر البيع (₪)" value={form.price} onChangeText={set('price')} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="قبل الخصم" value={form.compare_price} onChangeText={set('compare_price')} keyboardType="decimal-pad" />
          </View>
        </View>

        <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="التكلفة ($)" value={form.cost_usd} onChangeText={set('cost_usd')} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="الكمية" value={form.stock} onChangeText={set('stock')} keyboardType="number-pad" />
          </View>
        </View>

        {margin !== null && (
          <View style={{
            backgroundColor: profit < 0 ? C.badBg : C.okBg,
            padding: 12, borderRadius: 12, marginBottom: 16,
          }}>
            <T style={{ color: profit < 0 ? C.bad : C.ok, fontWeight: '700' }}>
              {profit < 0
                ? '⚠️  سعر البيع أقل من التكلفة'
                : `💰  ربح ${money(profit)} لكل قطعة (${margin}٪)`}
            </T>
          </View>
        )}

        <Card style={{ gap: 14, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
            <T style={{ fontWeight: '600' }}>معروض في المتجر</T>
            <Switch
              value={form.is_active}
              onValueChange={set('is_active')}
              trackColor={{ true: C.ok, false: C.line }}
            />
          </View>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
            <T style={{ fontWeight: '600' }}>★ منتج مميز</T>
            <Switch
              value={form.is_featured}
              onValueChange={set('is_featured')}
              trackColor={{ true: C.ok, false: C.line }}
            />
          </View>
        </Card>

        <T style={ui.label}>الصور</T>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {photos.map((p, index) => (
            <View key={`${index}-${p.slice(-20)}`} style={s.thumb}>
              <Image source={{ uri: photoUrl(p) }} style={{ width: '100%', height: '100%' }} />
              <Pressable
                onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                style={s.remove}
                accessibilityLabel="حذف الصورة"
              >
                <T style={{ color: '#fff', fontSize: 13 }}>✕</T>
              </Pressable>
              {index === 0 && (
                <View style={s.main}>
                  <T style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>رئيسية</T>
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row-reverse', gap: 10, marginBottom: 18 }}>
          <Button title="التقاط صورة" icon="📷" kind="ghost" style={{ flex: 1 }} onPress={() => pickPhoto(true)} />
          <Button title="من الاستوديو" icon="🖼" kind="ghost" style={{ flex: 1 }} onPress={() => pickPhoto(false)} />
        </View>

        {!!error && <T style={{ color: C.bad, marginBottom: 12 }}>{error}</T>}

        <Button title={isNew ? 'إضافة المنتج' : 'حفظ التعديلات'} onPress={save} busy={saving} />

        {!isNew && (
          <Button title="حذف المنتج" kind="ghost" onPress={confirmDelete} style={{ marginTop: 10 }} />
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
