import { useCallback, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { api, useAuth } from '../../lib/api';
import { T, Card, Button, Badge, Loading, Empty } from '../../lib/ui';
import { C, money, formatDate } from '../../lib/theme';

export default function OwnerHome() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.get('/api/admin/overview'));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (ready && user && !user.is_admin) {
    return <Empty icon="🔒" title="هذه الصفحة للمالكة فقط" />;
  }
  if (error) {
    return (
      <Empty icon="⚠️" title="تعذّر تحميل اللوحة" note={error}>
        <Button title="إعادة المحاولة" onPress={load} style={{ marginTop: 18 }} />
      </Empty>
    );
  }
  if (!data) return <Loading />;

  const st = data.stats;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 14, paddingBottom: 40, gap: 12 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={C.plum700}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
        />
      }
    >
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }}>
        <Stat label="المبيعات" value={money(st.revenue)} note={`${st.orders} طلب`} tone={C.ok} />
        <Stat
          label="الربح"
          value={money(st.profit)}
          note={`التكلفة ${money(st.cost)}`}
          tone={st.profit >= 0 ? C.ok : C.bad}
        />
        <Stat label="طلبات جديدة" value={String(st.pending_orders)} tone={st.pending_orders ? C.warn : C.plum500} />
        <Stat label="المنتجات" value={String(st.products_total)} note={`${st.products_active} معروض`} tone={C.plum500} />
        <Stat label="نفد المخزون" value={String(st.out_of_stock)} note={`منخفض: ${st.low_stock}`} tone={st.out_of_stock ? C.bad : C.plum500} />
        <Stat label="الزبائن" value={String(st.customers)} tone={C.plum500} />
      </View>

      <Link href="/owner/orders" asChild>
        <Button
          title={st.pending_orders ? `الطلبات (${st.pending_orders} جديدة)` : 'الطلبات'}
          icon="🧾"
        />
      </Link>
      <Link href="/owner/products" asChild>
        <Button title="المنتجات" icon="🧴" kind="ghost" />
      </Link>

      <Card>
        <T style={{ fontWeight: '700', fontSize: 16, marginBottom: 10 }}>أحدث الطلبات</T>
        {data.recent_orders?.length === 0 && <T style={{ color: C.inkMute }}>لا توجد طلبات بعد.</T>}
        {data.recent_orders?.map((o) => (
          <View key={o.id} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 6 }}>
            <T style={{ flex: 1 }} numberOfLines={1}>#{o.order_no} · {o.customer_name}</T>
            <T style={{ fontWeight: '700' }}>{money(o.total)}</T>
          </View>
        ))}
      </Card>

      <Card>
        <T style={{ fontWeight: '700', fontSize: 16, marginBottom: 10 }}>الأكثر مبيعاً</T>
        {data.top_products?.filter((p) => p.sold > 0).length === 0 && (
          <T style={{ color: C.inkMute }}>لا توجد مبيعات بعد.</T>
        )}
        {data.top_products?.filter((p) => p.sold > 0).map((p) => (
          <View key={p.id} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 6 }}>
            <T style={{ flex: 1 }} numberOfLines={1}>{p.name_ar}</T>
            <T style={{ color: C.inkSoft }}>{p.sold} · {money(p.revenue)}</T>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value, note, tone }) {
  return (
    <View style={{
      flexGrow: 1, flexBasis: '47%', backgroundColor: C.surface, borderRadius: 14,
      borderWidth: 1, borderColor: C.line, padding: 14, borderRightWidth: 4, borderRightColor: tone,
    }}>
      <T style={{ fontSize: 12.5, color: C.inkMute, fontWeight: '600' }}>{label}</T>
      <T style={{ fontSize: 22, fontWeight: '700', marginTop: 4 }}>{value}</T>
      {!!note && <T style={{ fontSize: 11.5, color: C.inkMute, marginTop: 2 }}>{note}</T>}
    </View>
  );
}
