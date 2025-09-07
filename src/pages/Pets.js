// src/pages/Pets.jsx
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import PetCard from '../components/PetCard';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3000';

export default function Pets() {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const petsPerPage = 8;
  const location = useLocation(); // โหลดใหม่เมื่อกลับมาหน้านี้

  // --- helpers ---
  const normalizeArray = (data) => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.rows)) return data.rows;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  };

  const normalizeItem = (r) => ({
    rabbit_id: r.rabbit_id ?? r.id ?? r.rabbitId ?? r.RABBIT_ID,
    name: r.name ?? r.rabbit_name ?? r.title ?? '(ไม่มีชื่อ)',
    price: r.price ?? r.sale_price ?? 0,
    image_url: r.image_url ?? r.image ?? r.photo_url ?? '',
  });

  const fetchJSON = async (url) => {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
      },
      credentials: 'include', // เผื่อ endpoint admin ใช้ cookie/token
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json();
  };

  // --- main loader (useCallback เพื่อแก้ ESLint) ---
  const loadPets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1) ลอง admin ก่อน (เผื่อใช้งานหลังบ้าน)
      const adminUrl = `${API_BASE}/api/admin/rabbits?offset=0&limit=1000`;
      let data;
      try {
        data = await fetchJSON(adminUrl);
      } catch {
        // 2) ถ้า admin ใช้ไม่ได้ → fallback เป็น public
        const publicUrl = `${API_BASE}/api/rabbits`;
        data = await fetchJSON(publicUrl);
      }

      const arr = normalizeArray(data).map(normalizeItem);
      setPets(arr);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
      setError('โหลดข้อมูลไม่สำเร็จ');
      setPets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPets();
  }, [loadPets, location.key]); // ✅ ไม่มี warning แล้ว

  // --- pagination ---
  const totalPages = Math.ceil(pets.length / petsPerPage) || 1;
  const indexOfLastPet = currentPage * petsPerPage;
  const indexOfFirstPet = indexOfLastPet - petsPerPage;
  const currentPets = pets.slice(indexOfFirstPet, indexOfLastPet);

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- render ---
  if (loading) return <p className="text-center mt-10">กำลังโหลด...</p>;
  if (error)
    return (
      <div className="text-center mt-10">
        <p className="text-red-500">{error}</p>
        <button onClick={loadPets} className="mt-3 px-4 py-2 border rounded">
          ลองใหม่
        </button>
      </div>
    );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🐇 รายการกระต่าย</h1>
        <button
          onClick={loadPets}
          className="px-4 py-2 border rounded hover:bg-gray-50 active:scale-95 transition"
          title="รีเฟรช"
        >
          รีเฟรช
        </button>
      </div>

      {pets.length === 0 && (
        <p className="text-center text-gray-500">ยังไม่มีกระต่ายในระบบ</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
        {currentPets.map((pet) => (
          <PetCard
            key={pet.rabbit_id}
            pet={{
              id: pet.rabbit_id,
              name: pet.name,
              price: pet.price,
              image: pet.image_url || 'https://placehold.co/400x400?text=Rabbit',
            }}
          />
        ))}
      </div>

      {pets.length > petsPerPage && (
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
