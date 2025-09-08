// src/context/CartContext.jsx
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext();
export const useCart = () => useContext(CartContext);

/* ============ helper: แยกหมวด/สร้าง id ไม่ชนกัน ============ */
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

/* ============ คีย์ localStorage แยกตามผู้ใช้ ============ */
const GUEST_KEY = 'cart:guest';
const BUCKET_VERSION = 1;

const getUserId = (user) => user?.id ?? user?.user_id ?? user?._id ?? user?.uid ?? null;
const keyForUser = (user) => (getUserId(user) ? `cart:user:${getUserId(user)}` : GUEST_KEY);

/* ============ safe storage with owner metadata ============ */
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
  } catch { /* ignore */ }
}
function readItems(key) {
  return safeReadBucket(key).items || [];
}
function writeItems(key, items, owner = null) {
  const b = safeReadBucket(key);
  safeWriteBucket(key, { ...b, owner, items: Array.isArray(items) ? items : [] });
}

/* ============ merge ============ */
function mergeCarts(a = [], b = []) {
  const map = new Map();
  [...a, ...b].forEach((it) => {
    const id = it?.id ?? getUniqueId(it);
    const prev = map.get(id);
    const inc = Number(it?.quantity ?? it?.qty ?? 1) || 1;
    if (prev) {
      map.set(id, { ...prev, quantity: Number(prev.quantity || 1) + inc });
    } else {
      map.set(id, { ...(it || {}), id, quantity: inc });
    }
  });
  return [...map.values()];
}

/* ============ Provider ============ */
export function CartProvider({ children }) {
  const { user } = useAuth();
  const userId = getUserId(user);
  const [cartItems, setCartItems] = useState(() => readItems(keyForUser(user)));
  const [hydrated, setHydrated] = useState(false);

  const prevUserIdRef = useRef(userId);
  const hasMergedForUserRef = useRef(null); // กัน merge ซ้ำสำหรับ user เดิม

  useEffect(() => {
    const prevId = prevUserIdRef.current;
    const currId = userId;

    setHydrated(false);

    // migrate คีย์เก่า 'cart' -> guest (ครั้งเดียว ถ้ายังไม่มี guest)
    const legacy = localStorage.getItem('cart');
    if (legacy && !localStorage.getItem(GUEST_KEY)) {
      try {
        const oldItems = JSON.parse(legacy);
        writeItems(GUEST_KEY, Array.isArray(oldItems) ? oldItems : [], null);
      } catch { /* ignore */ }
      localStorage.removeItem('cart');
    }

    // ---- guest -> user (เพิ่งล็อกอิน)
    if (!prevId && currId) {
      const userKey = keyForUser(user);
      const userB = safeReadBucket(userKey);
      const guestB = safeReadBucket(GUEST_KEY);

      // merge เฉพาะครั้งแรกของ user คนนี้
      const merged = hasMergedForUserRef.current === currId
        ? userB.items
        : mergeCarts(userB.items, guestB.items);

      writeItems(userKey, merged, currId);
      // 🔒 สำคัญ: ลบ guest หลัง merge กันรั่วข้ามบัญชี
      localStorage.removeItem(GUEST_KEY);

      hasMergedForUserRef.current = currId;
      setCartItems(merged);
      prevUserIdRef.current = currId;
      setHydrated(true);
      return;
    }

    // ---- user -> guest (เพิ่งล็อกเอาต์)
    if (prevId && !currId) {
      // 🔒 เคลียร์ guest ให้ว่าง (อย่าโยนของ user ไป guest เด็ดขาด)
      writeItems(GUEST_KEY, [], null);
      setCartItems([]);
      prevUserIdRef.current = null;
      hasMergedForUserRef.current = null;
      setHydrated(true);
      return;
    }

    // ---- เปลี่ยนบัญชี A -> B หรือโหลดครั้งแรก (คีย์ไม่เปลี่ยนสถานะ)
    if (currId) {
      const userKey = keyForUser(user);
      const userB = safeReadBucket(userKey);
      // กันกรณี guest ค้างจากรอบก่อน
      localStorage.removeItem(GUEST_KEY);

      setCartItems(userB.items);
      prevUserIdRef.current = currId;
      // ยังไม่ถือว่า merged จนกว่าจะต้อง merge จริง (แต่เราไม่ merge อัตโนมัติอีกแล้ว)
      hasMergedForUserRef.current = currId;
    } else {
      // guest ปกติ
      const guestB = safeReadBucket(GUEST_KEY);
      setCartItems(guestB.items);
      prevUserIdRef.current = null;
      hasMergedForUserRef.current = null;
    }

    setHydrated(true);
  }, [userId, user]);

  // เขียนลง storage หลัง hydrate เท่านั้น กันเขียนทับผิดบัญชี
  useEffect(() => {
    if (!hydrated) return;
    if (userId) {
      writeItems(`cart:user:${userId}`, cartItems, userId);
    } else {
      writeItems(GUEST_KEY, cartItems, null);
    }
  }, [cartItems, userId, hydrated]);

  /* ============ actions ============ */
  const addToCart = (item) => {
    const id = getUniqueId(item);
    const inc = Math.max(1, Number(item?.quantity ?? item?.qty ?? 1));
    setCartItems((prev) => {
      const exists = prev.find((i) => i.id === id);
      if (exists) return prev.map((i) => i.id === id ? { ...i, quantity: Number(i.quantity || 1) + inc } : i);
      return [...prev, { ...item, id, quantity: inc }];
    });
  };

  const increment = (id) => {
    setCartItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: Number(i.quantity || 1) + 1 } : i));
  };

  const decrement = (id) => {
    setCartItems((prev) =>
      prev
        .map((i) => i.id === id ? { ...i, quantity: Math.max(0, Number(i.quantity || 1) - 1) } : i)
        .filter((i) => (Number(i.quantity) || 0) > 0)
    );
  };

  const setQty = (id, qty) => {
    const q = Math.max(0, Number(qty) || 0);
    setCartItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: q } : i))
        .filter((i) => (Number(i.quantity) || 0) > 0)
    );
  };

  const removeFromCart = (id) => setCartItems((prev) => prev.filter((i) => i.id !== id));
  const clearCart = () => setCartItems([]);

  const value = useMemo(
    () => ({ cartItems, addToCart, increment, decrement, setQty, removeFromCart, clearCart }),
    [cartItems]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
