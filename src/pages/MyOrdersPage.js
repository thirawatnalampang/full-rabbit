// src/pages/MyOrdersPage.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FiRefreshCw,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiX,
  FiTruck,
  FiPackage,
  FiUpload,
} from "react-icons/fi";

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

// ---- utils ----
const cx = (...c) => c.filter(Boolean).join(" ");

const statusPillColor = (s) =>
  ({
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    ready_to_ship: "bg-violet-100 text-violet-800 border-violet-200",
    shipped: "bg-sky-100 text-sky-700 border-sky-200",
    done: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cancelled: "bg-rose-100 text-rose-700 border-rose-200",
  }[s] || "bg-neutral-100 text-neutral-700 border-neutral-200");

const payPillColor = (p) =>
  ({
    unpaid: "bg-neutral-100 text-neutral-800 border-neutral-200",
    submitted: "bg-amber-100 text-amber-800 border-amber-200",
    paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
    rejected: "bg-rose-100 text-rose-800 border-rose-200",
  }[p || "unpaid"]);

const ORDER_FLOW = ["pending", "ready_to_ship", "shipped", "done"];
const ORDER_FLOW_LABELS = ["รับคำสั่งซื้อ", "เตรียมจัดส่ง", "กำลังจัดส่ง", "สำเร็จ"];

/* ================= Tracking helpers ================= */
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

function TrackingBadge({ carrier, code, updatedAt }) {
  if (!code) return null;
  const url = trackingUrl(carrier, code);
  return (
    <div className="flex flex-col items-end gap-0.5 text-xs">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200"
        title="กดเพื่อดูสถานะพัสดุ"
      >
        <FiTruck className="shrink-0" /> {carrier ? `${carrier} • ` : ""}เลขพัสดุ:{" "}
        <span className="font-semibold">{code}</span>
      </a>
      {updatedAt ? (
        <span className="text-neutral-400">อัปเดต {new Date(updatedAt).toLocaleString("th-TH")}</span>
      ) : null}
    </div>
  );
}

/* ================= Badges ================= */
function PaymentBadge({ method, status }) {
  const methodTH = method === "cod" ? "ปลายทาง" : "โอน";
  const statusTH = PAYMENT_TH[status] || PAYMENT_TH.unpaid;
  const color = payPillColor(status || "unpaid");
  return (
    <span className={cx("px-2 py-0.5 text-xs rounded-full border inline-flex items-center gap-1", color)}>
      {status === "paid" ? <FiCheckCircle /> : status === "rejected" ? <FiX /> : <FiClock />}
      {methodTH} • {statusTH}
    </span>
  );
}

function OrderBadge({ status }) {
  return (
    <span className={cx("px-2 py-0.5 text-xs rounded-full border inline-flex items-center gap-1", statusPillColor(status))}>
      {status === "done" ? <FiCheckCircle /> : status === "cancelled" ? <FiX /> : <FiPackage />}
      {STATUS_TH[status] || status}
    </span>
  );
}

