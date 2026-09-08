import { useEffect } from 'react';
import { I18nManager, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/api';
import { CartProvider } from '../lib/cart';
import { C } from '../lib/theme';

export default function RootLayout() {
  useEffect(() => {
    /* The shop is Arabic, so allow the platform to lay out
     * right-to-left where it can. */
    I18nManager.allowRTL(true);
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <View style={{ flex: 1, backgroundColor: C.canvas }}>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: C.plum900 },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: '700' },
                headerBackTitle: 'رجوع',
                contentStyle: { backgroundColor: C.canvas },
              }}
            >
              <Stack.Screen name="index" options={{ title: 'الطليل الغالي' }} />
              <Stack.Screen name="login" options={{ title: 'تسجيل الدخول', headerShown: false }} />
              <Stack.Screen name="product/[id]" options={{ title: 'المنتج' }} />
              <Stack.Screen name="cart" options={{ title: 'السلة' }} />
              <Stack.Screen name="checkout" options={{ title: 'إتمام الطلب' }} />
              <Stack.Screen name="account" options={{ title: 'حسابي' }} />
              <Stack.Screen name="owner/index" options={{ title: 'لوحة التحكم' }} />
              <Stack.Screen name="owner/orders" options={{ title: 'الطلبات' }} />
              <Stack.Screen name="owner/products" options={{ title: 'المنتجات' }} />
              <Stack.Screen name="owner/product/[id]" options={{ title: 'تعديل منتج' }} />
            </Stack>
          </View>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
