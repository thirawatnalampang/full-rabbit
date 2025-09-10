// src/pages/EditRabbitForm.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";

export default function EditRabbitForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);

  const [form, setForm] = useState({
    name: "",
    breed: "",
    age: "",
    gender: "male",
    price: "",
    description: "",
    image_url: "",
    status: "available",
    stock: 0, // ✅ new
  });

  // ป้องกัน param แปลก ๆ
  const rabbitId = useMemo(() => Number(id), [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // ✅ ดึงกระต่ายตัวเดียว
        const res = await fetch(`${API_BASE}/api/admin/rabbits/${rabbitId}`);
        if (!res.ok) {
          // ถ้ายังไม่มี endpoint เดี่ยว จะลอง fallback ไปวิธีเดิม
          if (res.status === 404) throw new Error("ไม่พบกระต่าย");
          throw new Error(`โหลดข้อมูลไม่สำเร็จ (HTTP ${res.status})`);
        }
        const data = await res.json();
        if (!alive) return;

        // บาง db อาจเป็น string → แปลงให้เป็นชนิดที่ UI ต้องการ
        setForm({
          rabbit_id: data.rabbit_id,
          name: data.name ?? "",
          breed: data.breed ?? "",
          age: data.age ?? "",
          gender: data.gender ?? "male",
          price: data.price ?? "",
          description: data.description ?? "",
          image_url: data.image_url ?? "",
          status: data.status ?? "available",
          stock: Number(data.stock ?? 0), // ✅
        });
        setPreview(data.image_url || null);
      } catch (err) {
        alert(err.message || "เกิดข้อผิดพลาด");
        navigate("/manage-rabbits");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [rabbitId, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // กันค่าติดลบใน stock ที่หน้าบ้าน
    if (name === "stock") {
      const n = Number(value);
      if (!Number.isNaN(n) && n >= 0) {
        setForm((prev) => ({ ...prev, [name]: value }));
      } else if (value === "") {
        setForm((prev) => ({ ...prev, [name]: "" }));
      }
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    // ตรวจข้อมูลขั้นต่ำ
    if (!String(form.name).trim()) {
      alert("กรุณากรอกชื่อกระต่าย");
      return;
    }
    if (form.price === "" || Number(form.price) < 0) {
      alert("กรุณากรอกราคา (>= 0)");
      return;
    }
    if (form.stock === "" || Number(form.stock) < 0) {
      alert("กรุณากรอกสต๊อก (>= 0)");
      return;
    }

    setSaving(true);
    try {
      let image_url = form.image_url;

      // อัปโหลดรูปใหม่ถ้ามี
      if (file) {
        const fd = new FormData();
        // คีย์ตรงกับฝั่ง server ที่คุณใช้: 'profileImage'
        fd.append("profileImage", file);

        const up = await fetch(`${API_BASE}/api/upload`, {
          method: "POST",
          body: fd,
        });
        if (!up.ok) throw new Error("อัปโหลดรูปไม่สำเร็จ");
        const r = await up.json();
        image_url = r.url;
      }

      // แปลงฟิลด์ตัวเลขให้ชัดเจน
      const payload = {
        name: String(form.name).trim(),
        breed: form.breed || null,
        age: form.age === "" ? null : Number(form.age),
        gender: form.gender || "male",
        price: Number(form.price),
        description: form.description || null,
        image_url,
        status: form.status || "available",
        stock: Number(form.stock), // ✅ ส่งไปแก้สต๊อกด้วย
      };

      const res = await fetch(`${API_BASE}/api/admin/rabbits/${rabbitId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("อัปเดตไม่สำเร็จ");

      alert("แก้ไขข้อมูลสำเร็จ");
      navigate("/manage-rabbits");
    } catch (err) {
      alert(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-center mt-10">⏳ กำลังโหลด...</p>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-center text-pink-600 flex items-center justify-center gap-2">
        ✏️ แก้ไขข้อมูลกระต่าย
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 rounded-xl shadow-md">
        {/* อัปโหลดรูป */}
        <div className="flex flex-col items-center">
          <input type="file" accept="image/*" onChange={handleImageUpload} id="fileUpload" hidden />
          <div
            onClick={() => document.getElementById("fileUpload").click()}
            className="w-40 h-40 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden hover:border-pink-500"
          >
            {preview ? (
              <img src={preview} alt="Preview" className="object-cover w-full h-full" />
            ) : (
              <span className="text-gray-400 text-3xl">+</span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-2">คลิกเพื่อเปลี่ยนรูป</p>
        </div>

        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="ชื่อกระต่าย"
          className="w-full p-3 border rounded-lg"
        />
        <input
          name="breed"
          value={form.breed}
          onChange={handleChange}
          placeholder="สายพันธุ์"
          className="w-full p-3 border rounded-lg"
        />
        <input
          type="number"
          name="age"
          value={form.age}
          onChange={handleChange}
          placeholder="อายุ (ปี)"
          className="w-full p-3 border rounded-lg"
          min={0}
        />
        <select
          name="gender"
          value={form.gender}
          onChange={handleChange}
          className="w-full p-3 border rounded-lg"
        >
          <option value="male">♂ เพศผู้</option>
          <option value="female">♀ เพศเมีย</option>
        </select>
        <input
          type="number"
          name="price"
          value={form.price}
          onChange={handleChange}
          placeholder="ราคา"
          className="w-full p-3 border rounded-lg"
          min={0}
        />

        {/* ✅ ฟิลด์สต๊อก */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="stock"
            value={form.stock}
            onChange={handleChange}
            placeholder="สต๊อก"
            className="w-full p-3 border rounded-lg"
            min={0}
          />
          {/* ปุ่ม +1/-1 ช่วยปรับเร็ว */}
          <button
            type="button"
            className="px-3 py-2 rounded border hover:bg-gray-50"
            onClick={() => setForm((p) => ({ ...p, stock: Math.max(0, Number(p.stock || 0) - 1) }))}
          >
            −1
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded border hover:bg-gray-50"
            onClick={() => setForm((p) => ({ ...p, stock: Number(p.stock || 0) + 1 }))}
          >
            +1
          </button>
        </div>

        <textarea
          name="description"
          value={form.description || ""}
          onChange={handleChange}
          placeholder="รายละเอียด"
          className="w-full p-3 border rounded-lg"
        />
        <select
          name="status"
          value={form.status}
          onChange={handleChange}
          className="w-full p-3 border rounded-lg"
        >
          <option value="available">พร้อมขาย</option>
          <option value="reserved">จองแล้ว</option>
        </select>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-green-500 text-white p-3 rounded-lg hover:bg-green-600 transition disabled:opacity-60"
        >
          {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
        </button>
      </form>
    </div>
  );
}