function OrderStepper({ status }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 text-rose-700 text-sm">
        <FiX /> คำสั่งซื้อถูกยกเลิก
      </div>
    );
  }
  const idx = Math.max(0, ORDER_FLOW.indexOf(status));
  return (
    <div className="flex items-center gap-3">
      {ORDER_FLOW_LABELS.map((label, i) => {
        const active = i <= idx;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cx(
                "w-6 h-6 rounded-full grid place-items-center text-xs border",
                active ? "bg-black text-white border-black" : "bg-white text-neutral-400 border-neutral-300"
              )}
            >
              {i + 1}
            </div>
            <div className={cx("text-xs", active ? "text-black font-medium" : "text-neutral-400")}>{label}</div>
            {i < ORDER_FLOW_LABELS.length - 1 && (
              <div className={cx("w-8 h-[2px]", active ? "bg-black" : "bg-neutral-200")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================= Page ================= */
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
        setErr("");
        const res = await fetch(`${API_BASE}/api/my-orders?buyer_id=${user.user_id}`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
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
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-5">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden border">
        <div className="bg-gradient-to-r from-black via-neutral-800 to-neutral-700 text-white px-6 py-5 flex items-center justify-between">
          <div>
            <div className="text-sm text-white/70 mb-1">
              <Link to="/" className="hover:underline">หน้าแรก</Link> <span className="mx-1">/</span> คำสั่งซื้อของฉัน
            </div>
            <h1 className="text-2xl font-bold tracking-tight">🧾 คำสั่งซื้อของฉัน</h1>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-3 h-10 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition"
            title="รีเฟรช"
          >
            <FiRefreshCw />
            รีเฟรช
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-6 bg-white">
          <SummaryCard title="จำนวนคำสั่งซื้อ" value={summary.totalOrders} />
          <SummaryCard title="ยอดใช้จ่ายรวม" value={<span className="text-emerald-600">{formatTHB(summary.totalAmount)}</span>} />
          <div className="rounded-xl border p-4">
            <div className="text-sm text-neutral-500">สถานะล่าสุด</div>
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              {Object.entries(summary.byStatus).map(([k, v]) => (
                <span key={k} className="px-2 py-0.5 rounded-full bg-neutral-50 border">
                  {(STATUS_TH[k] || k)}: <b>{v}</b>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filters - segmented */}
      <div className="w-full overflow-x-auto">
        <div className="inline-flex rounded-full border bg-white p-1 shadow-sm">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={cx("px-4 h-10 rounded-full text-sm transition",
                statusFilter === key ? "bg-black text-white shadow" : "hover:bg-neutral-50")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}
      {err && (
        <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
          <FiAlertCircle className="shrink-0" />
          <span className="text-sm">{err}</span>
        </div>
      )}

      {!loading && !err && (
        empty ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {sortedAndFiltered.map((o) => (
              <Link
                key={o.order_id}
                to={`/orders/${o.order_id}`}
                className="block bg-white border rounded-2xl p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold truncate">
                        คำสั่งซื้อ #{o.order_id}
                      </div>
                      <OrderBadge status={o.status} />
                      <PaymentBadge method={o.payment_method} status={o.payment_status} />
                    </div>

                    <div className="text-xs text-neutral-500 mt-0.5">
                      {new Date(o.order_date).toLocaleString("th-TH")} • {o.total_items} ชิ้น
                    </div>

                    <div className="mt-3">
                      <OrderStepper status={o.status} />
                    </div>

                    {/* รูปสินค้าทั้งหมด + รายชื่อ */}
                    {Array.isArray(o.items) && o.items.length > 0 && (
                      <>
                        <div className="mt-3 flex flex-wrap gap-2">
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
                        <ul className="mt-3 space-y-1">
                          {o.items.map((it, idx) => (
                            <li
                              key={it.order_detail_id || `name-${idx}`}
                              className="flex items-center gap-2 text-base font-semibold text-gray-900"
                            >
                              <span className="truncate">{it.item_name || it.item_type || "สินค้า"}</span>
                              <span className="text-sm text-gray-500">× {Number(it.quantity || 1)}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <TrackingBadge
                      carrier={o.carrier}
                      code={o.tracking_code}
                      updatedAt={o.tracking_updated_at}
                    />

                    {/* ปุ่มช่วยเหลืออัปสลิป (เฉพาะโอนและยังไม่ paid) */}
                    {o.payment_method !== "cod" &&
                      (o.payment_status === "unpaid" ||
                        o.payment_status === "submitted" ||
                        o.payment_status === "rejected" ||
                        !o.payment_status) && (
                        <a
                          href="/checkout" // TODO: ปรับเป็นหน้าที่อัปโหลดสลิปจริงของโปรเจกต์
                          className="inline-flex items-center gap-2 px-3 h-9 rounded-lg border bg-white hover:bg-neutral-50 text-sm"
                          onClick={(e) => e.stopPropagation()}
                          title="ไปอัปโหลดสลิป/ชำระเงิน"
                        >
                          <FiUpload />
                          อัปโหลดสลิป
                        </a>
                      )}

                    <div className="font-bold text-emerald-600 whitespace-nowrap">
                      {formatTHB(o.total_amount)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  );
}

/* ===== Subcomponents ===== */
function SummaryCard({ title, value }) {
  return (
    <div className="rounded-xl border p-4 bg-white shadow-sm hover:shadow-md transition">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="border rounded-2xl p-4 bg-white shadow-sm animate-pulse">
      <div className="flex gap-3">
        <div className="w-12 h-12 rounded-md bg-neutral-200" />
        <div className="flex-1">
          <div className="h-4 w-1/3 bg-neutral-200 rounded mb-2" />
          <div className="h-3 w-2/3 bg-neutral-200 rounded mb-1.5" />
          <div className="h-3 w-1/2 bg-neutral-200 rounded mb-3" />
          <div className="h-8 w-full bg-neutral-100 rounded" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-10 text-center border rounded-2xl bg-white">
      <div className="text-5xl mb-3">🛒</div>
      <h3 className="text-lg font-semibold">ไม่พบคำสั่งซื้อในสถานะนี้</h3>
      <p className="text-neutral-600 text-sm mt-1">เริ่มเลือกสินค้าถูกใจ แล้วย้อนกลับมาดูที่นี่ได้เลย</p>
      <Link to="/" className="inline-block mt-3 px-4 py-2 rounded-xl border hover:bg-neutral-50">
        เริ่มช้อปเลย
      </Link>
    </div>
  );
}
