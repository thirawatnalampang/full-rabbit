// src/pages/ManageOrdersPage.jsx
import { useEffect, useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";
const formatTHB = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(Number(n || 0));

const STATUS_LABELS = {
  pending: "รอดำเนินการ",
  ready_to_ship: "รอจัดส่ง",
  shipped: "จัดส่งแล้ว",
  done: "สำเร็จ",
  cancelled: "ยกเลิก",
};
const PAY_LABELS = {
  unpaid: "ยังไม่ชำระ",
  submitted: "ส่งสลิปแล้ว",
  paid: "ชำระแล้ว",
  rejected: "สลิปถูกปฏิเสธ",
};
const FALLBACK_IMG = "https://placehold.co/64x64?text=IMG";

// รายชื่อขนส่งยอดนิยม
const CARRIERS = [
  { key: "", label: "— เลือกขนส่ง —" },
  { key: "thailand_post", label: "Thailand Post" },
  { key: "kerry", label: "Kerry" },
  { key: "jnt", label: "J&T" },
  { key: "flash", label: "Flash" },
];

// สร้างลิงก์ติดตามตาม Carrier
const trackingUrl = (carrier, code) => {
  if (!code) return null;
  const c = String(carrier || "").toLowerCase();
  const q = encodeURIComponent(code);
  if (c.includes("kerry")) return `https://th.kerryexpress.com/th/track/?track=${q}`;
  if (c.includes("thai") || c.includes("ems")) return `https://track.thailandpost.co.th/?trackNumber=${q}`;
  if (c.includes("j&t") || c.includes("jnt")) return `https://www.jtexpress.co.th/index/query/gzquery.html?billcode=${q}`;
  if (c.includes("flash")) return `https://www.flashexpress.com/fle/tracking?se=${q}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier || ""} ${code}`)}`;
};

export default function ManageOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slipPreview, setSlipPreview] = useState(null); // { url, orderId } | null

  async function fetchOrders() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/orders`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("fetch orders error:", err);
    } finally {
      setLoading(false);
    }
  }

  // ⛳️ บันทึกสถานะ/ขนส่ง/เลขพัสดุ (ใช้ฟิลด์ใหม่)
  async function saveStatus(orderId, status, carrier, tracking_code) {
    try {
      await fetch(`${API_BASE}/api/admin/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, carrier, tracking_code }),
      });
      fetchOrders();
    } catch (e) {
      console.error("saveStatus error:", e);
    }
  }

  async function setPayment(orderId, action) {
    try {
      await fetch(`${API_BASE}/api/admin/orders/${orderId}/payment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }), // 'approve'|'reject'
      });
      fetchOrders();
    } catch (e) {
      console.error("setPayment error:", e);
    }
  }

  useEffect(() => { fetchOrders(); }, []);

  if (loading) return <div className="p-6">กำลังโหลด...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-extrabold mb-4">📦 จัดการคำสั่งซื้อ</h1>

      {orders.length === 0 ? (
        <div className="p-6 text-center text-gray-500">ไม่มีคำสั่งซื้อ</div>
      ) : (
        <div className="space-y-5">
          {orders.map((o) => (
            <div key={o.order_id} className="bg-white border rounded-2xl p-4 shadow-sm">
              {/* Header */}
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <div className="text-lg font-semibold">คำสั่งซื้อ #{o.order_id}</div>
                  <div className="text-sm text-gray-500">
                    {new Date(o.order_date).toLocaleString("th-TH")}
                  </div>
                  <div className="text-sm text-gray-700 mt-1">
                    👤 {o.contact_full_name} • {o.contact_phone}
                  </div>

                  {/* Badges */}
                  <div className="mt-2 text-sm space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">สถานะคำสั่งซื้อ:</span>
                      <span className={badgeClassByStatus(o.status)}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>

                      {/* ✅ ใช้ฟิลด์ใหม่ carrier + tracking_code */}
                      {o.tracking_code && (
                        <a
                          className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200"
                          href={trackingUrl(o.carrier, o.tracking_code)}
                          target="_blank"
                          rel="noreferrer"
                          title="ดูสถานะพัสดุ"
                        >
                          📦 {o.carrier ? `${o.carrier} • ` : ""}{o.tracking_code}
                        </a>
                      )}
                    </div>

                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-medium">การชำระเงิน:</span>
                      <span className={badgeClassByPayment(o.payment_status)}>
                        {PAY_LABELS[o.payment_status] || o.payment_status}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                        วิธี: {o.payment_method === "cod" ? "เก็บเงินปลายทาง (COD)" : "โอน/พร้อมเพย์"}
                      </span>

                      {o.payment_slip_path && (
                        <button
                          onClick={() =>
                            setSlipPreview({ url: `${API_BASE}${o.payment_slip_path}`, orderId: o.order_id })
                          }
                          className="text-sky-600 underline"
                        >
                          ดูสลิป
                        </button>
                      )}

                      {o.payment_method !== "cod" && o.payment_status === "submitted" && (
                        <>
                          <button
                            onClick={() => setPayment(o.order_id, "approve")}
                            className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            ✅ ยืนยันรับเงิน
                          </button>
                          <button
                            onClick={() => setPayment(o.order_id, "reject")}
                            className="px-3 py-1 rounded bg-rose-600 text-white hover:bg-rose-700"
                          >
                            🛑 ปฏิเสธสลิป
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-lg font-bold text-emerald-600 shrink-0">
                  {formatTHB(o.total_amount)}
                </div>
              </div>

              {/* รายการสินค้า */}
              <div className="mt-3 border-t pt-3 space-y-2">
                {o.items?.map((it) => (
                  <div key={it.order_detail_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={it.item_image || FALLBACK_IMG}
                        onError={(e)=>{e.currentTarget.src = FALLBACK_IMG}}
                        alt={it.item_name || it.item_type}
                        className="w-14 h-14 rounded-lg object-cover border"
                      />
                      <div className="text-sm min-w-0">
                        <div className="font-medium truncate">
                          {it.item_name || `${it.item_type} #${it.item_id}`}
                        </div>
                        <div className="text-gray-500">x{it.quantity}</div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
                      {formatTHB((it.price || 0) * (it.quantity || 0))}
                    </div>
                  </div>
                ))}
              </div>

              {/* ควบคุมสถานะ/ขนส่ง/เลขพัสดุ */}
              <div className="mt-3 flex flex-col md:flex-row gap-2">
                <select defaultValue={o.status} id={`status-${o.order_id}`} className="border rounded px-3 py-2">
                  {Object.keys(STATUS_LABELS).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>

                {/* ✅ carrier */}
                <select
                  defaultValue={o.carrier || ""}
                  id={`carrier-${o.order_id}`}
                  className="border rounded px-3 py-2"
                  title="บริษัทขนส่ง"
                >
                  {CARRIERS.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>

                {/* ✅ tracking_code */}
                <input
                  type="text"
                  id={`track-${o.order_id}`}
                  className="border rounded px-3 py-2 flex-1"
                  placeholder="เลขพัสดุ"
                  defaultValue={o.tracking_code || ""}
                />

                <button
                  onClick={() => {
                    const st = document.getElementById(`status-${o.order_id}`).value;
                    const cr = document.getElementById(`carrier-${o.order_id}`).value;
                    const tr = document.getElementById(`track-${o.order_id}`).value.trim() || null;
                    saveStatus(o.order_id, st, cr || null, tr);
                  }}
                  className="px-4 py-2 bg-black text-white rounded hover:opacity-90"
                >
                  บันทึก
                </button>

                <button
                  onClick={() => {
                    const cr = document.getElementById(`carrier-${o.order_id}`).value;
                    const tr = document.getElementById(`track-${o.order_id}`).value.trim() || o.tracking_code || null;
                    saveStatus(o.order_id, "done", cr || null, tr);
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  title="ทำออเดอร์นี้เป็นสำเร็จ (ถ้าเป็น COD ระบบจะติ๊กจ่ายเงินให้เอง)"
                >
                  ทำเป็นสำเร็จ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal ดูสลิป + อนุมัติ/ปฏิเสธ */}
      {slipPreview && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setSlipPreview(null)}
        >
          <div
            className="bg-white rounded-2xl p-4 w-full max-w-xl shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-bold">สลิปการโอน</div>
              <button
                className="text-neutral-500 hover:text-neutral-700"
                onClick={() => setSlipPreview(null)}
              >
                ✕
              </button>
            </div>

            <img
              src={slipPreview.url}
              alt="slip"
              className="max-h-[70vh] w-full object-contain rounded"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setSlipPreview(null)} className="px-3 py-2 rounded-lg border">ปิด</button>
              <button
                onClick={async () => { await setPayment(slipPreview.orderId, "reject"); setSlipPreview(null); }}
                className="px-3 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
              >
                ปฏิเสธสลิป
              </button>
              <button
                onClick={async () => { await setPayment(slipPreview.orderId, "approve"); setSlipPreview(null); }}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              >
                ยืนยันรับเงิน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */
function badgeClassByStatus(status) {
  switch (status) {
    case "pending": return "px-2 py-0.5 rounded bg-amber-100 text-amber-800";
    case "ready_to_ship": return "px-2 py-0.5 rounded bg-sky-100 text-sky-800";
    case "shipped": return "px-2 py-0.5 rounded bg-blue-100 text-blue-800";
    case "done": return "px-2 py-0.5 rounded bg-emerald-100 text-emerald-800";
    case "cancelled": return "px-2 py-0.5 rounded bg-rose-100 text-rose-800";
    default: return "px-2 py-0.5 rounded bg-gray-100 text-gray-800";
  }
}
function badgeClassByPayment(pay) {
  switch (pay) {
    case "unpaid": return "px-2 py-0.5 rounded bg-gray-100 text-gray-800";
    case "submitted": return "px-2 py-0.5 rounded bg-amber-100 text-amber-800";
    case "paid": return "px-2 py-0.5 rounded bg-emerald-100 text-emerald-800";
    case "rejected": return "px-2 py-0.5 rounded bg-rose-100 text-rose-800";
    default: return "px-2 py-0.5 rounded bg-gray-100 text-gray-800";
  }
}
