// src/pages/CartPage.jsx
import React from "react";
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNavigate, Link } from 'react-router-dom';

const FALLBACK_IMG = 'https://placehold.co/200x200?text=Item';
const formatTHB = (n) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(Number(n || 0));

function getImage(it) {
  return it.image || it.image_url || it.img || it.photo || FALLBACK_IMG;
}
function getId(it) {
  return it.id ?? it.product_id ?? it.rabbit_id ?? it._id ?? String(it.name || Math.random());
}
function getName(it) {
  return it.name || it.title || it.product_name || it.rabbit_name || 'ไม่มีชื่อ';
}
function getUnitPrice(it) {
  return Number(it.price ?? it.unitPrice ?? it.amount ?? 0);
}
function getQty(it) {
  return Number(it.quantity ?? it.qty ?? 1);
}
function getType(it) {
  if (it.type) return String(it.type).toLowerCase();
  const cat = String(it.category || '').toLowerCase();
  if (cat.includes('equip')) return 'equipment';
  if (cat.includes('food')) return 'pet-food';
  return 'rabbit';
}
function detailLink(it) {
  const t = getType(it);
  const id = getId(it);
  if (t === 'equipment') return `/equipment/${id}`;
  if (t === 'pet-food') return `/pet-food/${id}`;
  return `/pets/${id}`;
}
// ✅ อ่านสต๊อกจาก item (รองรับชื่อฟิลด์หลายแบบ)
function getStock(it) {
  const s = Number(it.stock ?? it.available ?? it.qtyAvailable ?? NaN);
  return Number.isFinite(s) ? s : Infinity; // ถ้าไม่มี ให้ถือว่าไม่จำกัด
}

