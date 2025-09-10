// src/context/CartContext.jsx
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext();
export const useCart = () => useContext(CartContext);

/* ================= helpers ================= */
function getType(it) {
  if (it?.type) return String(it.type).toLowerCase();
  const cat = String(it?.category || '').toLowerCase();
  if (cat.includes('equip')) return 'equipment';
  if (cat.includes('food')) return 'pet-food';
  return 'rabbit';
}
function getBaseId(it) {
  return it?.id ?? it?.product_id ?? it?.rabbit_id ?? it?._id ?? String(it?.name ?? '');
}
function getUniqueId(it) {
  return `${getType(it)}-${getBaseId(it)}`;
}
/** ✅ อ่านสต๊อกจากหลายชื่อฟิลด์; ถ้าไม่มีให้ถือว่าไม่จำกัด (Infinity) */
function getStock(it) {
  const s = Number(it?.stock ?? it?.available ?? it?.qtyAvailable ?? NaN);
  return Number.isFinite(s) ? Math.max(0, s) : Infinity;
}

/* ============ storage keys ============ */
const GUEST_KEY = 'cart:guest';
const BUCKET_VERSION = 1;

const getUserId = (user) => user?.id ?? user?.user_id ?? user?._id ?? user?.uid ?? null;
const keyForUser = (user) => (getUserId(user) ? `cart:user:${getUserId(user)}` : GUEST_KEY);

/* ============ safe storage helpers ============ */
function emptyBucket(owner = null) {
  return { v: BUCKET_VERSION, owner, items: [], updatedAt: Date.now() };
}
function safeReadBucket(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return emptyBucket(key === GUEST_KEY ? null : '__unknown__');
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items)) return emptyBucket(data?.owner ?? null);
    return { v: data.v ?? 0, owner: data.owner ?? null, items: data.items, updatedAt: data.updatedAt ?? Date.now() };
  } catch {
    return emptyBucket(key === GUEST_KEY ? null : '__unknown__');
  }
}
function safeWriteBucket(key, bucket) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...bucket, v: BUCKET_VERSION, updatedAt: Date.now() }));
  } catch {/* ignore */}
}
function readItems(key) {
  return safeReadBucket(key).items || [];
}
function writeItems(key, items, owner = null) {
  const b = safeReadBucket(key);
  safeWriteBucket(key, { ...b, owner, items: Array.isArray(items) ? items : [] });
}

/* ============ merge carts (guest -> user) ============ */
function mergeCarts(a = [], b = []) {
  const map = new Map();
  [...a, ...b].forEach((it) => {
    const id = it?.id ?? getUniqueId(it);
    const inc = Math.max(1, Number(it?.quantity ?? it?.qty ?? 1));
    const stock = getStock(it);
    const prev = map.get(id);
    if (prev) {
      const cap = Number.isFinite(stock) ? stock : getStock(prev);
      const next = Math.min(cap, Number(prev.quantity || 1) + inc);
      map.set(id, { ...prev, quantity: next, stock: it.stock ?? prev.stock });
    } else {
      map.set(id, { ...(it || {}), id, quantity: Math.min(stock, inc) });
    }
  });
  return [...map.values()];
}

