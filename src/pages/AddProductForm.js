import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";

export default function AddProductForm() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Pet food");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState(1);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleImageUpload = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!name || !price || !category) {
      alert("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    try {
      setSubmitting(true);

      // 1) Upload image (ถ้ามี)
      let image_url = "";
      if (file) {
        const fd = new FormData();
        fd.append("profileImage", file);
        const res = await fetch(`${API_BASE}/api/upload`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error("อัปโหลดรูปไม่สำเร็จ");
        const r = await res.json();
        image_url = r.url;
      }

      // 2) Save product
      const payload = {

        name,
        category,
        price: Number(price),
        stock: Number(stock),
        description: description || null,
        image_url,
        status: "available",
      };

      const save = await fetch(`${API_BASE}/api/admin/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!save.ok) throw new Error("บันทึกสินค้าไม่สำเร็จ");

      alert("เพิ่มสินค้าเรียบร้อย ✅");

      // 3) Redirect ไปหน้าจัดการสินค้า
      navigate("/manage-products");
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">➕ เพิ่มสินค้า</h1>

      {/* Upload image */}
      <div
        className="w-40 h-40 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer mb-4"
        onClick={() => document.getElementById("fileUpload").click()}
      >
        <input
          type="file"
          hidden
          id="fileUpload"
          accept="image/*"
          onChange={handleImageUpload}
        />
        {preview ? (
          <img
            src={preview}
            alt="preview"
            className="w-full h-full object-cover rounded-lg"
          />
        ) : (
          <span className="text-gray-400 text-3xl">+</span>
        )}
      </div>

      {/* Form fields */}
      <label className="block mb-2">ชื่อสินค้า</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border px-3 py-2 mb-4 rounded"
        placeholder=""
      />

      <label className="block mb-2">หมวดหมู่</label>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full border px-3 py-2 mb-4 rounded"
      >
        <option value="Pet food">Pet food</option>
        <option value="Equipment">Equipment</option>
      </select>

      <label className="block mb-2">ราคา (บาท)</label>
      <input
        type="number"
        min="0"
        step="1"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="w-full border px-3 py-2 mb-4 rounded"
        placeholder=""
      />

      <label className="block mb-2">สต๊อกสินค้า</label>
      <input
        type="number"
        min="0"
        step="1"
        value={stock}
        onChange={(e) => setStock(e.target.value)}
        className="w-full border px-3 py-2 mb-4 rounded"
        placeholder="จำนวนในคลัง"
      />

      <label className="block mb-2">รายละเอียดสินค้า</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full border px-3 py-2 mb-4 rounded"
        placeholder="เขียนรายละเอียดสินค้า..."
      />

      {/* Submit button (ปุ่มเดียว) */}
      <div className="mt-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded disabled:opacity-60"
        >
          {submitting ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </div>
  );
}