export default function CartPage() {
  const { user } = useAuth();
  const { cartItems, increment, decrement, setQty, removeFromCart } = useCart();
  const navigate = useNavigate();

  const subtotal = cartItems.reduce((sum, it) => sum + getUnitPrice(it) * getQty(it), 0);

  // ✅ ถ้าสต๊อกลดลงจนต่ำกว่าในตะกร้า ให้ปรับลงอัตโนมัติ
  //    (กันกรณีเปิดตะกร้าทิ้งไว้ แล้วสต๊อกเปลี่ยน)
  React.useEffect(() => {
    for (const it of cartItems) {
      const id = getId(it);
      const stock = getStock(it);
      const qty = getQty(it);
      if (Number.isFinite(stock) && qty > stock) {
        setQty(id, Math.max(0, stock)); // 0 = หมด → ปิดปุ่ม + แจ้งผู้ใช้เองได้
      }
    }
  }, [cartItems, setQty]);

  const handleCheckout = () => {
    if (!user) navigate('/get-started', { state: { from: '/checkout' } });
    else navigate('/checkout');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      {/* หัวข้อ + breadcrumb */}
      <div className="mb-6">
        <div className="text-sm text-neutral-500 mb-1">
          <Link to="/" className="hover:underline">หน้าแรก</Link> <span className="mx-1">/</span> ตะกร้า
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <span>🛒</span> ตะกร้าของคุณ
        </h1>
      </div>

      {/* ว่างเปล่า */}
      {cartItems.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border p-10 text-center">
          <p className="text-lg text-neutral-600">ยังไม่มีสินค้าในตะกร้า</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/pets" className="px-4 py-2 rounded-full border hover:bg-neutral-50">ดูรายการกระต่าย</Link>
            <Link to="/pet-food" className="px-4 py-2 rounded-full border hover:bg-neutral-50">อาหารสัตว์เลี้ยง</Link>
            <Link to="/equipment" className="px-4 py-2 rounded-full border hover:bg-neutral-50">อุปกรณ์</Link>
          </div>
        </div>
      ) : (
        // มีสินค้า: 2 คอลัมน์
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* ซ้าย: รายการสินค้า */}
          <div className="md:col-span-2 space-y-4">
            {cartItems.map((item) => {
              const id = getId(item);
              const qty = getQty(item);
              const unit = getUnitPrice(item);
              const name = getName(item);
              const img = getImage(item);
              const link = detailLink(item);
              const type = getType(item);
              const stock = getStock(item);
              const outOfStock = Number.isFinite(stock) && stock <= 0;

              return (
                <div key={id} className="bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition">
                  <div className="flex gap-4">
                    <Link to={link} className="shrink-0">
                      <img
                        src={img}
                        alt={name}
                        className="w-24 h-24 rounded-xl object-cover"
                        onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }}
                      />
                    </Link>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <Link to={link} className="text-lg font-semibold hover:underline line-clamp-1">
                            {name}
                          </Link>

                          <div className="mt-1 flex items-center gap-2 text-sm text-neutral-500">
                            <span className="px-2 py-0.5 rounded-full border text-xs">
                              {type === 'rabbit' ? 'กระต่าย' : type === 'pet-food' ? 'อาหารสัตว์' : 'อุปกรณ์'}
                            </span>

                            {/* ✅ แสดงคงเหลือถ้ามีข้อมูล */}
                            {Number.isFinite(stock) && (
                              <>
                                <span>•</span>
                                {outOfStock ? (
                                  <span className="text-rose-600">สินค้าหมด</span>
                                ) : (
                                  <span className="text-slate-600">
                                    คงเหลือ <b>{stock}</b>
                                  </span>
                                )}
                              </>
                            )}

                            <span>•</span>

                            {/* ตัวควบคุมจำนวน (ล็อกตามสต๊อก) */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => decrement(id)}
                                className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-neutral-50 disabled:opacity-50"
                                aria-label="ลดจำนวน"
                                title="ลดจำนวน"
                                disabled={outOfStock || qty <= 1}
                              >
                                –
                              </button>

                              <input
                                type="number"
                                min={1}
                                max={Number.isFinite(stock) ? stock : undefined}
                                value={outOfStock ? 0 : qty}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '') return; // ปล่อยว่างชั่วคราว
                                  let n = Math.max(0, Number(val) || 0);
                                  if (Number.isFinite(stock)) n = Math.min(stock, n); // ✅ clamp ตามสต๊อก
                                  setQty(id, n);
                                }}
                                onBlur={(e) => {
                                  // คืนค่าอย่างน้อย 1 ถ้ายังมีของ
                                  if (e.target.value === '' && !outOfStock) setQty(id, 1);
                                }}
                                className="w-14 text-center border rounded-lg py-1 disabled:opacity-50"
                                disabled={outOfStock}
                              />

                              <button
                                onClick={() => {
                                  if (!Number.isFinite(stock) || qty < stock) increment(id);
                                }}
                                className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-neutral-50 disabled:opacity-50"
                                aria-label="เพิ่มจำนวน"
                                title="เพิ่มจำนวน"
                                disabled={outOfStock || (Number.isFinite(stock) && qty >= stock)}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => removeFromCart(id)}
                          className="text-red-600 hover:text-red-700 text-sm px-3 py-1 rounded-full border border-red-200 hover:bg-red-50"
                          title="ลบออกจากตะกร้า"
                        >
                          ลบ
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-sm text-neutral-500">
                          ราคาต่อหน่วย: <span className="font-medium text-neutral-700">{formatTHB(unit)}</span>
                        </div>
                        <div className="text-lg font-bold text-emerald-600">
                          {formatTHB(unit * qty)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ขวา: สรุปคำสั่งซื้อ */}
          <aside className="md:col-span-1">
            <div className="bg-white border rounded-2xl p-5 shadow-sm md:sticky md:top-6">
              <h2 className="text-lg font-bold mb-4">สรุปคำสั่งซื้อ</h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>ยอดรวมสินค้า</span>
                  <span className="font-medium">{formatTHB(subtotal)}</span>
                </div>
                <div className="flex justify-between text-neutral-500">
                  <span>ค่าจัดส่ง</span>
                  <span>คำนวณตอนชำระเงิน</span>
                </div>
              </div>

              <div className="my-4 border-t" />
              <div className="flex justify-between items-center text-base font-semibold">
                <span>ราคารวม</span>
                <span className="text-emerald-600">{formatTHB(subtotal)}</span>
              </div>

              <button
                onClick={handleCheckout}
                className="mt-5 w-full bg-pink-500 hover:bg-pink-600 text-white font-semibold py-3 rounded-xl shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99]"
              >
                ✅ ไปชำระเงิน
              </button>

              <Link to="/" className="mt-3 block text-center text-sm text-neutral-600 hover:text-neutral-800">
                ← ไปเลือกสินค้าต่อ
              </Link>

              <p className="mt-4 text-xs text-neutral-500">
                * โปรดตรวจสอบรายการและจำนวนให้ถูกต้องก่อนดำเนินการชำระเงิน
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
