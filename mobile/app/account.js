import { useCallback, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter, useFocusEffect, Link } from 'expo-router';
import { api, useAuth } from '../lib/api';
import { T, Button, Card, Badge, Loading, Empty } from '../lib/ui';
import { C, money, formatDate } from '../lib/theme';

const STATUS = {
  new: ['قيد المراجعة', 'plum'],
  confirmed: ['مؤكد', 'plum'],
  shipped: ['تم الشحن', 'warn'],
  delivered: ['تم التسليم', 'ok'],
  cancelled: ['ملغي', 'bad'],
};

export default function Account() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [orders, setOrders] = useState(null);

  useFocusEffect(useCallback(() => {
    api.get('/api/auth/orders').then((r) => setOrders(r.orders)).catch(() => setOrders([]));
  }, []));

  if (!user) return <Loading />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>
      <Card>
        <T style={{ fontSize: 20, fontWeight: '700' }}>{user.name || 'حسابي'}</T>
        <T style={{ color: C.inkMute, marginTop: 4, textAlign: 'left', writingDirection: 'ltr' }}>
          {user.email}
        </T>
        {user.is_admin && (
          <View style={{ flexDirection: 'row-reverse', marginTop: 10 }}>
            <Badge text="👑 مالكة المتجر" tone="gold" />
          </View>
        )}
      </Card>

      {user.is_admin && (
        <Link href="/owner" asChild>
          <Button title="لوحة التحكم" icon="👑" />
        </Link>
      )}

      <View>
        <T style={{ fontSize: 18, fontWeight: '700', marginBottom: 10 }}>
          طلباتي {orders?.length ? `(${orders.length})` : ''}
        </T>

        {orders === null && <Loading />}

        {orders?.length === 0 && (
          <Card>
            <Empty icon="🧾" title="لم تقومي بأي طلب بعد" note="تصفّحي المتجر وابدئي التسوق." />
          </Card>
        )}

        {orders?.map((order) => {
          const [label, tone] = STATUS[order.status] || ['—', 'slate'];
          return (
            <Card key={order.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <T style={{ fontWeight: '700' }}>#{order.order_no}</T>
                  <T style={{ color: C.inkMute, fontSize: 12.5, marginTop: 2 }}>
                    {formatDate(order.created_at)}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-start', gap: 6 }}>
                  <Badge text={label} tone={tone} />
                  <T style={{ fontWeight: '700', color: C.plum700 }}>{money(order.total)}</T>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: C.lineSoft, marginVertical: 10 }} />
              {order.items?.map((i) => (
                <View key={i.id} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                  <T style={{ color: C.inkSoft, flex: 1 }} numberOfLines={1}>{i.name} × {i.qty}</T>
                  <T style={{ color: C.inkSoft }}>{money(i.price * i.qty)}</T>
                </View>
              ))}
            </Card>
          );
        })}
      </View>

      <Button
        title="تسجيل الخروج"
        kind="ghost"
        onPress={async () => {
          await signOut();
          router.replace('/login');
        }}
      />
    </ScrollView>
  );
}
