import { useCallback, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { api, useAuth } from '../../lib/api';
import { useLang } from '../../lib/i18n';
import { T, Card, Button, Loading, Empty } from '../../lib/ui';
import { C, money } from '../../lib/theme';

export default function OwnerHome() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const { t, tx, row } = useLang();
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
    return <Empty icon="🔒" title={t('owner_only')} />;
  }
  if (error) {
    return (
      <Empty icon="⚠️" title={t('panel_load_failed')} note={error}>
        <Button title={t('retry')} onPress={load} style={{ marginTop: 18 }} />
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
      <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 10 }}>
        <Stat label={t('sales')} value={money(st.revenue)} note={t('orders_n', { n: st.orders })} tone={C.ok} />
        <Stat
          label={t('profit')}
          value={money(st.profit)}
          note={t('cost_is', { amount: money(st.cost) })}
          tone={st.profit >= 0 ? C.ok : C.bad}
        />
        <Stat label={t('new_orders')} value={String(st.pending_orders)} tone={st.pending_orders ? C.warn : C.plum500} />
        <Stat label={t('products')} value={String(st.products_total)} note={t('shown_n', { n: st.products_active })} tone={C.plum500} />
        <Stat label={t('out_of_stock')} value={String(st.out_of_stock)} note={t('low_n', { n: st.low_stock })} tone={st.out_of_stock ? C.bad : C.plum500} />
        <Stat label={t('customers')} value={String(st.customers)} tone={C.plum500} />
      </View>

      <Link href="/owner/orders" asChild>
        <Button
          title={st.pending_orders ? t('orders_with_new', { n: st.pending_orders }) : t('orders')}
          icon="🧾"
        />
      </Link>
      <Link href="/owner/products" asChild>
        <Button title={t('products')} icon="🧴" kind="ghost" />
      </Link>

      <Card>
        <T style={{ fontWeight: '700', fontSize: 16, marginBottom: 10 }}>{t('recent_orders')}</T>
        {data.recent_orders?.length === 0 && <T style={{ color: C.inkMute }}>{t('no_orders')}</T>}
        {data.recent_orders?.map((o) => (
          <View key={o.id} style={{ flexDirection: row, justifyContent: 'space-between', paddingVertical: 6 }}>
            <T style={{ flex: 1 }} numberOfLines={1}>#{o.order_no} · {o.customer_name}</T>
            <T style={{ fontWeight: '700' }}>{money(o.total)}</T>
          </View>
        ))}
      </Card>

      <Card>
        <T style={{ fontWeight: '700', fontSize: 16, marginBottom: 10 }}>{t('top_products')}</T>
        {data.top_products?.filter((p) => p.sold > 0).length === 0 && (
          <T style={{ color: C.inkMute }}>{t('no_sales')}</T>
        )}
        {data.top_products?.filter((p) => p.sold > 0).map((p) => (
          <View key={p.id} style={{ flexDirection: row, justifyContent: 'space-between', paddingVertical: 6 }}>
            <T style={{ flex: 1 }} numberOfLines={1}>{tx(p, 'name')}</T>
            <T style={{ color: C.inkSoft }}>{p.sold} · {money(p.revenue)}</T>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value, note, tone }) {
  const { isAr } = useLang();
  /* The coloured edge belongs on the side the eye starts from. */
  const edge = isAr
    ? { borderRightWidth: 4, borderRightColor: tone }
    : { borderLeftWidth: 4, borderLeftColor: tone };
  return (
    <View style={{
      flexGrow: 1, flexBasis: '47%', backgroundColor: C.surface, borderRadius: 14,
      borderWidth: 1, borderColor: C.line, padding: 14, ...edge,
    }}>
      <T style={{ fontSize: 12.5, color: C.inkMute, fontWeight: '600' }}>{label}</T>
      <T style={{ fontSize: 22, fontWeight: '700', marginTop: 4 }}>{value}</T>
      {!!note && <T style={{ fontSize: 11.5, color: C.inkMute, marginTop: 2 }}>{note}</T>}
    </View>
  );
}
