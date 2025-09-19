// src/pages/ManageBreedingLoans.js
import React, { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";
const FALLBACK_IMG = "https://placehold.co/120x120?text=Rabbit";

/* -------- ป้ายสถานะคำขอยืม -------- */
const S_MAP = {
  requested: { label: "ร้องขอ",   cls: "bg-yellow-100 text-yellow-800" },
  approved:  { label: "อนุมัติ",  cls: "bg-blue-100 text-blue-800" },
  on_loan:   { label: "ยืมอยู่",  cls: "bg-purple-100 text-purple-800" },
  returned:  { label: "คืนแล้ว",  cls: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "ยกเลิก",  cls: "bg-red-100 text-red-800" },
};
const Badge = ({ status }) => {
  const s = S_MAP[status] || { label: status || "-", cls: "bg-gray-100 text-gray-800" };
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
};
/* -------- ช่วยฟอร์แมตที่อยู่ (เพิ่มใหม่) -------- */
const formatAddress = (a) => {
  if (!a) return "—";
  // ถ้าข้อมูลที่อยู่เป็น Object
  if (typeof a === "object") {
    const parts = [
      a.detail,
      a.tambon,
      a.amphoe,
      a.province,
      a.zipcode
    ].filter(Boolean).join(" ");
    return parts;
  }
  // ถ้าข้อมูลที่อยู่เป็น String
  return a;
};
/* -------- ป้ายสถานะการชำระเงิน (ไทย) -------- */
const PAY_MAP = {
  pending:   { label: "รอตรวจ",      cls: "bg-gray-100 text-gray-800" },
  submitted: { label: "ส่งสลิปแล้ว",  cls: "bg-amber-100 text-amber-800" },
  paid:      { label: "ชำระแล้ว",     cls: "bg-emerald-100 text-emerald-800" },
  rejected:  { label: "สลิปไม่ผ่าน",  cls: "bg-red-100 text-red-800" },
  null:      { label: "ยังไม่ชำระ",    cls: "bg-gray-100 text-gray-800" },
};
const PayBadge = ({ ps }) => {
  const m = PAY_MAP[ps ?? "null"] || PAY_MAP.null;
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.cls}`}>{m.label}</span>;
};

/* -------- แปลงชื่อวิธีชำระเงินเป็นไทย -------- */
const payMethodTH = (m) => {
  const k = String(m || "").toLowerCase();
  if (k === "bank_transfer" || k === "bank") return "โอนเงิน";
  if (k === "cod") return "เก็บเงินปลายทาง";
  if (k === "wallet") return "วอลเล็ต";
  if (k === "cash") return "เงินสด";
  return m || "-";
};

/* -------- format วันที่/เงิน -------- */
const fmtDT = (d) => (d ? new Date(d).toLocaleString("th-TH") : "-");
const fmtD  = (d) => (d ? new Date(d).toLocaleDateString("th-TH") : "-");
const fmtTHB = (n) => {
  const v = typeof n === "number" ? n : Number(n);
  if (!isFinite(v)) return "-";
  return v.toLocaleString("th-TH", { style: "currency", currency: "THB" });
};

export default function ManageBreedingLoans() {
  const [items, setItems] = useState([]);
  const [page, setPage]   = useState(1);
  const limit = 5;
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const qsUrl = useMemo(() => {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) qs.set("status", status);
    if (search) qs.set("search", search);
    return `${API_BASE}/api/admin/breeding-loans?${qs.toString()}`;
  }, [page, limit, status, search]);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      const res = await fetch(qsUrl);
      if (!res.ok) throw new Error(`โหลดรายการไม่สำเร็จ (HTTP ${res.status})`);
      const data = await res.json();

      setItems((data.items || []).map((x) => ({
        ...x,
        _ship_carrier: x.ship_carrier || "",
        _ship_tracking_code: x.ship_tracking_code || "",
        _shipping: false, _starting: false, _returning: false, _paying:false,
      })));
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      setErr(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, [qsUrl]);

  useEffect(() => { loadList(); }, [loadList]);

  const setRow = (loan_id, patch) =>
    setItems((prev) => prev.map((it) => (it.loan_id === loan_id ? { ...it, ...patch } : it)));

  /* ===================== ชำระเงิน: อนุมัติ/ปฏิเสธ ===================== */
  async function approveSlip(it) {
    try {
      setRow(it.loan_id, { _paying: true });
      const res = await fetch(`${API_BASE}/api/admin/breeding-loans/${it.loan_id}/payment-approve`, { method:"POST" });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || "อนุมัติสลิปไม่สำเร็จ");
      setRow(it.loan_id, {
        _paying:false,
        payment_status:"paid",
        payment_amount:data.payment_amount ?? it.payment_amount,
        paid_at:data.paid_at ?? new Date().toISOString(),
      });
      alert("อนุมัติสลิปแล้ว");
    } catch (e) {
      setRow(it.loan_id, { _paying:false });
      alert(e.message || "อนุมัติสลิปไม่สำเร็จ");
    }
  }

  async function rejectSlip(it) {
    const reason = prompt("เหตุผลที่ปฏิเสธ (ถ้ามี):") || "";
    try {
      setRow(it.loan_id, { _paying: true });
      const res = await fetch(`${API_BASE}/api/admin/breeding-loans/${it.loan_id}/payment-reject`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ reason })
      });
      const data = await res.json().catch(()=> ({}));
      if (!res.ok) throw new Error(data?.error || "ปฏิเสธสลิปไม่สำเร็จ");
      setRow(it.loan_id, { _paying:false, payment_status:"rejected" });
      alert("ปฏิเสธสลิปแล้ว");
    } catch (e) {
      setRow(it.loan_id, { _paying:false });
      alert(e.message || "ปฏิเสธสลิปไม่สำเร็จ");
    }
  }

  /* ===================== ส่งเลขพัสดุ (ไม่เปลี่ยนสถานะ) ===================== */
  async function sendShip(it) {
    try {
      if (!it._ship_carrier && !it._ship_tracking_code) {
        alert("กรุณากรอกอย่างน้อย ขนส่ง หรือ เลขพัสดุ");
        return;
      }
      setRow(it.loan_id, { _shipping: true });
      const res = await fetch(`${API_BASE}/api/admin/breeding-loans/${it.loan_id}/ship`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ship_carrier: it._ship_carrier || null,
          ship_tracking_code: it._ship_tracking_code || null
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "อัปเดตเลขพัสดุไม่สำเร็จ");
      setRow(it.loan_id, {
        _shipping: false,
        ship_carrier: data.ship_carrier ?? it._ship_carrier,
        ship_tracking_code: data.ship_tracking_code ?? it._ship_tracking_code,
        shipped_at: data.shipped_at ?? new Date().toISOString()
      });
      alert("ส่งเลขพัสดุให้ลูกค้าแล้ว");
    } catch (e) {
      setRow(it.loan_id, { _shipping: false });
      alert(e.message || "อัปเดตเลขพัสดุไม่สำเร็จ");
    }
  }

  /* ===================== อนุมัติ/เริ่มยืม/รับคืน/ยกเลิก ===================== */
  async function approve(it) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/breeding-loans/${it.loan_id}/approve`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "อนุมัติไม่สำเร็จ");
      setRow(it.loan_id, { status: "approved" });
      alert("อนุมัติคำขอแล้ว");
    } catch (e) { alert(e.message || "อนุมัติไม่สำเร็จ"); }
  }

  async function startLoan(it) {
  try {
    setRow(it.loan_id, { _starting: true });

    const res = await fetch(`${API_BASE}/api/admin/breeding-loans/${it.loan_id}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ship_carrier: it._ship_carrier || null,
        ship_tracking_code: it._ship_tracking_code || null,
        mark_paid: it.payment_status !== "paid", // ✅ ใช้ตรง ๆ
        paid_amount: (String(it.payment_method).toLowerCase() === "cod")
                      ? it.total_price
                      : (it.payment_amount ?? it.total_price),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "เริ่มยืมไม่สำเร็จ");

    setRow(it.loan_id, { _starting: false, status: "on_loan" });
    alert("เริ่มยืมแล้ว");
  } catch (e) {
    setRow(it.loan_id, { _starting: false });
    alert(e.message || "เริ่มยืมไม่สำเร็จ");
  }
}

  async function markReturned(it) {
    try {
      setRow(it.loan_id, { _returning: true });
      const res = await fetch(`${API_BASE}/api/admin/breeding-loans/${it.loan_id}/mark-returned`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "รับคืนไม่สำเร็จ");
      setRow(it.loan_id, { _returning: false, status: "returned" });
      alert("รับคืนแล้ว");
    } catch (e) {
      setRow(it.loan_id, { _returning: false });
      alert(e.message || "รับคืนไม่สำเร็จ");
    }
  }

  async function cancelLoan(it) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/breeding-loans/${it.loan_id}/cancel`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "ยกเลิกไม่สำเร็จ");
      setRow(it.loan_id, { status: "cancelled" });
      alert("ยกเลิกแล้ว");
    } catch (e) { alert(e.message || "ยกเลิกไม่สำเร็จ"); }
  }

  const go = (p) => { if (p >= 1 && p <= totalPages) setPage(p); };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-6">
      {/* header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">📦 จัดการคำขอยืม</h1>
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e)=>{setPage(1); setSearch(e.target.value);}}
            placeholder="ค้นหา: ผู้ยืม/เบอร์/ชื่อกระต่าย"
            className="border rounded-lg px-3 py-2"
          />
          <select
            value={status}
            onChange={(e)=>{setPage(1); setStatus(e.target.value);}}
            className="border rounded-lg px-3 py-2"
          >
            <option value="">ทุกสถานะ</option>
            <option value="requested">ร้องขอ</option>
            <option value="approved">อนุมัติ</option>
            <option value="on_loan">ยืมอยู่</option>
            <option value="returned">คืนแล้ว</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
        </div>
      </div>

      {/* meta */}
      <div className="text-sm text-neutral-600 mb-3">
        ทั้งหมด {total} รายการ • หน้า {page}/{totalPages}
      </div>

      {loading ? (
        <p className="p-6 text-center text-neutral-500">กำลังโหลด...</p>
      ) : err ? (
        <p className="p-6 text-center text-red-600">{err}</p>
      ) : items.length === 0 ? (
        <p className="p-6 text-center text-neutral-500">ยังไม่มีรายการ</p>
      ) : (
        <div className="space-y-4">
          {items.map((it) => {
            const createdAt = it.created_at || it.requested_at;
            const canApprove = it.status === "requested";
            const canStart   = it.status === "requested" || it.status === "approved";
            const canReturn  = it.status === "on_loan";
            const canCancel  = it.status === "requested" || it.status === "approved";

            const slipUrl = it.payment_slip_url
              ? (it.payment_slip_url.startsWith("http") ? it.payment_slip_url : `${API_BASE}${it.payment_slip_url}`)
              : "";

            const isCOD = String(it.payment_method || "").toLowerCase() === "cod";

            return (
              <div key={it.loan_id} className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                {/* header card */}
                <div className="p-5 border-b">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div>
                      <div className="text-lg font-bold">คำขอยืม #{it.loan_id}</div>
                      <div className="mt-1 space-y-0.5 text-sm">
                        <div>📅 {fmtDT(createdAt)}</div>
                        <div>👤 {it.borrower_name || "-"} {it.borrower_phone ? <>• {it.borrower_phone}</> : null}</div>
                        <div>📧 {it.borrower_email || "—"}</div>
                         <div>📍 {formatAddress(it.borrower_address)}</div>
                        <div>🗓️ {fmtD(it.start_date) || "—"} {it.end_date ? `→ ${fmtD(it.end_date)}` : ""}</div>
                      </div>
                    </div>

                    {/* มุมขวา: สถานะ + ยอดคำขอ */}
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-600">สถานะ:</span>
                        <Badge status={it.status} />
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-neutral-500">ยอดคำขอ</div>
                        <div className="text-lg font-semibold">{fmtTHB(it.total_price)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* rabbit row */}
                <div className="p-5 flex gap-3 border-b">
                  <img
                    src={it.rabbit_image || FALLBACK_IMG}
                    alt={it.rabbit_name}
                    className="w-16 h-16 rounded-lg object-cover border"
                    onError={(e)=>{e.currentTarget.src=FALLBACK_IMG;}}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold line-clamp-1">{it.rabbit_name || `#${it.rabbit_id}`}</div>
                    <div className="text-sm text-neutral-600">
                      {it.rabbit_breed || "-"} • {it.rabbit_gender === "male" ? "♂ เพศผู้" : it.rabbit_gender === "female" ? "♀ เพศเมีย" : "ไม่ระบุ"} • x1
                    </div>
                  </div>
                </div>

                {/* body controls */}
                <div className="p-5">

                  {/* ====== Payment block ====== */}
                  <div className="mb-4 rounded-xl border bg-gray-50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">ชำระเงิน: <PayBadge ps={it.payment_status} /></div>
                      <div className="text-sm text-neutral-600">
                        {it.paid_at ? <>ชำระเมื่อ {fmtDT(it.paid_at)}</> : null}
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                      {/* slip preview */}
                      <div className="md:col-span-1">
                        {!isCOD && slipUrl ? (
                          <a href={slipUrl} target="_blank" rel="noreferrer" className="inline-block">
                            <img
                              src={slipUrl}
                              alt="สลิปโอน"
                              className="w-36 h-36 object-cover rounded-lg border hover:opacity-90"
                              onError={(e)=>{ e.currentTarget.style.display='none'; }}
                            />
                          </a>
                        ) : (
                          <div className="text-sm text-neutral-500 text-right md:text-left">
                            {isCOD ? "ชำระปลายทาง (ไม่มีสลิป)" : "ยังไม่มีสลิปแนบ"}
                          </div>
                        )}
                      </div>

                     {/* method/amount/ref */}
<div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
  <div>วิธีชำระ: <b>{payMethodTH(it.payment_method)}</b></div>

  <div>
  ยอดชำระ:{" "}
  <b>
    {isCOD
      ? `${fmtTHB(it.total_price)} (ปลายทาง)`
      : (isFinite(Number(it.payment_amount))
          ? fmtTHB(Number(it.payment_amount))
          : "-")}
  </b>
</div>

  <div className="md:col-span-2">รหัสอ้างอิง: {it.payment_ref || "-"}</div>

  {(it.payment_status === "submitted" && !isCOD) && (
    <div className="md:col-span-2 flex gap-2 mt-1">
      <button
        onClick={()=>approveSlip(it)}
        disabled={it._paying}
        className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {it._paying ? "กำลังอนุมัติ..." : "อนุมัติสลิป"}
      </button>
      <button
        onClick={()=>rejectSlip(it)}
        disabled={it._paying}
        className="px-3 py-2 rounded-lg bg-white border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        {it._paying ? "กำลังปฏิเสธ..." : "ปฏิเสธสลิป"}
      </button>
    </div>
  )}

  {isCOD && (
    <div className="md:col-span-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-1">
      เก็บเงินปลายทาง: จะชำระเมื่อส่งของ/รับคืน ไม่ต้องตรวจสลิป
    </div>
  )}
</div>

                    </div>
                  </div>

                  {/* ====== Return-request info ====== */}
                  {it.return_requested && (
                    <div className="mb-4 rounded-xl border bg-amber-50 p-3 text-sm text-amber-900">
                      <div className="font-medium mb-1">📦 ลูกค้า “แจ้งคืนแล้ว” (รอดำเนินการ)</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                        <div>วิธีคืน: <b>{
                          it.return_method === "ship"   ? "ส่งพัสดุ" :
                          it.return_method === "dropoff"? "นำไปคืนเอง" :
                          it.return_method === "pickup" ? "นัดรับคืน" : "-"
                        }</b></div>
                        <div>แจ้งเมื่อ: {fmtDT(it.return_requested_at)}</div>

                        {it.return_method === "ship" && (
                          <>
                            <div>ขนส่ง (ขากลับ): <b>{it.return_carrier || "-"}</b></div>
                            <div>เลขพัสดุ (ขากลับ): <b>{it.return_tracking_code || "-"}</b></div>
                          </>
                        )}

                        {it.return_method === "pickup" && (
                          <div className="md:col-span-2">เวลานัดรับ: <b>{fmtDT(it.pickup_time)}</b></div>
                        )}

                        <div className="md:col-span-2">คืนจาก/จุดส่ง: {it.return_from_text || "-"}</div>
                        {it.return_note && <div className="md:col-span-2">หมายเหตุ: {it.return_note}</div>}
                      </div>
                    </div>
                  )}

                  {/* ====== Shipping (ขาไปหาเขา) ====== */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      className="border rounded-xl px-3 py-2"
                      placeholder="ขนส่ง (เช่น Kerry, Flash)"
                      value={it._ship_carrier}
                      onChange={(e)=>setRow(it.loan_id, { _ship_carrier: e.target.value })}
                    />
                    <input
                      className="border rounded-xl px-3 py-2"
                      placeholder="เลขพัสดุ"
                      value={it._ship_tracking_code}
                      onChange={(e)=>setRow(it.loan_id, { _ship_tracking_code: e.target.value })}
                    />
                    <div className="flex items-center text-sm text-neutral-600">
                      {it.shipped_at ? `ส่งเมื่อ: ${fmtDT(it.shipped_at)}` : "ยังไม่ส่งพัสดุ"}
                    </div>
                  </div>

                  {/* note (read-only) */}
                  {it.notes ? (
                    <div className="mt-3 text-sm text-neutral-700">
                      📝 หมายเหตุ: {it.notes}
                    </div>
                  ) : null}

                  {/* action buttons */}
                  <div className="mt-4 flex flex-wrap gap-2 justify-end">
                    <button
                      onClick={()=>sendShip(it)}
                      disabled={it._shipping}
                      className="px-4 py-2 rounded-xl border hover:bg-neutral-50"
                    >
                      {it._shipping ? "กำลังส่งเลขพัสดุ..." : "แจ้งเลขพัสดุ"}
                    </button>

                    {canApprove && (
                      <button onClick={()=>approve(it)} className="px-4 py-2 rounded-xl border hover:bg-neutral-50">
                        อนุมัติ
                      </button>
                    )}

                    {canStart && (
                      <button
                        onClick={()=>startLoan(it)}
                        disabled={it._starting}
                        className="px-4 py-2 rounded-xl border hover:bg-neutral-50"
                      >
                        {it._starting ? "กำลังเริ่ม..." : "เริ่มยืม"}
                      </button>
                    )}

                    {canReturn && (
                      <button
                        onClick={()=>markReturned(it)}
                        disabled={it._returning}
                        className="px-4 py-2 rounded-xl border hover:bg-neutral-50"
                      >
                        {it._returning ? "กำลังรับคืน..." : "รับคืน"}
                      </button>
                    )}

                    {canCancel && (
                      <button
                        onClick={()=>cancelLoan(it)}
                        className="px-4 py-2 rounded-xl border border-red-300 text-red-600 hover:bg-red-50"
                      >
                        ยกเลิก
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* pagination */}
      {totalPages > 1 && (
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={()=>go(1)} disabled={page===1} className="h-9 min-w-9 px-3 rounded-full border disabled:opacity-50">⟪</button>
          <button onClick={()=>go(page-1)} disabled={page===1} className="h-9 min-w-9 px-3 rounded-full border disabled:opacity-50">«</button>
          {Array.from({ length: totalPages }, (_, i) => i+1).map(n => (
            <button key={n} onClick={()=>go(n)} disabled={page===n}
              className={`h-9 min-w-9 px-3 rounded-full border text-sm ${page===n ? "bg-black text-white" : "hover:bg-gray-100"}`}>
              {n}
            </button>
          ))}
          <button onClick={()=>go(page+1)} disabled={page===totalPages} className="h-9 min-w-9 px-3 rounded-full border disabled:opacity-50">»</button>
          <button onClick={()=>go(totalPages)} disabled={page===totalPages} className="h-9 min-w-9 px-3 rounded-full border disabled:opacity-50">⟫</button>
        </div>
      )}
    </div>
  );
}
