// src/pages/PetDetail.jsx
import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useCart } from "../context/CartContext";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";

export default function PetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const rabbitId = useMemo(() => Number(id), [id]);

  const [pet, setPet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [mainImg, setMainImg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // ✅ ดึงตัวเดียว
        const res = await fetch(`${API_BASE}/api/admin/rabbits/${rabbitId}`);
        if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
        const data = await res.json();
        setPet(data);
        setMainImg(data?.image_url || null);

        const stock = Number(data?.stock ?? 0);
        setQuantity(stock > 0 ? 1 : 0); // ถ้าหมดให้ qty=0 เพื่อปิดปุ่ม
      } catch (err) {
        console.error(err);
        setError(err.message || "เกิดข้อผิดพลาด");
      } finally {
        setLoading(false);
      }
    })();
  }, [rabbitId]);

  const handleAddToCart = () => {
    if (!pet) return;
    const stock = Number(pet.stock ?? 0);
    if (stock <= 0) return;

    addToCart({
  id: pet.rabbit_id,
  name: pet.name,
  price: Number(pet.price),
  image: pet.image_url,
  quantity,
  type: "rabbit",
  stock: Number(pet.stock),   // ✅ ต้องมีบรรทัดนี้
});
    alert(`เพิ่ม ${pet.name} จำนวน ${quantity} ชิ้น ไปยังตะกร้าแล้ว!`);
  };

  if (loading) return <p className="text-center mt-10 text-gray-500">กำลังโหลด...</p>;
  if (error)
    return <p className="text-center mt-10 text-red-500">เกิดข้อผิดพลาด: {error}</p>;
  if (!pet) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center mt-10">
        <p className="text-red-600 font-semibold text-xl">ไม่พบข้อมูลกระต่าย</p>
        <button
          onClick={() => navigate("/pets")}
          className="mt-4 px-6 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 transition"
        >
          ← กลับไปหน้ากระต่าย
        </button>
      </div>
    );
  }

  const stock = Number(pet.stock ?? 0);
  const outOfStock = stock <= 0;

  const dec = () => setQuantity((q) => Math.max(1, q - 1));
  const inc = () => setQuantity((q) => Math.min(stock, q + 1));
  const onQtyChange = (e) => {
    const n = Number(e.target.value);
    if (Number.isFinite(n)) setQuantity(Math.min(stock, Math.max(1, n)));
  };

  // mock gallery (ถ้ามี images[] จริงให้เปลี่ยนมาจาก backend ได้)
  const gallery = [pet.image_url, pet.image_url, pet.image_url].filter(Boolean);

  return (
    <div className="container mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-12 gap-8">
      {/* Gallery ซ้าย */}
      <div className="md:col-span-2 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto">
        {gallery.map((img, idx) => (
          <img
            key={idx}
            src={img || "https://placehold.co/150x150?text=Rabbit"}
            alt={`${pet.name}-thumb-${idx}`}
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
          src={mainImg || "https://placehold.co/400x400?text=Rabbit"}
          alt={pet.name}
          className="rounded-lg w-full max-w-md object-contain"
        />
      </div>

      {/* รายละเอียด */}
      <div className="md:col-span-5">
        <h1 className="text-2xl font-bold mb-2">
          🐰 {pet.name} • {pet.breed || "ไม่ระบุ"} •{" "}
          {pet.gender === "female" ? "♀ เพศเมีย" : "♂ เพศผู้"}
        </h1>

        <p className="text-xl font-bold mb-3">
          ราคา <span className="text-green-600">{Number(pet.price).toLocaleString()} บาท</span>
        </p>

        {/* ✅ ป้ายคงเหลือ / สินค้าหมด */}
        {outOfStock ? (
          <span className="inline-block mb-3 bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-sm font-medium">
            สินค้าหมด
          </span>
        ) : (
          <span className="inline-block mb-3 bg-slate-100 text-slate-800 px-3 py-1 rounded-full text-sm">
            คงเหลือ <b>{stock}</b> ตัว
          </span>
        )}

        <div className="bg-gray-50 p-4 rounded-lg mb-4 shadow">
          <h2 className="font-semibold mb-2">รายละเอียดสินค้า</h2>
          <p className="text-gray-700 leading-relaxed">
            {pet.description || "กระต่ายน่ารัก สุขภาพดี พร้อมหาบ้านใหม่ 🐇"}
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
          🛒 Add to Cart
        </button>

        <div className="mt-6">
          <Link
            to="/pets"
            className="inline-block px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800"
          >
            ← กลับไปหน้ากระต่าย
          </Link>
        </div>
      </div>
    </div>
  );
}
