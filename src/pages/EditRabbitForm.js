// src/pages/EditRabbitForm.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";

export default function EditRabbitForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const rabbitId = useMemo(() => Number(id), [id]);

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
    stock: 0,

    // ✅ breeding fields
    is_parent: false,
    parent_role: "",
    available_date: "",
    weight: "",
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/rabbits/${rabbitId}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("ไม่พบกระต่าย");
          throw new Error(`โหลดข้อมูลไม่สำเร็จ (HTTP ${res.status})`);
        }
        const data = await res.json();
        if (!alive) return;

        setForm({
          name: data.name ?? "",
          breed: data.breed ?? "",
          age: data.age ?? "",
          gender: data.gender ?? "male",
          price: data.price ?? "",
          description: data.description ?? "",
          image_url: data.image_url ?? "",
          status: data.status ?? "available",
          stock: Number(data.stock ?? 0),

          // ✅ breeding fields
          is_parent: Boolean(data.is_parent),
          parent_role: data.parent_role ?? "",
          available_date: data.available_date ?? "",
          weight: data.weight ?? "",
        });
        setPreview(data.image_url || null);
      } catch (err) {
        alert(err.message || "เกิดข้อผิดพลาด");
        navigate("/manage-rabbits");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [rabbitId, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox") {
      setForm((p) => {
        const next = { ...p, [name]: checked };
        // ถ้าเลิกติ๊กเป็นพ่อ/แม่พันธุ์ ให้เคลียร์บทบาท/วันที่
        if (name === "is_parent" && !checked) {
          next.parent_role = "";
          next.available_date = "";
        }
        return next;
      });
      return;
    }

    if (name === "stock") {
      if (value === "") return setForm((p) => ({ ...p, stock: "" }));
      const n = Number(value);
      if (Number.isInteger(n) && n >= 0) {
        setForm((p) => ({ ...p, stock: n }));
      }
      return;
    }

    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleImageUpload = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!String(form.name).trim()) return alert("กรุณากรอกชื่อกระต่าย");
    if (form.price === "" || Number(form.price) < 0) return alert("กรุณากรอกราคา (>= 0)");
    if (form.stock === "" || Number(form.stock) < 0) return alert("กรุณากรอกสต๊อก (>= 0)");
    if (form.is_parent && !form.parent_role) return alert("เลือกบทบาทพ่อ/แม่พันธุ์");

    setSaving(true);
    try {
      let image_url = form.image_url;

      if (file) {
        const fd = new FormData();
        fd.append("profileImage", file);
        const up = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: fd });
        if (!up.ok) throw new Error("อัปโหลดรูปไม่สำเร็จ");
        const r = await up.json();
        image_url = r.url;
      }

      const payload = {
        name: String(form.name).trim(),
        breed: form.breed || null,
        age: form.age === "" ? null : Number(form.age),
        gender: form.gender || "male",
        price: Number(form.price),
        description: form.description || null,
        image_url,
        status: form.status || "available",
        stock: Number(form.stock),

        // ✅ breeding fields
        is_parent: Boolean(form.is_parent),
        parent_role: form.is_parent ? form.parent_role || null : null,
        available_date: form.is_parent ? (form.available_date || null) : null,
        weight: form.weight === "" ? null : Number(form.weight),
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
        {/* รูป */}
        <div className="flex flex-col items-center">
          <input type="file" accept="image/*" onChange={handleImageUpload} id="fileUpload" hidden />
          <div
            onClick={() => document.getElementById("fileUpload").click()}
            className="w-40 h-40 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden hover:border-pink-500"
          >
            {preview ? <img src={preview} alt="Preview" className="object-cover w-full h-full" /> : <span className="text-gray-400 text-3xl">+</span>}
          </div>
          <p className="text-gray-500 text-sm mt-2">คลิกเพื่อเปลี่ยนรูป</p>
        </div>

        <input name="name" value={form.name} onChange={handleChange} placeholder="ชื่อกระต่าย" className="w-full p-3 border rounded-lg" />
        <input name="breed" value={form.breed} onChange={handleChange} placeholder="สายพันธุ์" className="w-full p-3 border rounded-lg" />
        <input type="number" name="age" value={form.age} onChange={handleChange} placeholder="อายุ (ปี)" className="w-full p-3 border rounded-lg" min={0} />
        <select name="gender" value={form.gender} onChange={handleChange} className="w-full p-3 border rounded-lg">
          <option value="male">♂ เพศผู้</option>
          <option value="female">♀ เพศเมีย</option>
        </select>

        {/* ราคา/สต๊อก */}
        <input type="number" name="price" value={form.price} onChange={handleChange} placeholder="ราคา" className="w-full p-3 border rounded-lg" min={0} />
        <div className="flex items-center gap-2">
          <input type="number" name="stock" value={form.stock} onChange={handleChange} placeholder="สต๊อก" className="w-full p-3 border rounded-lg" min={0} />
          <button type="button" className="px-3 py-2 rounded border hover:bg-gray-50" onClick={() => setForm((p) => ({ ...p, stock: Math.max(0, Number(p.stock || 0) - 1) }))}>−1</button>
          <button type="button" className="px-3 py-2 rounded border hover:bg-gray-50" onClick={() => setForm((p) => ({ ...p, stock: Number(p.stock || 0) + 1 }))}>+1</button>
        </div>

        {/* น้ำหนัก (ถ้ามีการบันทึก) */}
        <input type="number" step="0.01" name="weight" value={form.weight} onChange={handleChange} placeholder="น้ำหนัก (กก.)" className="w-full p-3 border rounded-lg" />

        {/* พ่อ/แม่พันธุ์ */}
        <div className="border-t pt-4">
          <label className="flex items-center gap-2 font-medium">
            <input type="checkbox" name="is_parent" checked={form.is_parent} onChange={handleChange} />
            ใช้เป็น “พ่อ/แม่พันธุ์”
          </label>

          {form.is_parent && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">บทบาท</label>
                <select name="parent_role" value={form.parent_role} onChange={handleChange} className="w-full border rounded-lg px-3 py-2" required={form.is_parent}>
                  <option value="">เลือกบทบาท</option>
                  <option value="sire">พ่อพันธุ์ (sire)</option>
                  <option value="dam">แม่พันธุ์ (dam)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">วันที่พร้อมให้ยืม/ใช้งาน</label>
                <input type="date" name="available_date" value={form.available_date || ""} onChange={handleChange} className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
          )}
        </div>

        <textarea name="description" value={form.description || ""} onChange={handleChange} placeholder="รายละเอียด" className="w-full p-3 border rounded-lg" />
        <select name="status" value={form.status} onChange={handleChange} className="w-full p-3 border rounded-lg">
          <option value="available">พร้อมขาย</option>
          <option value="reserved">จองแล้ว</option>
          <option value="on_loan">กำลังยืม (breeding)</option>
          <option value="sold">ขายแล้ว</option>
        </select>

        <button type="submit" disabled={saving} className="w-full bg-green-500 text-white p-3 rounded-lg hover:bg-green-600 transition disabled:opacity-60">
          {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
        </button>
      </form>
    </div>
  );
}
