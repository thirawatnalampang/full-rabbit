// src/pages/MyLoansPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  FiRefreshCw,
  FiTruck,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiX,
  FiBox,
  FiUpload,
} from "react-icons/fi";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";

const THAI = {
  requested: "รอดำเนินการ",
  approved: "อนุมัติแล้ว",
  on_loan: "กำลังยืม",
  returned: "ส่งคืนแล้ว",
  cancelled: "ยกเลิก",
};

const PAY_STATUS_TH = {
  null: "ยังไม่ชำระ",
  pending: "รอตรวจ",
  submitted: "ส่งสลิปแล้ว",
  paid: "ชำระแล้ว",
  rejected: "สลิปไม่ผ่าน",
};

const STATUS_ORDER = ["requested", "approved", "on_loan", "returned"]; // cancelled แยกออก
const STEP_LABELS = ["ยื่นคำขอ", "อนุมัติ", "กำลังยืม", "ส่งคืนแล้ว"];

const getUserId = (user) =>
  user?.user_id ??
  JSON.parse(localStorage.getItem("user") || "{}")?.user_id ??
  null;

const money = (x) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(
    Number(x || 0)
  );

// -------- Small UI helpers --------
const cx = (...c) => c.filter(Boolean).join(" ");

const statusColor = (s) =>
  ({
    requested: "bg-amber-100 text-amber-800 border-amber-200",
    approved: "bg-blue-100 text-blue-800 border-blue-200",
    on_loan: "bg-violet-100 text-violet-800 border-violet-200",
    returned: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cancelled: "bg-neutral-200 text-neutral-700 border-neutral-300",
  }[s] || "bg-neutral-100 text-neutral-700 border-neutral-200");

const payColor = (p) =>
  ({
    null: "bg-neutral-100 text-neutral-800 border-neutral-200",
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    submitted: "bg-sky-100 text-sky-800 border-sky-200",
    paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
    rejected: "bg-rose-100 text-rose-800 border-rose-200",
  }[p ?? "null"]);

