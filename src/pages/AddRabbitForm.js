// src/pages/AddRabbitForm.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";

export default function AddRabbitForm() {
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState(0);
  const [description, setDescription] = useState("");

  // ✅ ใหม่: น้ำหนัก (กก.)
  const [weight, setWeight] = useState("");

  // ✅ พ่อ/แม่พันธุ์
  const [isParent, setIsParent] = useState(false);
  const [parentRole, setParentRole] = useState(""); // 'sire' | 'dam'
  const [availableDate, setAvailableDate] = useState("");

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const handleImageUpload = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const okTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!okTypes.includes(f.type)) { alert("อัปโหลดได้เฉพาะไฟล์ jpg, png, webp"); e.target.value = ""; return; }
    if (f.size > 5 * 1024 * 1024) { alert("ขนาดไฟล์ต้องไม่เกิน 5MB"); e.target.value = ""; return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name?.trim()) { alert("กรอกชื่อกระต่าย"); return; }
    if (price === "" || Number(price) < 0) { alert("กรอกราคาให้ถูกต้อง (>= 0)"); return; }
    if (stock === "" || Number(stock) < 0 || !Number.isInteger(Number(stock))) {
      alert("กรอกสต๊อกเป็นจำนวนเต็มและไม่ติดลบ"); return;
    }
    if (isParent && !parentRole) { alert("เลือกบทบาทพ่อ/แม่พันธุ์"); return; }

    try {
      setSubmitting(true);

      let image_url = "";
      if (file) {
        const fd = new FormData();
        fd.append("profileImage", file);
        const up = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: fd });
        if (!up.ok) throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${await up.text()}`);
        const r = await up.json();
        image_url = r.url;
      }

      const payload = {
        name: name.trim(),
        breed: breed?.trim() || null,
        age: age ? Number(age) : null,
        gender,
        price: Number(price),
        stock: Number(stock),
        description: description?.trim() || null,
        image_url,
        status: "available",

        // ✅ ส่งน้ำหนักขึ้นไปด้วย (null ถ้าไม่กรอก)
        weight: weight === "" ? null : Number(weight),

        // ✅ พ่อ/แม่พันธุ์
        is_parent: Boolean(isParent),
        parent_role: isParent ? parentRole : null,
        available_date: availableDate || null,
      };

      const save = await fetch(`${API_BASE}/api/admin/rabbits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!save.ok) throw new Error(`บันทึกข้อมูลไม่สำเร็จ: ${await save.text()}`);

      alert("เพิ่มกระต่ายสำเร็จ");
      navigate("/manage-rabbits");
    } catch (err) {
      console.error(err);
      alert(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-10">
      <div className="bg-white shadow-lg rounded-xl p-8 w-full max-w-lg">
        <h1 className="text-2xl font-bold text-center mb-6">เพิ่มกระต่าย 🐇</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Upload */}
          <div className="flex justify-center">
            <label htmlFor="fileUpload" className="cursor-pointer">
              <input type="file" accept="image/*" onChange={handleImageUpload} hidden id="fileUpload" />
              <div className="w-40 h-40 border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden hover:border-green-500 transition">
                {preview ? <img src={preview} alt="Rabbit" className="w-full h-full object-cover" /> : <span className="text-4xl text-gray-400">+</span>}
              </div>
            </label>
          </div>

          {/* ชื่อ/พันธุ์/อายุ/เพศ/ราคา */}
          <div>
            <label className="block font-medium">ชื่อกระต่าย</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full border rounded-lg px-3 py-2" />
          </div>

          <div>
            <label className="block font-medium">พันธุ์กระต่าย</label>
            <input value={breed} onChange={(e) => setBreed(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" />
          </div>

          <div>
            <label className="block font-medium">อายุ (ปี)</label>
            <input value={age} onChange={(e) => setAge(e.target.value)} type="number" min="0" className="mt-1 w-full border rounded-lg px-3 py-2" />
          </div>

          <div>
            <label className="block font-medium mb-1">เพศ</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input type="radio" name="gender" value="male" checked={gender === "male"} onChange={(e) => setGender(e.target.value)} /> ♂ เพศผู้
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="gender" value="female" checked={gender === "female"} onChange={(e) => setGender(e.target.value)} /> ♀ เพศเมีย
              </label>
            </div>
          </div>

          <div>
            <label className="block font-medium">ราคา (บาท)</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" required className="mt-1 w-full border rounded-lg px-3 py-2" />
          </div>

          {/* สต๊อก */}
          <div>
            <label className="block font-medium">สต๊อก (จำนวนตัว)</label>
            <div className="flex gap-2">
              <input
                value={stock}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") return setStock("");
                  const n = Number(v);
                  if (Number.isInteger(n) && n >= 0) setStock(n);
                }}
                type="number"
                min="0"
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
              <button type="button" className="mt-1 px-3 rounded border hover:bg-gray-50" onClick={() => setStock((s) => Math.max(0, Number(s || 0) - 1))}>−1</button>
              <button type="button" className="mt-1 px-3 rounded border hover:bg-gray-50" onClick={() => setStock((s) => Number(s || 0) + 1)}>+1</button>
            </div>
          </div>

          {/* ✅ น้ำหนัก */}
          <div>
            <label className="block font-medium">น้ำหนัก (กก.)</label>
            <input
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              type="number"
              step="0.01"
              min="0"
              placeholder="เช่น 2.35"
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </div>

          {/* ✅ ส่วนพ่อ/แม่พันธุ์ */}
          <div className="border-t pt-4">
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" checked={isParent} onChange={(e) => setIsParent(e.target.checked)} />
              ใช้เป็น “พ่อ/แม่พันธุ์”
            </label>

            {isParent && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">บทบาท</label>
                  <select value={parentRole} onChange={(e) => setParentRole(e.target.value)} className="w-full border rounded-lg px-3 py-2" required={isParent}>
                    <option value="">เลือกบทบาท</option>
                    <option value="sire">พ่อพันธุ์ (sire)</option>
                    <option value="dam">แม่พันธุ์ (dam)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">วันที่พร้อมให้ยืม/ใช้งาน</label>
                  <input type="date" value={availableDate} onChange={(e) => setAvailableDate(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
            )}
          </div>

          {/* คำอธิบาย */}
          <div>
            <label className="block font-medium">คำอธิบาย</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="รายละเอียด/นิสัย/สุขภาพ ฯลฯ" className="mt-1 w-full border rounded-lg px-3 py-2" />
          </div>

          {/* Submit */}
          <button type="submit" disabled={submitting} className={`w-full py-3 rounded-lg text-white font-bold transition ${submitting ? "bg-green-300 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"}`}>
            {submitting ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
          </button>
        </form>
      </div>
    </div>
  );
}
