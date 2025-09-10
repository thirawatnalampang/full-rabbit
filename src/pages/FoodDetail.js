// src/pages/FoodDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";

export default function FoodDetail() {
  const { id } = useParams();
  const productId = useMemo(() => Number(id), [id]);
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [food, setFood] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch(`${API_BASE}/api/admin/products/${productId}`);
        if (!res.ok) throw new Error(`โหลดข้อมูลไม่สำเร็จ (HTTP ${res.status})`);
        const data = await res.json();
        setFood(data);
        const s = Number(data?.stock ?? 0);
        setQuantity(s > 0 ? 1 : 0); // ถ้าหมดสต๊อก → qty=0
      } catch (e) {
        console.error(e);
        setErr(e.message || "เกิดข้อผิดพลาด");
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  const stock = Number(food?.stock ?? 0);
  const outOfStock = stock <= 0;

  const dec = () => setQuantity((q) => Math.max(1, q - 1));
  const inc = () => setQuantity((q) => Math.min(stock, q + 1));
  const onQtyChange = (e) => {
    const n = Number(e.target.value);
    if (!Number.isFinite(n)) return;
    setQuantity(Math.min(stock, Math.max(1, n)));
  };

  const handleAddToCart = () => {
    if (!food || outOfStock) return;
    addToCart({
      // ให้ CartContext สร้าง id แบบ type-safe
      id: food.product_id,
      name: food.name,
      price: Number(food.price),
      image_url: food.image_url,
      quantity,
      type: "pet-food",       // ✅ ให้ตะกร้ารู้ว่าเป็นหมวดอาหาร
      stock: Number(food.stock), // ✅ สำคัญ: ส่ง stock ไปด้วยเพื่อคุมเพดาน
      category: food.category || "Pet food",
    });
    alert(`เพิ่ม ${food.name} จำนวน ${quantity} ชิ้น ไปยังตะกร้าแล้ว!`);
  };

  if (loading) return <p className="text-center p-8">กำลังโหลด...</p>;
  if (err) return <p className="text-center text-red-500 p-8">{err}</p>;
  if (!food) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center mt-10">
        <p className="text-red-600 font-semibold text-xl">ไม่พบข้อมูลสินค้าอาหารนี้</p>
        <button
          onClick={() => navigate("/pet-food")}
          className="mt-4 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          กลับไปหน้ารายการอาหาร
        </button>
      </div>
    );
  }

  const gallery = [food.image_url, food.image_url, food.image_url].filter(Boolean);

  return (
    <div className="container mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-12 gap-8">
      {/* Gallery ซ้าย */}
      <div className="md:col-span-2 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto">
        {gallery.map((img, idx) => (
          <img
            key={idx}
            src={img || "https://placehold.co/150x150?text=No+Image"}
            alt={`${food.name}-thumb-${idx}`}
            className="w-24 h-24 object-cover rounded cursor-pointer border hover:border-green-500"
          />
        ))}
      </div>

      {/* รูปหลัก */}
      <div className="md:col-span-5 flex justify-center items-start">
        <img
          src={food.image_url || "https://placehold.co/400x400?text=No+Image"}
          alt={food.name}
          className="rounded-lg w-full max-w-md object-contain"
        />
      </div>

      {/* รายละเอียด */}
      <div className="md:col-span-5">
        <h1 className="text-2xl font-bold mb-2">🐾 {food.name}</h1>
        <p className="text-xl font-bold mb-2">
          ราคา <span className="text-green-600">{Number(food.price).toLocaleString()} บาท</span>
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
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">
            {food.description || "ไม่มีรายละเอียดสินค้า"}
          </p>
        </div>

        {/* จำนวน + Add to cart (ล็อกตามสต๊อก) */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={dec}
            className="px-3 py-1 border rounded text-lg"
            disabled={outOfStock || quantity <= 1}
            aria-label="decrease"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={stock}
            value={outOfStock ? 0 : quantity}
            onChange={onQtyChange}
            className="w-16 h-10 rounded border text-center"
            disabled={outOfStock}
          />
          <button
            onClick={inc}
            className="px-3 py-1 border rounded text-lg"
            disabled={outOfStock || quantity >= stock}
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
            to="/pet-food"
            className="inline-block px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800"
          >
            ← กลับไปหน้ารายการอาหาร
          </Link>
        </div>
      </div>
    </div>
  );
}