export default function MyLoansPage() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [data, setData] = useState({ summary: null, items: [] });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("all"); // all | requested | approved | on_loan | returned | cancelled

  useEffect(() => {
    const uid = getUserId(user);
    if (!uid) {
      nav("/login");
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setErr("");
        const r = await fetch(`${API_BASE}/api/my-breeding-loans?buyer_id=${uid}`);
        if (!r.ok) throw new Error(await r.text());
        const json = await r.json();
        setData({ summary: json.summary, items: json.items || [] });
      } catch (e) {
        setErr(e.message || "โหลดไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, [user, nav]);

  const shown = useMemo(() => {
    if (tab === "all") return data.items || [];
    return (data.items || []).filter((it) => it.status === tab);
  }, [tab, data.items]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden border">
        <div className="bg-gradient-to-r from-black via-neutral-800 to-neutral-700 text-white px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">การยืมของฉัน</h1>
            <p className="text-white/70 text-sm mt-0.5">
              ดูสถานะการยืม, การชำระเงิน และการจัดส่งได้จากหน้านี้
            </p>
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
        {data.summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-6 bg-white">
            <SummaryCard title="จำนวนการยืม" value={data.summary.count} />
            <SummaryCard title="ยอดโดยประมาณรวม" value={money(data.summary.total_spent)} />
            <div className="rounded-xl border p-4">
              <div className="text-sm text-neutral-500">สถานะล่าสุด</div>
              <div className="flex flex-wrap gap-2 mt-2 text-sm">
                <Chip label="กำลังยืม" value={data.summary.on_loan} />
                <Chip label="รอดำเนินการ" value={data.summary.requested} />
                <Chip label="อนุมัติแล้ว" value={data.summary.approved} />
                <Chip label="ส่งคืนแล้ว" value={data.summary.returned} />
                <Chip label="ยกเลิก" value={data.summary.cancelled} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="w-full overflow-x-auto">
        <div className="inline-flex rounded-full border bg-white p-1 shadow-sm">
          {[
            ["all", "ทั้งหมด"],
            ["on_loan", "กำลังยืม"],
            ["requested", "รอดำเนินการ"],
            ["approved", "อนุมัติแล้ว"],
            ["returned", "ส่งคืนแล้ว"],
            ["cancelled", "ยกเลิก"],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cx(
                "px-4 h-10 rounded-full text-sm transition",
                tab === k ? "bg-black text-white shadow" : "hover:bg-neutral-50"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {err && (
        <div className="flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
          <FiAlertCircle className="shrink-0" />
          <span className="text-sm">{err}</span>
        </div>
      )}

      {!loading && !err && (
        shown.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {shown.map((it) => (
              <LoanCard key={it.loan_id} item={it} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

/* ====== Subcomponents ====== */
function SummaryCard({ title, value }) {
  return (
    <div className="rounded-xl border p-4 bg-white shadow-sm hover:shadow-md transition">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Chip({ label, value }) {
  return (
    <span className="px-2 py-1 rounded-full border bg-neutral-50">
      {label}: <b>{value || 0}</b>
    </span>
  );
}

function StatusPill({ status }) {
  return (
    <span className={cx("inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs", statusColor(status))}>
      {status === "requested" && <FiClock />}
      {status === "approved" && <FiCheckCircle />}
      {status === "on_loan" && <FiBox />}
      {status === "returned" && <FiCheckCircle />}
      {status === "cancelled" && <FiX />}
      {THAI[status] || status}
    </span>
  );
}

function PayPill({ pay }) {
  const k = pay ?? "null";
  return (
    <span className={cx("inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs", payColor(k))}>
      {k === "paid" ? <FiCheckCircle /> : k === "rejected" ? <FiX /> : <FiClock />}
      {PAY_STATUS_TH[k]}
    </span>
  );
}

function Stepper({ status }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 text-rose-700 text-sm">
        <FiX /> คำสั่งยืมถูกยกเลิก
      </div>
    );
  }
  const idx = Math.max(0, STATUS_ORDER.indexOf(status));
  return (
    <div className="flex items-center gap-3">
      {STEP_LABELS.map((label, i) => {
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
            {i < STEP_LABELS.length - 1 && (
              <div className={cx("w-8 h-[2px]", active ? "bg-black" : "bg-neutral-200")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LoanCard({ item }) {
  const [open, setOpen] = useState(false);
  const FALLBACK = "https://placehold.co/100x100?text=Rabbit";
  const fmt = (d) =>
    d
      ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(
          new Date(d)
        )
      : "-";
  const money = (x) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
    }).format(Number(x || 0));

  const slipUrl = item.payment_slip_url
    ? (String(item.payment_slip_url).startsWith("http")
        ? item.payment_slip_url
        : `${API_BASE}${item.payment_slip_url}`)
    : null;

  return (
    <div className="border rounded-2xl p-3 md:p-4 bg-white shadow-sm hover:shadow-md transition">
      <div className="flex gap-3">
        <img
          src={item.rabbit_image || FALLBACK}
          alt={item.rabbit_name}
          className="w-20 h-20 object-cover rounded-lg border"
          onError={(e) => {
            e.currentTarget.src = FALLBACK;
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-semibold truncate">
              #{item.loan_id} • {item.rabbit_name} • {item.gender === "male" ? "♂" : "♀"}
            </div>
            <StatusPill status={item.status} />
            <PayPill pay={item.payment_status} />
          </div>

          <div className="text-sm text-neutral-700 mt-1">
            ช่วง: {fmt(item.start_date)} → {fmt(item.end_date || item.start_date)}
          </div>

          <div className="text-sm text-neutral-800 mt-1">
            รวมทั้งสิ้น: <b>{money(item.total_price)}</b>
          </div>

          <div className="mt-3">
            <Stepper status={item.status} />
          </div>

          {/* Payment block */}
          <div className="mt-3 p-3 rounded-xl border bg-neutral-50 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Info label="วิธีชำระ">
                <b>
                  {item.payment_method === "bank_transfer"
                    ? "โอนเงิน"
                    : item.payment_method === "cod"
                    ? "เก็บเงินปลายทาง"
                    : item.payment_method === "wallet"
                    ? "วอลเล็ต"
                    : item.payment_method === "cash"
                    ? "เงินสด"
                    : "-"}
                </b>
              </Info>
              <Info label="ยอดชำระ">
                <b>
                  {item.payment_amount != null && Number(item.payment_amount) > 0
                    ? money(item.payment_amount)
                    : "-"}
                </b>
              </Info>
              <Info label="รหัสอ้างอิง">
                <b>{item.payment_ref || "-"}</b>
              </Info>
              <Info label="สลิป">
                {slipUrl ? (
                  <a
                    href={slipUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cx(
                      "underline underline-offset-2",
                      item.payment_status === "rejected" ? "text-rose-700" : "text-blue-700"
                    )}
                  >
                    ดูสลิป
                  </a>
                ) : (
                  "-"
                )}
              </Info>
            </div>
            {item.payment_status === "rejected" && (
              <div className="text-rose-700 mt-2 flex items-center gap-1">
                <FiAlertCircle /> สลิปไม่ผ่าน กรุณาอัปโหลดใหม่หรือติดต่อผู้ดูแล
              </div>
            )}
            {/* ปุ่มช่วยเหลือการชำระ กรณีโอนเงินแต่ยังไม่จบ */}
            {item.payment_method === "bank_transfer" &&
              (item.payment_status === null ||
                item.payment_status === "pending" ||
                item.payment_status === "rejected") && (
                <div className="mt-2">
                  <a
                    href="/checkout" // ปรับเป็นหน้าที่อัปโหลด/ชำระจริงในโปรเจกต์ของคุณ
                    className="inline-flex items-center gap-2 px-3 h-9 rounded-lg border bg-white hover:bg-neutral-50"
                    title="ไปอัปโหลดสลิป"
                  >
                    <FiUpload />
                    อัปโหลดสลิปใหม่
                  </a>
                </div>
              )}
          </div>

          {(item.ship_carrier || item.ship_tracking_code || item.shipped_at) && (
  <div
    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm
               bg-amber-100 text-amber-800 border-amber-200 mt-2"
  >
    <FiTruck className="shrink-0" />
    <span className="font-medium">{item.ship_carrier || "-"}</span>
    <span>• เลขพัสดุ:</span>
    <span className="font-bold tracking-wide">{item.ship_tracking_code || "-"}</span>
    <span>• อัปเดต {fmt(item.shipped_at)}</span>
  </div>
)}

          {item.status === "on_loan" &&
            (item.return_requested ? (
              <div className="text-amber-700 text-sm mt-2 flex items-center gap-2">
                <FiClock /> แจ้งคืนแล้ว • รอดำเนินการ
              </div>
            ) : (
              <button
                onClick={() => setOpen(true)}
                className="mt-3 px-3 h-10 rounded-lg border bg-white hover:bg-neutral-50"
              >
                📦 แจ้งคืน
              </button>
            ))}
        </div>
      </div>

      {open && <ReturnModal loanId={item.loan_id} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Info({ label, children }) {
  return (
    <div>
      <span className="text-neutral-600">{label}:</span> {children}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="border rounded-2xl p-4 bg-white shadow-sm animate-pulse">
      <div className="flex gap-3">
        <div className="w-20 h-20 rounded-lg bg-neutral-200" />
        <div className="flex-1">
          <div className="h-4 w-1/3 bg-neutral-200 rounded mb-2" />
          <div className="h-3 w-2/3 bg-neutral-200 rounded mb-1.5" />
          <div className="h-3 w-1/2 bg-neutral-200 rounded mb-3" />
          <div className="h-10 w-full bg-neutral-100 rounded" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border bg-white p-10 grid place-items-center text-center">
      <div className="text-5xl mb-3">🐇</div>
      <h3 className="text-lg font-semibold">ยังไม่มีรายการในแท็บนี้</h3>
      <p className="text-neutral-600 text-sm mt-1">
        เมื่อมีการยืมหรืออัปเดตสถานะ รายการจะปรากฏที่นี่
      </p>
    </div>
  );
}

/* ===== Return Modal (คง logic เดิม เพิ่มความเนียนของ UI) ===== */
function ReturnModal({ loanId, onClose }) {
  const [method, setMethod] = useState("ship");
  const [fromText, setFromText] = useState("");
  const [carrier, setCarrier] = useState("");
  const [track, setTrack] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [note, setNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    try {
      setPosting(true);
      setErr("");
      if (method === "ship" && (!carrier || !track)) {
        setErr("กรุณากรอก “ขนส่ง” และ “เลขพัสดุ”");
        return;
      }
      const body = {
        return_method: method,
        return_from_text: fromText || null,
        return_carrier: method === "ship" ? carrier || null : null,
        return_tracking_code: method === "ship" ? track || null : null,
        pickup_time: method === "pickup" ? pickupTime || null : null,
        return_note: note || null,
      };
      const r = await fetch(`${API_BASE}/api/breeding-loans/${loanId}/return-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      window.location.reload();
    } catch (e) {
      setErr(e.message || "ส่งคำขอไม่สำเร็จ");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">แจ้งคืน</div>
          <button
            className="w-8 h-8 rounded-lg border hover:bg-neutral-50 grid place-items-center"
            onClick={onClose}
            title="ปิด"
          >
            <FiX />
          </button>
        </div>

        <label className="block text-sm mb-1">วิธีคืน</label>
        <div className="flex gap-2 mb-3">
          {["ship", "dropoff", "pickup"].map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={cx(
                "px-3 h-10 rounded-full border text-sm",
                method === m ? "bg-black text-white" : "bg-white hover:bg-neutral-50"
              )}
            >
              {m === "ship" ? "ส่งพัสดุ" : m === "dropoff" ? "นำไปคืนเอง" : "นัดรับคืน"}
            </button>
          ))}
        </div>

        {method === "ship" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="ขนส่ง">
                <input
                  className="border rounded px-3 py-2 w-full"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                />
              </Field>
              <Field label="เลขพัสดุ">
                <input
                  className="border rounded px-3 py-2 w-full"
                  value={track}
                  onChange={(e) => setTrack(e.target.value)}
                />
              </Field>
            </div>
            <Field label="คืนจากที่อยู่" className="mt-3">
              <input
                className="border rounded px-3 py-2 w-full"
                value={fromText}
                onChange={(e) => setFromText(e.target.value)}
              />
            </Field>
          </>
        )}

        {method === "dropoff" && (
          <Field label="คืนจากสาขา/ที่อยู่" className="mt-2">
            <input
              className="border rounded px-3 py-2 w-full"
              value={fromText}
              onChange={(e) => setFromText(e.target.value)}
            />
          </Field>
        )}

        {method === "pickup" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <Field label="เวลานัดรับ">
              <input
                type="datetime-local"
                className="border rounded px-3 py-2 w-full"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
              />
            </Field>
            <Field label="จุดนัด/ที่อยู่">
              <input
                className="border rounded px-3 py-2 w-full"
                value={fromText}
                onChange={(e) => setFromText(e.target.value)}
              />
            </Field>
          </div>
        )}

        <Field label="หมายเหตุ" className="mt-3">
          <textarea
            className="border rounded px-3 py-2 w-full"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        {err && (
          <div className="text-rose-700 text-sm mt-2 flex items-center gap-1">
            <FiAlertCircle /> {err}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button className="px-3 h-10 rounded-lg border bg-white hover:bg-neutral-50" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            className={cx(
              "px-3 h-10 rounded-lg text-white",
              posting ? "bg-neutral-400" : "bg-black hover:bg-neutral-800"
            )}
            disabled={posting}
            onClick={submit}
          >
            ส่งคำขอคืน
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className }) {
  return (
    <div className={className}>
      <label className="block text-sm mb-1 text-neutral-700">{label}</label>
      {children}
    </div>
  );
}