/* ================= Provider ================= */
export function CartProvider({ children }) {
  const { user } = useAuth();
  const userId = getUserId(user);
  const [cartItems, setCartItems] = useState(() => readItems(keyForUser(user)));
  const [hydrated, setHydrated] = useState(false);

  const prevUserIdRef = useRef(userId);
  const hasMergedForUserRef = useRef(null);

  useEffect(() => {
    const prevId = prevUserIdRef.current;
    const currId = userId;

    setHydrated(false);

    // migrate legacy 'cart' -> guest
    const legacy = localStorage.getItem('cart');
    if (legacy && !localStorage.getItem(GUEST_KEY)) {
      try {
        const oldItems = JSON.parse(legacy);
        writeItems(GUEST_KEY, Array.isArray(oldItems) ? oldItems : [], null);
      } catch {}
      localStorage.removeItem('cart');
    }

    // guest -> user (login)
    if (!prevId && currId) {
      const userKey = keyForUser(user);
      const userB = safeReadBucket(userKey);
      const guestB = safeReadBucket(GUEST_KEY);
      const merged = hasMergedForUserRef.current === currId ? userB.items : mergeCarts(userB.items, guestB.items);
      writeItems(userKey, merged, currId);
      localStorage.removeItem(GUEST_KEY);
      hasMergedForUserRef.current = currId;
      setCartItems(merged);
      prevUserIdRef.current = currId;
      setHydrated(true);
      return;
    }

    // user -> guest (logout)
    if (prevId && !currId) {
      writeItems(GUEST_KEY, [], null);
      setCartItems([]);
      prevUserIdRef.current = null;
      hasMergedForUserRef.current = null;
      setHydrated(true);
      return;
    }

    // switch account or first load
    if (currId) {
      const userKey = keyForUser(user);
      const userB = safeReadBucket(userKey);
      localStorage.removeItem(GUEST_KEY);
      setCartItems(userB.items);
      prevUserIdRef.current = currId;
      hasMergedForUserRef.current = currId;
    } else {
      const guestB = safeReadBucket(GUEST_KEY);
      setCartItems(guestB.items);
      prevUserIdRef.current = null;
      hasMergedForUserRef.current = null;
    }

    setHydrated(true);
  }, [userId, user]);

  // persist
  useEffect(() => {
    if (!hydrated) return;
    if (userId) writeItems(`cart:user:${userId}`, cartItems, userId);
    else writeItems(GUEST_KEY, cartItems, null);
  }, [cartItems, userId, hydrated]);

  // one-time cleanup: clamp ปริมาณตาม stock ของรายการเก่าที่เคยถูกบันทึกไว้
  useEffect(() => {
    setCartItems((prev) =>
      prev
        .map((i) => {
          const stock = getStock(i);
          const q = Math.max(0, Number(i.quantity || 1));
          return { ...i, quantity: Number.isFinite(stock) ? Math.min(stock, q) : q };
        })
        .filter((i) => (Number(i.quantity) || 0) > 0)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================= actions (ทั้งหมด clamp ตาม stock) ================= */
  const addToCart = (item) => {
    const id = getUniqueId(item);
    const inc = Math.max(1, Number(item?.quantity ?? item?.qty ?? 1));
    const stock = getStock(item); // แนะนำให้ส่ง stock มาพร้อม item ตั้งแต่หน้า Detail

    setCartItems((prev) => {
      const exists = prev.find((i) => i.id === id);
      if (exists) {
        const cap = Number.isFinite(stock) ? stock : getStock(exists);
        const next = Math.min(cap, Number(exists.quantity || 1) + inc);
        return prev.map((i) => (i.id === id ? { ...i, quantity: next, stock: item.stock ?? i.stock } : i));
      }
      const firstQty = Number.isFinite(stock) ? Math.min(stock, inc) : inc;
      return [...prev, { ...item, id, quantity: firstQty }];
    });
  };

  const increment = (id) => {
    setCartItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const stock = getStock(i);
        const curr = Number(i.quantity || 1);
        if (Number.isFinite(stock) && curr >= stock) return i; // หยุดที่เพดาน
        return { ...i, quantity: curr + 1 };
      })
    );
  };

  const decrement = (id) => {
    setCartItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: Math.max(0, Number(i.quantity || 1) - 1) } : i))
        .filter((i) => (Number(i.quantity) || 0) > 0)
    );
  };

  const setQty = (id, qty) => {
    setCartItems((prev) =>
      prev
        .map((i) => {
          if (i.id !== id) return i;
          const stock = getStock(i);
          let q = Math.max(0, Number(qty) || 0);
          if (Number.isFinite(stock)) q = Math.min(stock, q);
          return { ...i, quantity: q };
        })
        .filter((i) => (Number(i.quantity) || 0) > 0)
    );
  };

  const removeFromCart = (id) => setCartItems((prev) => prev.filter((i) => i.id !== id));
  const clearCart = () => setCartItems([]);

  // (ออปชัน) อัปเดตข้อมูล item รายตัว เช่น เติม stock ที่ดึงมาทีหลัง
  const patchItem = (id, patch) =>
    setCartItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const value = useMemo(
    () => ({ cartItems, addToCart, increment, decrement, setQty, removeFromCart, clearCart, patchItem }),
    [cartItems]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
