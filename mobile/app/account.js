import { useCallback, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter, useFocusEffect, Link } from 'expo-router';
import { api, useAuth } from '../lib/api';
import { useLang } from '../lib/i18n';
import { T, Button, Card, Badge, Loading, Empty, LangToggle, ltr } from '../lib/ui';
import { C, money } from '../lib/theme';

const STATUS = {
  new: ['status_new_customer', 'plum'],
  confirmed: ['status_confirmed', 'plum'],
  shipped: ['status_shipped', 'warn'],
  delivered: ['status_delivered', 'ok'],
  cancelled: ['status_cancelled', 'bad'],
};

export default function Account() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t, row, date, alignEnd } = useLang();
  const [orders, setOrders] = useState(null);

  useFocusEffect(useCallback(() => {
    api.get('/api/auth/orders').then((r) => setOrders(r.orders)).catch(() => setOrders([]));
  }, []));

  if (!user) return <Loading />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>
      <Card>
        <T style={{ fontSize: 20, fontWeight: '700' }}>{user.name || t('account')}</T>
        <T style={[{ color: C.inkMute, marginTop: 4 }, ltr]}>
          {user.email}
        </T>
        {user.is_admin && (
          <View style={{ flexDirection: row, marginTop: 10 }}>
            <Badge text={t('owner_badge')} tone="gold" />
          </View>
        )}
      </Card>

      <Card style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between' }}>
        <T style={{ fontWeight: '600' }}>{t('language')}</T>
        <LangToggle />
      </Card>

      {user.is_admin && (
        <Link href="/owner" asChild>
          <Button title={t('dashboard')} icon="👑" />
        </Link>
      )}

      <View>
        <T style={{ fontSize: 18, fontWeight: '700', marginBottom: 10 }}>
          {t('my_orders')} {orders?.length ? `(${orders.length})` : ''}
        </T>

        {orders === null && <Loading />}

        {orders?.length === 0 && (
          <Card>
            <Empty icon="🧾" title={t('no_orders_yet')} note={t('no_orders_yet_note')} />
          </Card>
        )}

        {orders?.map((order) => {
          const [labelKey, tone] = STATUS[order.status] || [null, 'slate'];
          return (
            <Card key={order.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: row, justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <T style={{ fontWeight: '700' }}>#{order.order_no}</T>
                  <T style={{ color: C.inkMute, fontSize: 12.5, marginTop: 2 }}>
                    {date(order.created_at)}
                  </T>
                </View>
                <View style={{ alignItems: alignEnd === 'left' ? 'flex-start' : 'flex-end', gap: 6 }}>
                  <Badge text={labelKey ? t(labelKey) : '—'} tone={tone} />
                  <T style={{ fontWeight: '700', color: C.plum700 }}>{money(order.total)}</T>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: C.lineSoft, marginVertical: 10 }} />
              {order.items?.map((i) => (
                <View key={i.id} style={{ flexDirection: row, justifyContent: 'space-between' }}>
                  <T style={{ color: C.inkSoft, flex: 1 }} numberOfLines={1}>{i.name} × {i.qty}</T>
                  <T style={{ color: C.inkSoft }}>{money(i.price * i.qty)}</T>
                </View>
              ))}
            </Card>
          );
        })}
      </View>

      <Button
        title={t('sign_out')}
        kind="ghost"
        onPress={async () => {
          await signOut();
          router.replace('/login');
        }}
      />
    </ScrollView>
  );
}
