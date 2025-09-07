// src/pages/SearchPage.jsx
import { useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";

export default function SearchPage() {
  const query = useQuery();
  const keyword = query.get("q") || "";
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!keyword) {
      setResults([]);
      return;
    }
    setLoading(true);
    setErr("");
    fetch(`${API_BASE}/api/search?q=${encodeURIComponent(keyword)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => setResults(Array.isArray(data) ? data : []))
      .catch((e) => {
        console.error("search error:", e);
        setErr("เกิดข้อผิดพลาดในการค้นหา");
      })
      .finally(() => setLoading(false));
  }, [keyword]);

  const hasData = results && results.length > 0;

  // ✅ ฟังก์ชัน map เส้นทางให้ตรงกับ App.jsx
  function getDetailPath(item) {
    // กระต่าย → /pets/:id
    if (item.kind === "rabbit") return `/pets/${item.id}`;

    // สินค้าทั่วไป: พยายามอ่านหมวดจากฟิลด์ทั่วไปที่ API อาจส่งมา
    const cat = String(item.category || item.type || item.product_type || "")
      .toLowerCase();

    if (cat.includes("equip") || cat === "equipment") return `/equipment/${item.id}`;
    if (cat.includes("food") || cat === "pet-food" || cat === "food") return `/pet-food/${item.id}`;

    // ถ้าไม่รู้หมวด ให้ fallback ไปที่อาหารก่อน (หรือเปลี่ยนเป็น /equipment ก็ได้)
    return `/pet-food/${item.id}`;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        ผลการค้นหา: "{keyword}"
      </h1>

      {loading && <p>กำลังค้นหา...</p>}
      {err && <p className="text-red-600">{err}</p>}

      {hasData ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((item) => {
            const detailPath = getDetailPath(item);

            return (
              <li
                key={`${item.kind || "product"}-${item.id}`}
                className="border rounded-lg bg-white shadow hover:shadow-lg transition"
              >
                <Link to={detailPath} className="flex gap-3 p-4 items-center">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded bg-gray-100" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold line-clamp-1">{item.name}</p>
                    {item.price != null && (
                      <p className="text-sm text-gray-600">
                        {Number(item.price).toLocaleString("th-TH")} บาท
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        !loading && <p>ไม่พบสินค้า</p>
      )}
    </div>
  );
}
