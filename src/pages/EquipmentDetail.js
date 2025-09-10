// src/pages/EquipmentDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";

export default function EquipmentDetail() {
  const { id } = useParams();
  const productId = useMemo(() => Number(id), [id]);
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [item, setItem] = useState(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [mainImg, setMainImg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch(`${API_BASE}/api/admin/products/${productId}`);
        if (!res.ok) throw new Error(`โหลดข้อมูลไม่สำเร็จ (HTTP ${res.status})`);
        const data = await res.json();
        setItem(data);
        setMainImg(data.image_url || null);

        const s = Number(data?.stock ?? 0);
        setQty(s > 0 ? 1 : 0); // ถ้าหมดสต๊อก ให้ qty=0 เพื่อปิดปุ่ม
      } catch (e) {
        setErr(e.message || "เกิดข้อผิดพลาด");
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  if (loading) return <p className="text-center p-8">กำลังโหลด...</p>;
  if (err)
    return (
      <div className="max-w-xl mx-auto p-6 mt-10 text-center text-red-600">
        {err}
        <div className="mt-4">
          <button
            onClick={() => navigate("/equipment")}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800"
          >
            ← กลับไปหน้ารายการอุปกรณ์
          </button>
        </div>
      </div>
    );
  if (!item) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center mt-10">
        <p className="text-red-600 font-semibold text-xl">ไม่พบข้อมูลอุปกรณ์นี้</p>
        <button
          onClick={() => navigate("/equipment")}
          className="mt-4 px-6 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 transition"
        >
          ← กลับไปหน้ารายการอุปกรณ์
        </button>
      </div>
    );
  }

  const stock = Number(item?.stock ?? 0);
  const outOfStock = stock <= 0;

  const dec = () => setQty((q) => Math.max(1, q - 1));
  const inc = () => setQty((q) => Math.min(stock, q + 1));
  const onQtyChange = (e) => {
    const n = Number(e.target.value);
    if (!Number.isFinite(n)) return;
    setQty(Math.min(stock, Math.max(1, n)));
  };

  const handleAddToCart = () => {
    if (!item || outOfStock) return;
    addToCart({
      id: item.product_id,      // ให้ CartContext รวม id แบบ type-safe
      name: item.name,
      price: Number(item.price),
      image_url: item.image_url,
      quantity: qty,
      type: "equipment",        // ✅ บอกชนิดสินค้า
      stock: Number(item.stock),// ✅ ส่งสต๊อกไปด้วย (สำคัญ)
      category: item.category || "Equipment",
    });
    alert(`เพิ่ม ${item.name} จำนวน ${qty} ชิ้น ไปยังตะกร้าแล้ว!`);
  };

  const gallery = [item.image_url, item.image_url, item.image_url].filter(Boolean);

  return (
    <div className="container mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-12 gap-8">
      {/* Gallery ซ้าย */}
      <div className="md:col-span-2 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto">
        {gallery.map((img, idx) => (
          <img
            key={idx}
            src={img || "https://placehold.co/150x150?text=No+Image"}
            alt={`${item.name}-thumb-${idx}`}
            className={`w-24 h-24 object-cover rounded cursor-pointer border ${
              mainImg === img ? "border-black" : "hover:border-gray-400"
            }`}
            onClick={() => setMainImg(img)}
          />
        ))}
      </div>

      {/* รูปหลัก */}
      <div className="md:col-span-5 flex justify-center items-start">
        <img
          src={mainImg || "https://placehold.co/400x400?text=No+Image"}
          alt={item.name}
          className="rounded-lg w-full max-w-md object-contain"
        />
      </div>

      {/* รายละเอียด */}
      <div className="md:col-span-5">
        <h1 className="text-2xl font-bold mb-2">{item.name}</h1>
        <p className="text-xl font-bold mb-2">
          ราคา <span className="text-green-600">{(Number(item.price) || 0).toLocaleString()} บาท</span>
        </p>

        {/* ✅ ป้ายสต๊อก */}
        {outOfStock ? (
          <span className="inline-block mb-3 bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-sm font-medium">
            สินค้าหมด
          </span>
        ) : (
          <span className="inline-block mb-3 bg-slate-100 text-slate-800 px-3 py-1 rounded-full text-sm">
            คงเหลือ <b>{stock}</b> ชิ้น
          </span>
        )}

        <div className="bg-gray-50 p-4 rounded-lg mb-4 shadow">
          <h2 className="font-semibold mb-2">รายละเอียดสินค้า</h2>
          <p className="text-gray-700 leading-relaxed">
            {item.description || "ไม่มีรายละเอียดสินค้า"}
          </p>
        </div>

        {/* จำนวน + Add to cart (ล็อกตามสต๊อก) */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={dec}
            className="px-3 py-1 border rounded text-lg"
            disabled={outOfStock || qty <= 1}
            aria-label="decrease"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={stock}
            value={outOfStock ? 0 : qty}
            onChange={onQtyChange}
            className="w-16 h-10 rounded border text-center"
            disabled={outOfStock}
          />
          <button
            onClick={inc}
            className="px-3 py-1 border rounded text-lg"
            disabled={outOfStock || qty >= stock}
            aria-label="increase"
          >
            +
          </button>
        </div>

        <button
          onClick={handleAddToCart}
          className={`px-6 py-3 rounded-full w-full md:w-auto text-white font-medium ${
            outOfStock ? "bg-gray-400 cursor-not-allowed" : "bg-black hover:bg-gray-900"
          }`}
          disabled={outOfStock}
        >
          Add to Cart
        </button>

        <div className="mt-6">
          <Link
            to="/equipment"
            className="inline-block px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800"
          >
            ← กลับไปหน้ารายการอุปกรณ์
          </Link>
        </div>
      </div>
    </div>
  );
}
