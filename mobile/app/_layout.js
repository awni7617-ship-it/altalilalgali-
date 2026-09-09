import { useEffect } from 'react';
import { I18nManager, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/api';
import { CartProvider } from '../lib/cart';
import { LanguageProvider, useLang } from '../lib/i18n';
import { C } from '../lib/theme';

export default function RootLayout() {
  useEffect(() => {
    /* Layout direction is chosen per language inside the app rather
     * than forced here, because forceRTL only takes effect after a
     * restart — and a language switch that needs one is not a switch.
     * Allowing RTL still lets the platform mirror what it owns. */
    I18nManager.allowRTL(true);
  }, []);

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <CartProvider>
            <Shell />
          </CartProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

/* Inside the provider, so every screen title changes with the language. */
function Shell() {
  const { t } = useLang();

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.plum900 },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          headerBackTitle: t('back'),
          contentStyle: { backgroundColor: C.canvas },
        }}
      >
        <Stack.Screen name="index" options={{ title: t('app_name') }} />
        <Stack.Screen name="login" options={{ title: t('sign_in'), headerShown: false }} />
        <Stack.Screen name="product/[id]" options={{ title: t('product') }} />
        <Stack.Screen name="cart" options={{ title: t('cart') }} />
        <Stack.Screen name="checkout" options={{ title: t('checkout') }} />
        <Stack.Screen name="account" options={{ title: t('account') }} />
        <Stack.Screen name="owner/index" options={{ title: t('dashboard') }} />
        <Stack.Screen name="owner/orders" options={{ title: t('orders') }} />
        <Stack.Screen name="owner/products" options={{ title: t('products') }} />
        <Stack.Screen name="owner/product/[id]" options={{ title: t('edit_product') }} />
      </Stack>
    </View>
  );
}
