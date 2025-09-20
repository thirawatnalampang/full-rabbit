// src/pages/Statistics.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { useAuth } from "../context/AuthContext";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";
const FALLBACK_IMG = "https://placehold.co/200x200?text=No+Image";
const THB = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(Number(n || 0));
const STATUS_TH = {
  pending: "รอดำเนินการ",
  ready_to_ship: "รอจัดส่ง",
  shipped: "จัดส่งแล้ว",
  done: "สำเร็จ",
  cancelled: "ยกเลิก",
};

function Img({ src, alt, className }) {
  const [err, setErr] = useState(false);
  return (
    <img
      src={err || !src ? FALLBACK_IMG : src}
      alt={alt}
      className={className}
      onError={() => setErr(true)}
    />
  );
}

export default function Statistics() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const { token } = useAuth() || {};

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/dashboard/stats`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) throw new Error("ต้องเข้าสู่ระบบ (แอดมิน)");
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        setPayload(data);
      } catch (e) {
        setError(e?.message || "โหลดข้อมูลไม่ได้");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const stats        = useMemo(() => payload?.stats ?? {}, [payload?.stats]);
  const salesByDay   = payload?.salesByDay ?? [];
  const recentOrders = payload?.recentOrders ?? [];
  const topProducts  = payload?.topProducts ?? [];

  const statCards = useMemo(
    () => [
      { label: "ยอดขายวันนี้", value: THB(stats.salesToday || 0) },
      { label: "ยอดขายเดือนนี้", value: THB(stats.salesMonth || 0) },
      { label: "ออเดอร์วันนี้", value: stats.ordersToday || 0 },
      { label: "ออเดอร์เดือนนี้", value: stats.ordersMonth || 0 },
      { label: "จำนวนสินค้า", value: stats.totalProducts || 0 },
      { label: "สินค้าใกล้หมด (≤5)", value: stats.lowStock || 0 },
      { label: "กระต่ายในระบบ", value: stats.totalRabbits || 0 },
    ],
    [stats.salesToday, stats.salesMonth, stats.ordersToday, stats.ordersMonth, stats.totalProducts, stats.lowStock, stats.totalRabbits]
  );

  if (loading) return <div className="p-8 text-center text-gray-600">กำลังโหลดสถิติ…</div>;
  if (error)   return <div className="p-8 text-center text-red-600">เกิดข้อผิดพลาด: {error}</div>;

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl md:text-3xl font-bold">📊 สถิติ</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        {statCards.map((s, i) => (
          <div key={i} className="rounded-2xl bg-white p-4 shadow hover:shadow-md transition">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* กราฟยอดขาย + รายการ Top */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Sales 7 days */}
        <div className="col-span-2 bg-white rounded-2xl p-4 shadow">
          <h2 className="font-semibold mb-3">ยอดขาย 7 วันล่าสุด</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesByDay}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v) => THB(v)} />
                <Area type="monotone" dataKey="total" strokeOpacity={1} fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

   {/* Top products (7 days) */}
<div className="bg-white rounded-2xl p-4 shadow">
  <h2 className="font-semibold mb-4">🔥 สินค้าขายดี (7 วันล่าสุด)</h2>
  
  <div className="h-60">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={topProducts}>
        <XAxis dataKey="name" hide />
        <YAxis allowDecimals={false} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload;
            return (
              <div className="bg-white rounded-lg shadow-lg p-2 text-xs">
                <div className="flex items-center gap-2">
                  <Img src={p.image} alt={p.name} className="w-10 h-10 rounded object-cover" />
                  <div>
                    <div className="font-semibold truncate max-w-[140px]">{p.name}</div>
                    <div className="text-gray-600">{p.sold_qty} ชิ้น • {THB(p.revenue)}</div>
                  </div>
                </div>
              </div>
            );
          }}
        />
        <Bar dataKey="sold_qty" radius={[6,6,0,0]}>
          <defs>
            <linearGradient id="barColor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" />   {/* orange-500 */}
              <stop offset="100%" stopColor="#facc15" /> {/* yellow-400 */}
            </linearGradient>
          </defs>
          <Bar dataKey="sold_qty" fill="url(#barColor)" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>

  {/* รายการแบบ card */}
  <ul className="mt-4 space-y-3">
    {topProducts.map((p, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}.`;
      return (
        <li
          key={p.product_id}
          className="flex items-center gap-3 rounded-lg border p-2 hover:shadow transition"
        >
          <span className="w-6 text-center">{medal}</span>
          <Img src={p.image} alt={p.name} className="w-10 h-10 rounded object-cover" />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{p.name}</div>
            <div className="h-2 bg-gray-100 rounded mt-1">
              <div
                className="h-full rounded bg-gradient-to-r from-orange-500 to-yellow-400"
                style={{ width: `${(p.sold_qty / topProducts[0].sold_qty) * 100}%` }}
              />
            </div>
          </div>
          <div className="text-xs text-gray-600 whitespace-nowrap text-right">
            {p.sold_qty} ชิ้น<br />{THB(p.revenue)}
          </div>
        </li>
      );
    })}
    {topProducts.length === 0 && (
      <li className="text-sm text-gray-500">ยังไม่มีข้อมูลสินค้าขายดี</li>
    )}
  </ul>
</div>
      </div>

      {/* ออเดอร์ล่าสุด (รวมสินค้าในคอลัมน์เดียว) */}
      <div className="bg-white rounded-2xl p-4 shadow">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">ออเดอร์ล่าสุด</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">เลขที่</th>
                <th className="py-2 pr-4">ลูกค้า</th>
                <th className="py-2 pr-4">สินค้า</th>
                <th className="py-2 pr-4">เวลา</th>
                <th className="py-2 pr-4">สถานะ</th>
                <th className="py-2 pr-4 text-right">ยอดรวม</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => {
                const thumbs = (o.items || []).slice(0, 3);
                const moreCnt = Math.max(0, (o.items?.length || 0) - thumbs.length);
                return (
                  <tr key={o.order_id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-4">#{o.order_id}</td>
                    <td className="py-2 pr-4">{o.buyer_name}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        {thumbs.map((it, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Img src={it.image} alt={it.name} className="w-8 h-8 rounded object-cover" />
                            <div className="text-xs text-gray-700 max-w-[140px] truncate">
                              {it.name} <span className="text-gray-500">×{it.qty}</span>
                            </div>
                          </div>
                        ))}
                        {moreCnt > 0 && (
                          <span className="text-xs text-gray-500">+{moreCnt} รายการ</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      {o.order_date ? new Date(o.order_date).toLocaleString("th-TH") : "—"}
                    </td>
                    <td className="py-2 pr-4">
  <span className="px-2 py-1 rounded bg-gray-100">
    {STATUS_TH[o.status] ?? "—"}
  </span>
</td>
                    <td className="py-2 pr-4 text-right">{THB(o.total_amount)}</td>
                  </tr>
                );
              })}
              {recentOrders.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-gray-500" colSpan={6}>
                    ยังไม่มีออเดอร์
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
