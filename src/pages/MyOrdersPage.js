// src/pages/MyOrdersPage.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";
const FALLBACK_IMG = "https://placehold.co/48x48?text=IMG";

const formatTHB = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(Number(n || 0));

const STATUS_TH = {
  pending: "รอดำเนินการ",
  ready_to_ship: "รอจัดส่ง",
  shipped: "จัดส่งแล้ว",
  done: "สำเร็จ",
  cancelled: "ยกเลิก",
};
const PAYMENT_TH = {
  unpaid: "ยังไม่ชำระ",
  submitted: "ส่งสลิปแล้ว",
  paid: "ชำระแล้ว",
  rejected: "สลิปถูกปฏิเสธ",
};

function PaymentBadge({ method, status }) {
  const color =
    status === "paid" ? "bg-emerald-100 text-emerald-700" :
    status === "submitted" ? "bg-amber-100 text-amber-700" :
    status === "rejected" ? "bg-rose-100 text-rose-700" :
    "bg-neutral-100 text-neutral-700";
  const methodTH = method === "cod" ? "เก็บเงินปลายทาง" : "โอน";
  const statusTH = PAYMENT_TH[status] || PAYMENT_TH.unpaid;
  return <span className={`px-2 py-0.5 text-xs rounded-full ${color}`}>{methodTH} • {statusTH}</span>;
}

function OrderBadge({ status }) {
  const color =
    status === "done" ? "bg-emerald-100 text-emerald-700" :
    status === "shipped" ? "bg-sky-100 text-sky-700" :
    status === "ready_to_ship" ? "bg-violet-100 text-violet-700" :
    status === "cancelled" ? "bg-rose-100 text-rose-700" :
    "bg-neutral-100 text-neutral-700";
  return <span className={`px-2 py-0.5 text-xs rounded-full ${color}`}>{STATUS_TH[status] || status}</span>;
}

export default function MyOrdersPage() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!user) {
      nav("/login", { state: { from: "/my-orders" } });
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/my-orders?buyer_id=${user.user_id}`);
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setErr("โหลดรายการคำสั่งซื้อไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, [user, nav]);

  const sortedAndFiltered = useMemo(() => {
    const sorted = [...rows].sort((a, b) => new Date(b.order_date) - new Date(a.order_date));
    if (statusFilter === "all") return sorted;
    return sorted.filter((o) => (o.status || "").toLowerCase() === statusFilter);
  }, [rows, statusFilter]);

  const summary = useMemo(() => {
    const totalOrders = rows.length;
    const totalAmount = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const byStatus = rows.reduce((acc, r) => {
      const k = (r.status || "unknown").toLowerCase();
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    return { totalOrders, totalAmount, byStatus };
  }, [rows]);

  const empty = !loading && sortedAndFiltered.length === 0;

  const FILTERS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "pending", label: STATUS_TH.pending },
    { key: "ready_to_ship", label: STATUS_TH.ready_to_ship },
    { key: "shipped", label: STATUS_TH.shipped },
    { key: "done", label: STATUS_TH.done },
    { key: "cancelled", label: STATUS_TH.cancelled },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <div className="text-sm text-neutral-500 mb-2">
        <Link to="/" className="hover:underline">หน้าแรก</Link> <span className="mx-1">/</span> คำสั่งซื้อของฉัน
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight mb-6">🧾 คำสั่งซื้อของฉัน</h1>

      {/* summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-white border rounded-2xl p-4">
          <div className="text-sm text-neutral-500">จำนวนคำสั่งซื้อ</div>
          <div className="text-2xl font-bold">{summary.totalOrders}</div>
        </div>
        <div className="bg-white border rounded-2xl p-4">
          <div className="text-sm text-neutral-500">ยอดใช้จ่ายรวม</div>
          <div className="text-2xl font-bold text-emerald-600">{formatTHB(summary.totalAmount)}</div>
        </div>
        <div className="bg-white border rounded-2xl p-4">
          <div className="text-sm text-neutral-500">สถานะล่าสุด</div>
          <div className="flex flex-wrap gap-2 mt-1 text-xs">
            {Object.entries(summary.byStatus).map(([k, v]) => (
              <span key={k} className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                {(STATUS_TH[k] || k)}: {v}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* filters */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1 rounded-xl border text-sm ${
              statusFilter === key ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="p-6 border rounded-2xl bg-white">กำลังโหลด...</div>}
      {err && <div className="p-3 border border-rose-200 bg-rose-50 text-rose-700 rounded-xl">{err}</div>}

      {empty ? (
        <div className="p-10 text-center border rounded-2xl bg-white">
          <p className="text-neutral-600">ไม่พบคำสั่งซื้อในสถานะนี้</p>
          <Link to="/" className="inline-block mt-3 px-4 py-2 rounded-xl border hover:bg-neutral-50">เริ่มช้อปเลย</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedAndFiltered.map((o) => (
            <Link
              key={o.order_id}
              to={`/orders/${o.order_id}`}
              className="block bg-white border rounded-2xl p-4 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">คำสั่งซื้อ #{o.order_id}</div>
                  <div className="text-xs text-neutral-500">
                    {new Date(o.order_date).toLocaleString("th-TH")} • {o.total_items} ชิ้น
                  </div>

                  {/* รูปสินค้าทั้งหมด */}
                  {Array.isArray(o.items) && o.items.length > 0 && (
                    <>
                      <div className="mt-2 flex flex-wrap gap-2">
      {o.items.map((it) => (
        <img
          key={it.order_detail_id}
          src={it.item_image || FALLBACK_IMG}
          alt={it.item_name || it.item_type}
          className="w-12 h-12 rounded-md object-cover border"
          onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }}
          title={it.item_name || it.item_type}
        />
      ))}
    </div>
    {/* รายการชื่อสินค้า + จำนวน (แสดงทุกชิ้น) */}
<ul className="mt-3 space-y-1">
  {o.items.map((it, idx) => (
    <li
      key={it.order_detail_id || `name-${idx}`}
      className="flex items-center gap-2 text-base font-semibold text-gray-900"
    >
      <span className="truncate">
        {it.item_name || it.item_type || "สินค้า"}
      </span>
      <span className="text-sm text-gray-500">× {Number(it.quantity || 1)}</span>
    </li>
  ))}
</ul>
  </>
)}
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <OrderBadge status={o.status} />
                  <PaymentBadge method={o.payment_method} status={o.payment_status} />
                  <div className="font-bold text-emerald-600 whitespace-nowrap">{formatTHB(o.total_amount)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
