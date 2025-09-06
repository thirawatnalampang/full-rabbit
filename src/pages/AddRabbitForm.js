import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";

export default function AddRabbitForm() {
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState(""); // ✅ new
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  // เคลียร์ objectURL เวลา unmount หรือเปลี่ยนรูป
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleImageUpload = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // (ตัวเลือก) ตรวจสอบชนิดไฟล์/ขนาด ~5MB
    const okTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!okTypes.includes(f.type)) {
      alert("อัปโหลดได้เฉพาะไฟล์ jpg, png, webp");
      e.target.value = "";
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      alert("ขนาดไฟล์ต้องไม่เกิน 5MB");
      e.target.value = "";
      return;
    }

    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name?.trim() || price === "") {
      alert("กรอกชื่อและราคา");
      return;
    }

    try {
      setSubmitting(true);

      let image_url = "";
      if (file) {
        const fd = new FormData();
        fd.append("profileImage", file); // ให้ตรงกับ backend
        const up = await fetch(`${API_BASE}/api/upload`, {
          method: "POST",
          body: fd,
        });
        if (!up.ok) {
          const t = await up.text();
          throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${t}`);
        }
        const r = await up.json();
        image_url = r.url;
      }

      const payload = {
        name: name.trim(),
        breed: breed?.trim() || null,
        age: age ? Number(age) : null,
        gender,
        price: Number(price),
        description: description?.trim() || null, // ✅ ส่งค่าไปด้วย
        image_url,
        status: "available",
      };

      const save = await fetch(`${API_BASE}/api/admin/rabbits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!save.ok) {
        const t = await save.text();
        throw new Error(`บันทึกข้อมูลไม่สำเร็จ: ${t}`);
      }

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
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                hidden
                id="fileUpload"
              />
              <div className="w-40 h-40 border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden hover:border-green-500 transition">
                {preview ? (
                  <img
                    src={preview}
                    alt="Rabbit"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl text-gray-400">+</span>
                )}
              </div>
            </label>
          </div>

          {/* Name */}
          <div>
            <label className="block font-medium">ชื่อกระต่าย</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full border rounded-lg px-3 py-2 focus:ring focus:ring-green-300"
            />
          </div>

          {/* Breed */}
          <div>
            <label className="block font-medium">พันธุ์กระต่าย</label>
            <input
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 focus:ring focus:ring-green-300"
            />
          </div>

          {/* Age */}
          <div>
            <label className="block font-medium">อายุ (ปี)</label>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value)}
              type="number"
              min="0"
              className="mt-1 w-full border rounded-lg px-3 py-2 focus:ring focus:ring-green-300"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block font-medium mb-1">เพศ</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={gender === "male"}
                  onChange={(e) => setGender(e.target.value)}
                />
                ♂ เพศผู้
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={gender === "female"}
                  onChange={(e) => setGender(e.target.value)}
                />
                ♀ เพศเมีย
              </label>
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block font-medium">ราคา (บาท)</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min="0"
              required
              className="mt-1 w-full border rounded-lg px-3 py-2 focus:ring focus:ring-green-300"
            />
          </div>

          {/* Description ✅ */}
          <div>
            <label className="block font-medium">คำอธิบาย</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="รายละเอียด/นิสัย/สุขภาพ ฯลฯ"
              className="mt-1 w-full border rounded-lg px-3 py-2 focus:ring focus:ring-green-300"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3 rounded-lg text-white font-bold transition ${
              submitting
                ? "bg-green-300 cursor-not-allowed"
                : "bg-green-500 hover:bg-green-600"
            }`}
          >
            {submitting ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
          </button>
        </form>
      </div>
    </div>
  );
}
