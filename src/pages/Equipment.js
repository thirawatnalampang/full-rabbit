import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3000';

export default function Equipment() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setErr(null);
        // ✅ backend ต้องรองรับ query ตาม category
        const res = await fetch(`${API_BASE}/api/admin/products?category=equipment`);
        if (!res.ok) throw new Error(`โหลดข้อมูลไม่สำเร็จ (HTTP ${res.status})`);
        const data = await res.json();
        setItems(data.items || data); // รองรับทั้งแบบ {items:[]} หรือ []
      } catch (e) {
        console.error('Fetch equipment error:', e);
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // คำนวณหน้า
  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  const lastIdx = currentPage * itemsPerPage;
  const firstIdx = lastIdx - itemsPerPage;
  const currentItems = items.slice(firstIdx, lastIdx);

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <p className="text-center mt-10">กำลังโหลด...</p>;
  if (err) return <p className="text-center text-red-500 mt-10">{err}</p>;
  if (!items.length) return <p className="text-center text-gray-500 mt-10">ยังไม่มีสินค้าอุปกรณ์ในระบบ</p>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8 text-center">อุปกรณ์กระต่าย</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
        {currentItems.map((item) => (
          <div
            key={item.product_id}
            className="border rounded-lg p-4 shadow hover:shadow-md transition text-center"
          >
            <img
  src={item.image_url || 'https://placehold.co/200x200?text=No+Image'}
  alt={item.name}
  className="w-full h-40 object-contain rounded-lg bg-white"
  onError={(e) => {
    e.currentTarget.src = 'https://placehold.co/200x200?text=No+Image';
  }}
/>
            <p className="mt-2 font-semibold">{item.name}</p>
            <p className="text-sm text-gray-600 mb-2">
              ราคา {Number(item.price || 0).toLocaleString()} บาท
            </p>
            <Link
              to={`/equipment/${item.product_id}`}
              className="inline-block px-4 py-1 bg-green-600 text-white rounded-full hover:bg-green-700 text-sm"
            >
              ดูรายละเอียด
            </Link>
          </div>
        ))}
      </div>

      {/* Pagination แบบเดียวกับ Pets/Food */}
      {items.length > itemsPerPage && (
        <div className="flex justify-center items-center space-x-2 mb-12">
          <button
            onClick={() => goToPage(currentPage - 1)}
            className="px-3 py-1 border rounded-full"
            disabled={currentPage === 1}
          >
            &laquo;
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => goToPage(p)}
              className={
                'px-3 py-1 border rounded-full ' +
                (currentPage === p ? 'bg-black text-white' : '')
              }
            >
              {p}
            </button>
          ))}

          <button
            onClick={() => goToPage(currentPage + 1)}
            className="px-3 py-1 border rounded-full"
            disabled={currentPage === totalPages}
          >
            &raquo;
          </button>
        </div>
      )}
    </div>
  );
}
