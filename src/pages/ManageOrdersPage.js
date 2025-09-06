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

export default function ManageOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // slipPreview = { url, orderId } | null
  const [slipPreview, setSlipPreview] = useState(null);

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

  async function saveStatus(orderId, status, tracking) {
    try {
      await fetch(`${API_BASE}/api/admin/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, tracking }),
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
                      {o.tracking_number && (
                        <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                          📦 {o.tracking_number}
                        </span>
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

                      {/* ดูสลิป (โชว์เมื่อมี path) */}
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

                      {/* ปุ่มอนุมัติ/ปฏิเสธ: เฉพาะ non-COD และสถานะ submitted */}
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

              {/* ควบคุมสถานะ/เลขพัสดุ + ปุ่มบันทึก/สำเร็จ */}
              <div className="mt-3 flex flex-col md:flex-row gap-2">
                <select
                  defaultValue={o.status}
                  id={`status-${o.order_id}`}
                  className="border rounded px-3 py-2"
                >
                  {Object.keys(STATUS_LABELS).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>

                <input
                  type="text"
                  id={`track-${o.order_id}`}
                  className="border rounded px-3 py-2 flex-1"
                  placeholder="เลขพัสดุ"
                  defaultValue={o.tracking_number || ""}
                />

                <button
                  onClick={() => {
                    const st = document.getElementById(`status-${o.order_id}`).value;
                    const tr = document.getElementById(`track-${o.order_id}`).value.trim();
                    saveStatus(o.order_id, st, tr || null);
                  }}
                  className="px-4 py-2 bg-black text-white rounded hover:opacity-90"
                >
                  บันทึก
                </button>

                <button
                  onClick={() => saveStatus(o.order_id, "done", document.getElementById(`track-${o.order_id}`).value.trim() || o.tracking_number || null)}
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
              <button
                onClick={() => setSlipPreview(null)}
                className="px-3 py-2 rounded-lg border"
              >
                ปิด
              </button>
              {/* ใน modal ไม่รู้ payment_method ของออเดอร์นี้แน่ชัด จึงให้กดได้เฉพาะที่เปิดมาจาก non-COD (เราแสดงปุ่มดูสลิปเฉพาะที่มีสลิปอยู่แล้ว) */}
              <button
                onClick={async () => {
                  await setPayment(slipPreview.orderId, "reject");
                  setSlipPreview(null);
                }}
                className="px-3 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
              >
                ปฏิเสธสลิป
              </button>
              <button
                onClick={async () => {
                  await setPayment(slipPreview.orderId, "approve");
                  setSlipPreview(null);
                }}
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
