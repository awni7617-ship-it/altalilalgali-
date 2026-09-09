import { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, Linking, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';
import { useLang } from '../../lib/i18n';
import { T, Card, Badge, Loading, Empty, Button, ltr } from '../../lib/ui';
import { C, money } from '../../lib/theme';

const FLOW = [
  ['new', 'status_new', 'plum'],
  ['confirmed', 'status_confirmed', 'plum'],
  ['shipped', 'status_shipped', 'warn'],
  ['delivered', 'status_delivered', 'ok'],
  ['cancelled', 'status_cancelled', 'bad'],
];

export default function Orders() {
  const { t, row, date, city: cityName, alignEnd } = useLang();
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (status = filter) => {
    try {
      const { orders: list } = await api.get(`/api/admin/orders${status ? `?status=${status}` : ''}`);
      setOrders(list);
    } catch {
      setOrders([]);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function changeStatus(order, status) {
    setBusyId(order.id);
    try {
      await api.patch(`/api/admin/orders/${order.id}`, { status });
      await load();
    } catch (err) {
      Alert.alert(t('update_failed'), err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (orders === null) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: row, gap: 8, padding: 12 }}
        style={{ flexGrow: 0, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.line }}
      >
        {[['', t('all')], ...FLOW.map(([k, labelKey]) => [k, t(labelKey)])].map(([key, label]) => {
          const on = filter === key;
          return (
            <Pressable
              key={key || 'all'}
              onPress={() => { setFilter(key); setOrders(null); load(key); }}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                borderWidth: 1, borderColor: on ? C.plum700 : C.line,
                backgroundColor: on ? C.plum700 : C.surface,
              }}
            >
              <T style={{ color: on ? '#fff' : C.inkSoft, fontWeight: '600', fontSize: 14 }}>{label}</T>
            </Pressable>
          );
        })}
      </ScrollView>

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
        {orders.length === 0 && <Empty icon="🧾" title={t('no_orders_here')} />}

        {orders.map((order) => {
          const entry = FLOW.find(([k]) => k === order.status) || FLOW[0];
          const phone = String(order.phone).replace(/\D/g, '');
          const wa = phone.startsWith('0') ? `970${phone.slice(1)}` : phone;

          return (
            <Card key={order.id} style={{ gap: 10 }}>
              <View style={{ flexDirection: row, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '700', fontSize: 16 }}>#{order.order_no}</T>
                  <T style={{ color: C.inkMute, fontSize: 12.5, marginTop: 2 }}>
                    {date(order.created_at)}
                  </T>
                </View>
                <View style={{ alignItems: alignEnd === 'left' ? 'flex-start' : 'flex-end', gap: 6 }}>
                  <Badge text={t(entry[1])} tone={entry[2]} />
                  <T style={{ fontWeight: '700', color: C.plum700, fontSize: 16 }}>
                    {money(order.total)}
                  </T>
                </View>
              </View>

              <View style={{ backgroundColor: C.surface2, borderRadius: 10, padding: 11, gap: 3 }}>
                <T style={{ fontWeight: '600' }}>{order.customer_name}</T>
                <T style={[{ color: C.inkSoft, fontSize: 13.5 }, ltr]}>
                  {order.phone}
                </T>
                <T style={{ color: C.inkSoft, fontSize: 13.5 }}>
                  {cityName(order.city)} — {order.address}
                </T>
                {!!order.notes && (
                  <T style={{ color: C.inkMute, fontSize: 13, marginTop: 4 }}>📝 {order.notes}</T>
                )}
              </View>

              <View>
                {order.items?.map((i) => (
                  <View key={i.id} style={{ flexDirection: row, justifyContent: 'space-between', paddingVertical: 3 }}>
                    <T style={{ flex: 1, color: C.inkSoft }} numberOfLines={1}>{i.name} × {i.qty}</T>
                    <T style={{ color: C.inkSoft }}>{money(i.price * i.qty)}</T>
                  </View>
                ))}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: row, gap: 7 }}>
                  {FLOW.map(([key, labelKey]) => (
                    <Pressable
                      key={key}
                      disabled={busyId === order.id || order.status === key}
                      onPress={() => changeStatus(order, key)}
                      style={{
                        paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999,
                        borderWidth: 1,
                        borderColor: order.status === key ? C.plum700 : C.line,
                        backgroundColor: order.status === key ? C.plum50 : C.surface,
                        opacity: busyId === order.id ? 0.5 : 1,
                      }}
                    >
                      <T style={{ fontSize: 13.5, color: order.status === key ? C.plum700 : C.inkSoft }}>
                        {t(labelKey)}
                      </T>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {!!wa && (
                <Button
                  title={t('message_customer')}
                  kind="whatsapp"
                  icon="💬"
                  onPress={() => Linking.openURL(`https://wa.me/${wa}`).catch(() => {})}
                />
              )}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}
