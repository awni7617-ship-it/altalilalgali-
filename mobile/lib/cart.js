/* The basket. Kept on the device so it survives closing the app. */
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'altalil_cart';
const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        setItems(
          Array.isArray(parsed)
            ? parsed
                .filter((i) => i && Number.isFinite(Number(i.id)))
                .map((i) => ({ id: Number(i.id), qty: Math.max(1, Math.min(99, Number(i.qty) || 1)) }))
            : [],
        );
      } catch {
        setItems([]);
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => {});
  }, [items, loaded]);

  const add = useCallback((id, qty = 1) => {
    setItems((prev) => {
      const found = prev.find((i) => i.id === Number(id));
      if (found) {
        return prev.map((i) =>
          i.id === Number(id) ? { ...i, qty: Math.min(99, i.qty + qty) } : i);
      }
      return [...prev, { id: Number(id), qty }];
    });
  }, []);

  const setQty = useCallback((id, qty) => {
    setItems((prev) => prev.map((i) =>
      i.id === Number(id) ? { ...i, qty: Math.max(1, Math.min(99, qty)) } : i));
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id !== Number(id)));
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const count = useMemo(() => items.reduce((n, i) => n + i.qty, 0), [items]);

  const value = useMemo(
    () => ({ items, add, setQty, remove, clear, count, loaded }),
    [items, add, setQty, remove, clear, count, loaded],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}

/** Work out what the basket costs, using the shop's own delivery rules. */
export function basketTotals(lines, settings) {
  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
  const free = Number(settings?.free_shipping_over) || 0;
  const flat = Number(settings?.shipping_flat) || 0;
  const shipping = lines.length === 0 ? 0 : free > 0 && subtotal >= free ? 0 : flat;
  return { subtotal, shipping, total: subtotal + shipping, freeOver: free };
}
