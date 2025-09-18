// src/pages/ManageRabbits.jsx
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";

function formatTHB(n) {
  const num = typeof n === "number" ? n : Number(n);
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(num || 0);
}

export default function ManageRabbits() {
  const [rabbits, setRabbits] = useState([]);
  const [page, setPage] = useState(1);
  const limit = 5;
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // 🟢 state สำหรับ search & filter
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState("");
  const [category, setCategory] = useState(""); // 🐇 หมวด: ขาย หรือ ยืม

  const loadData = useCallback(
    async (p = page) => {
      try {
        setLoading(true);
        setErr(null);

        const params = new URLSearchParams({
          page: p,
          limit,
        });
        if (search) params.append("q", search);
        if (gender) params.append("gender", gender);
        if (category) params.append("category", category);

        const res = await fetch(`${API_BASE}/api/admin/rabbits?${params.toString()}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`โหลดข้อมูลไม่สำเร็จ (HTTP ${res.status}) ${text}`);
        }
        const data = await res.json();
        setRabbits(data.items || []);
        const t =
          data.totalPages ??
          (data.total ? Math.ceil(Number(data.total) / limit) : null) ??
          (data.count ? Math.ceil(Number(data.count) / limit) : 1);
        setTotalPages(t || 1);
        setTotal(data.total ?? data.count ?? (data.items?.length || 0));
      } catch (e) {
        console.error("Fetch rabbits error:", e);
        setErr(e.message || "Failed to fetch");
      } finally {
        setLoading(false);
      }
    },
    [page, search, gender, category]
  );

  useEffect(() => {
    loadData(page);
  }, [page, loadData]);

  async function handleDelete(id) {
    if (!window.confirm("ลบรายการนี้?")) return;
    const prev = rabbits;
    setRabbits(prev.filter((r) => r.rabbit_id !== id));
    try {
      const res = await fetch(`${API_BASE}/api/admin/rabbits/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`ลบไม่สำเร็จ (HTTP ${res.status}) ${t}`);
      }
      loadData(page);
    } catch (e) {
      alert(e.message || "ลบไม่สำเร็จ");
      setRabbits(prev);
    }
  }

  const genderTH = (g) => {
    if (!g) return "";
    const low = String(g).toLowerCase();
    return low === "male" || low === "m" ? "เพศผู้" : low === "female" || low === "f" ? "เพศเมีย" : g;
  };

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto w-full max-w-screen-md px-3 md:px-6 py-6">
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 px-3 py-2 bg-pink-50 rounded shadow w-fit">
        🐇 จัดการกระต่าย
      </h1>

      {/* ✅ Search + Filter */}
      <div className="flex flex-col md:flex-row gap-3 mb-5 md:mb-8">
        <input
          type="text"
          placeholder="🔍 ค้นหาชื่อหรือสายพันธุ์..."
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          className="flex-1 px-3 py-2 border rounded"
        />

        <select
          value={gender}
          onChange={(e) => {
            setPage(1);
            setGender(e.target.value);
          }}
          className="px-3 py-2 border rounded"
        >
          <option value="">เพศทั้งหมด</option>
          <option value="male">เพศผู้</option>
          <option value="female">เพศเมีย</option>
        </select>

        <select
          value={category}
          onChange={(e) => {
            setPage(1);
            setCategory(e.target.value);
          }}
          className="px-3 py-2 border rounded"
        >
          <option value="">หมวดทั้งหมด</option>
          <option value="sale">ขาย</option>
          <option value="loan">ยืม</option>
        </select>
      </div>

      {/* แถบสรุป */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 md:mb-8">
        <span className="bg-pink-100 px-3 py-2 rounded-full text-sm md:text-base w-full sm:w-auto text-center sm:text-left">
          🐇 ทั้งหมด {total} ตัว • แสดง {rabbits.length}/{limit} • หน้า {page}/{totalPages}
        </span>
        <Link
          to="/add-rabbit"
          className="bg-orange-400 hover:bg-orange-500 text-white px-4 py-2 rounded shadow text-center"
        >
          + เพิ่มกระต่าย
        </Link>
      </div>

      {loading && <p className="text-gray-500 text-center">กำลังโหลด...</p>}
      {err && <p className="text-red-500 text-center">{err}</p>}
      {!loading && !err && rabbits.length === 0 && (
        <p className="text-gray-400 italic text-center">ยังไม่มีกระต่ายในระบบ</p>
      )}

      {/* ✅ List Rabbits */}
      <div className="space-y-3 md:space-y-4">
        {rabbits.map((r) => (
          <div key={r.rabbit_id} className="rounded-2xl border bg-white p-3 sm:p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <img
                src={r.image_url || "https://placehold.co/200x200?text=Rabbit"}
                alt={r.name}
                className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-lg object-cover flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.src = "https://placehold.co/200x200?text=Rabbit";
                }}
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm sm:text-base break-words">
                  ชื่อ {r.name} • สายพันธุ์ {r.breed || "-"} • {genderTH(r.gender)}
                </p>
                <p className="text-xs sm:text-sm text-gray-700">
                  อายุ {r.age ?? "-"} ปี • ราคา {formatTHB(r.price)} • สถานะ {r.status || "—"}
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  หมวด: {r.category === "loan" ? "ยืม" : "ขาย"}
                </p>
              </div>
              <div className="flex w-full sm:w-auto gap-2 sm:ml-auto">
                <Link
                  to={`/edit-rabbit/${r.rabbit_id}`}
                  className="flex-1 sm:flex-none px-3 py-2 text-sm bg-blue-500 text-white rounded shadow hover:bg-blue-600 text-center"
                >
                  แก้ไข
                </Link>
                <button
                  onClick={() => handleDelete(r.rabbit_id)}
                  className="flex-1 sm:flex-none px-3 py-2 text-sm bg-red-500 text-white rounded shadow hover:bg-red-600"
                >
                  ลบ
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          <button onClick={() => goToPage(1)} disabled={page === 1} className="h-9 min-w-9 px-3 rounded-full border disabled:opacity-50">⟪</button>
          <button onClick={() => goToPage(page - 1)} disabled={page === 1} className="h-9 min-w-9 px-3 rounded-full border disabled:opacity-50">«</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => goToPage(n)}
              disabled={page === n}
              className={`h-9 min-w-9 px-3 rounded-full border text-sm ${
                page === n ? "bg-black text-white cursor-not-allowed" : "hover:bg-gray-100"
              }`}
            >
              {n}
            </button>
          ))}
          <button onClick={() => goToPage(page + 1)} disabled={page === totalPages} className="h-9 min-w-9 px-3 rounded-full border disabled:opacity-50">»</button>
          <button onClick={() => goToPage(totalPages)} disabled={page === totalPages} className="h-9 min-w-9 px-3 rounded-full border disabled:opacity-50">⟫</button>
        </div>
      )}
    </div>
  );
}
