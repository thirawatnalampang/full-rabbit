// src/pages/ParentsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import RabbitCard from "../components/RabbitCard";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";

function formatDateTH(d) {
  if (!d) return "-";
  const dt = new Date(d);
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(dt);
}

export default function ParentsPage() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const limit = 12;
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [gender, setGender] = useState(""); // '', 'male', 'female'
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const query = useMemo(() => {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (gender) qs.set("gender", gender);
    if (search) qs.set("search", search);
    return `${API_BASE}/api/parents?${qs.toString()}`;
  }, [page, limit, gender, search]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await fetch(query);
        if (!res.ok) throw new Error(`โหลดข้อมูลไม่สำเร็จ (HTTP ${res.status})`);
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (e) {
        setErr(e.message || "เกิดข้อผิดพลาด");
      } finally {
        setLoading(false);
      }
    })();
  }, [query]);

  const go = (p) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="p-6 mx-auto max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <h1 className="text-2xl font-bold">🐰 ข้อมูลพ่อ-แม่พันธุ์</h1>
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="ค้นหาชื่อกระต่าย"
            className="border rounded-lg px-3 py-2"
          />
          <select
            value={gender}
            onChange={(e) => { setPage(1); setGender(e.target.value); }}
            className="border rounded-lg px-3 py-2"
          >
            <option value="">ทั้งหมด</option>
            <option value="male">พ่อพันธุ์ (♂)</option>
            <option value="female">แม่พันธุ์ (♀)</option>
          </select>
        </div>
      </div>

      <p className="text-sm text-neutral-600 mb-3">
        ทั้งหมด {total} ตัว • หน้า {page}/{totalPages}
      </p>

      {loading && <p className="text-center text-neutral-500">กำลังโหลด...</p>}
      {err && <p className="text-center text-red-600">{err}</p>}

      {!loading && !err && (
        <>
          {items.length === 0 ? (
            <p className="text-center text-neutral-500">ยังไม่มีข้อมูลพ่อ-แม่พันธุ์</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {items.map((r) => {
                const display = {
                  _id: r.rabbit_id,
                  name: r.name,
                  nickname: r.nickname || "",
                  breed: r.breed || "-",
                  age: r.age ?? null,
                  weight: r.weight ?? null,
                  availableDate: r.available_date ? formatDateTH(r.available_date) : "-",
                  price: r.price ?? null,
                  gender: r.gender,
                  image: r.image_url,
                  parent_role: r.parent_role,
                  stock: r.stock ?? 0,
                  status: r.status,
                };

                const outOrOOS = (r.stock ?? 0) <= 0 || r.status === "out_of_stock";

                return (
                  <div key={r.rabbit_id} className="relative">
                    <RabbitCard rabbit={display} />
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span
                        className={`px-2 py-1 rounded ${
                          outOrOOS
                            ? "bg-red-100 text-red-700 border border-red-200"
                            : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {outOrOOS ? "หมดตัว" : `คงเหลือ: ${r.stock ?? 0}`}
                      </span>
                      {/* ลบสถานะออกตามที่ขอ */}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              <button onClick={() => go(1)} disabled={page === 1} className="h-9 min-w-9 px-3 rounded-full border disabled:opacity-50">⟪</button>
              <button onClick={() => go(page - 1)} disabled={page === 1} className="h-9 min-w-9 px-3 rounded-full border disabled:opacity-50">«</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => go(n)}
                  disabled={page === n}
                  className={`h-9 min-w-9 px-3 rounded-full border text-sm ${page === n ? "bg-black text-white" : "hover:bg-gray-100"}`}
                >
                  {n}
                </button>
              ))}
              <button onClick={() => go(page + 1)} disabled={page === totalPages} className="h-9 min-w-9 px-3 rounded-full border disabled:opacity-50">»</button>
              <button onClick={() => go(totalPages)} disabled={page === totalPages} className="h-9 min-w-9 px-3 rounded-full border disabled:opacity-50">⟫</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
