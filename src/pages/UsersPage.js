// src/pages/admin/UsersPage.js
import React, { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // UI states
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [deletingId, setDeletingId] = useState(null);

  // โหลดข้อมูลผู้ใช้ทั้งหมด
  const loadUsers = useCallback(async () => {
    const ctl = new AbortController();
    try {
      setLoading(true);
      setErr(null);

      const res = await fetch(`${API_BASE}/api/admin/users`, {
        signal: ctl.signal,
        // ถ้าต้องแนบ token:
        // headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`โหลดผู้ใช้ล้มเหลว (${res.status})`);
      const data = await res.json();
      // คาดว่า data = [{id, username, email, role}, ...]
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      if (e.name !== "AbortError") setErr(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
    return () => ctl.abort();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // ค้นหา (client-side)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.id, u.username, u.email, u.role]
        .filter((x) => x !== null && x !== undefined)
        .map(String)
        .some((s) => s.toLowerCase().includes(q))
    );
  }, [users, query]);

  // แบ่งหน้า (client-side)
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * limit;
    return filtered.slice(start, start + limit);
  }, [filtered, safePage, limit]);

  // ลบผู้ใช้
  const deleteUser = async (id) => {
    if (!window.confirm("ยืนยันการลบผู้ใช้นี้หรือไม่?")) return;
    try {
      setDeletingId(id);
      const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
        method: "DELETE",
        // headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("ลบผู้ใช้ล้มเหลว");
      await res.json();
      // เอาออกจาก state ทันที
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (e) {
      alert(e.message || "เกิดข้อผิดพลาดในการลบ");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold">ผู้ใช้ทั้งหมด</h1>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="ค้นหา: ชื่อผู้ใช้ / อีเมล / role / ID"
            className="border rounded-lg px-3 py-2 w-72"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">ต่อหน้า</span>
            <select
              className="border rounded-lg px-2 py-2"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && <p>กำลังโหลด...</p>}
      {err && <p className="text-red-500">เกิดข้อผิดพลาด: {err}</p>}

      {!loading && !err && (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border p-2 text-left">ID</th>
                  <th className="border p-2 text-left">Username</th>
                  <th className="border p-2 text-left">Email</th>
                  <th className="border p-2 text-left">Role</th>
                  <th className="border p-2 text-center">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="border p-2">{u.id}</td>
                    <td className="border p-2">{u.username}</td>
                    <td className="border p-2">{u.email}</td>
                    <td className="border p-2">
                      <span
                        className={
                          "px-2 py-1 rounded text-xs font-semibold " +
                          (u.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700")
                        }
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="border p-2 text-center">
                      <button
                        onClick={() => deleteUser(u.id)}
                        disabled={deletingId === u.id}
                        className={`px-3 py-1 rounded text-white ${
                          deletingId === u.id
                            ? "bg-red-300 cursor-not-allowed"
                            : "bg-red-500 hover:bg-red-600"
                        }`}
                      >
                        {deletingId === u.id ? "กำลังลบ..." : "ลบ"}
                      </button>
                    </td>
                  </tr>
                ))}

                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-6 text-center text-gray-500">
                      ไม่พบผู้ใช้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              ทั้งหมด {filtered.length} รายการ • หน้า {safePage}/{totalPages}
            </p>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                ก่อนหน้า
              </button>
              <button
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                ถัดไป
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
