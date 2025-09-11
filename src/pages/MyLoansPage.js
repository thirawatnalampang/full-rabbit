// src/pages/MyLoansPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";

const THAI = {
  requested: "รอดำเนินการ",
  approved: "อนุมัติแล้ว",
  on_loan: "กำลังยืม",
  returned: "ส่งคืนแล้ว",
  cancelled: "ยกเลิก",
};

// 🆕 แปลสถานะการชำระเงินเป็นไทย
const PAY_STATUS_TH = {
  null: "ยังไม่ชำระ",
  pending: "รอตรวจ",
  submitted: "ส่งสลิปแล้ว",
  paid: "ชำระแล้ว",
  rejected: "สลิปไม่ผ่าน",
};

const getUserId = (user) =>
  user?.user_id ??
  JSON.parse(localStorage.getItem("user") || "{}")?.user_id ??
  null;

const money = (x) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(
    Number(x || 0)
  );

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
        const r = await fetch(
          `${API_BASE}/api/my-breeding-loans?buyer_id=${uid}`
        );
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
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">การยืมของฉัน</h1>
        <button
          onClick={() => window.location.reload()}
          className="px-3 h-9 rounded-lg border hover:bg-neutral-50"
        >
          รีเฟรช
        </button>
      </div>

      {data.summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card title="จำนวนการยืม" value={data.summary.count} />
          <Card title="ยอดโดยประมาณรวม" value={money(data.summary.total_spent)} />
          <div className="rounded-xl border p-4">
            <div className="text-sm text-neutral-500">สถานะล่าสุด</div>
            <div className="flex flex-wrap gap-2 mt-2 text-sm">
              <Badge label="กำลังยืม" value={data.summary.on_loan} />
              <Badge label="รอดำเนินการ" value={data.summary.requested} />
              <Badge label="อนุมัติแล้ว" value={data.summary.approved} />
              <Badge label="ส่งคืนแล้ว" value={data.summary.returned} />
              <Badge label="ยกเลิก" value={data.summary.cancelled} />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
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
            className={`px-3 h-9 rounded-full border ${
              tab === k ? "bg-black text-white" : "hover:bg-neutral-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="text-neutral-500">กำลังโหลด...</div>}
      {err && <div className="text-red-600">{err}</div>}

      {!loading && !err && (
        shown.length === 0 ? (
          <div className="text-neutral-500">ยังไม่มีรายการในแท็บนี้</div>
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

function Card({ title, value }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Badge({ label, value }) {
  return (
    <span className="px-2 py-1 rounded-full border bg-neutral-50">
      {label}: <b>{value || 0}</b>
    </span>
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

  // ทำ URL สลิปให้เป็นลิงก์สมบูรณ์
  const slipUrl = item.payment_slip_url
    ? (String(item.payment_slip_url).startsWith("http")
        ? item.payment_slip_url
        : `${API_BASE}${item.payment_slip_url}`)
    : null;

  return (
    <div className="border rounded-xl p-3 flex gap-3">
      <img
        src={item.rabbit_image || FALLBACK}
        alt={item.rabbit_name}
        className="w-20 h-20 object-cover rounded border"
        onError={(e) => {
          e.currentTarget.src = FALLBACK;
        }}
      />
      <div className="flex-1">
        <div className="font-medium">
          #{item.loan_id} • {item.rabbit_name} • {item.gender === "male" ? "♂" : "♀"}
        </div>
        <div className="text-sm text-neutral-700">
          ช่วง: {fmt(item.start_date)} → {fmt(item.end_date || item.start_date)}
        </div>
        <div className="text-sm">
          สถานะ: <b>{THAI[item.status] || item.status}</b> • ชำระเงิน:{" "}
          <b>{PAY_STATUS_TH[item.payment_status ?? "null"]}</b> • รวม:{" "}
          {money(item.total_price)}
        </div>

        {/* ========= บล็อกข้อมูลการชำระเงิน ========= */}
        <div className="mt-2 p-3 rounded-lg border bg-neutral-50 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <div>
              <span className="text-neutral-600">วิธีชำระ:</span>{" "}
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
            </div>
            <div>
              <span className="text-neutral-600">ยอดชำระ:</span>{" "}
              <b>
                {item.payment_amount != null && Number(item.payment_amount) > 0
                  ? money(item.payment_amount)
                  : "-"}
              </b>
            </div>
            <div>
              <span className="text-neutral-600">รหัสอ้างอิง:</span>{" "}
              <b>{item.payment_ref || "-"}</b>
            </div>
            <div>
              <span className="text-neutral-600">สลิป:</span>{" "}
              {slipUrl ? (
                <a
                  href={slipUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`underline ${
                    item.payment_status === "rejected"
                      ? "text-red-600"
                      : "text-blue-700"
                  }`}
                >
                  ดูสลิป
                </a>
              ) : (
                "-"
              )}
            </div>
          </div>
          {item.payment_status === "rejected" && (
            <div className="text-red-600 mt-1">
              ⚠️ สลิปไม่ผ่าน กรุณาอัปโหลดใหม่หรือติดต่อผู้ดูแล
            </div>
          )}
        </div>
        {/* ========= จบ: บล็อกข้อมูลการชำระเงิน ========= */}

        {(item.ship_carrier || item.ship_tracking_code || item.shipped_at) && (
          <div className="text-xs mt-2 text-neutral-600">
            📦 {item.ship_carrier || "-"} • เลขพัสดุ: {item.ship_tracking_code || "-"} • อัปเดต {fmt(item.shipped_at)}
          </div>
        )}

        {item.status === "on_loan" &&
          (item.return_requested ? (
            <div className="text-amber-700 text-sm mt-2">
              แจ้งคืนแล้ว • รอดำเนินการ
            </div>
          ) : (
            <button
              onClick={() => setOpen(true)}
              className="mt-3 px-3 py-1.5 rounded border hover:bg-neutral-50"
            >
              📦 แจ้งคืน
            </button>
          ))}
      </div>

      {open && <ReturnModal loanId={item.loan_id} onClose={() => setOpen(false)} />}
    </div>
  );
}

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
      const r = await fetch(
        `${API_BASE}/api/breeding-loans/${loanId}/return-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!r.ok) throw new Error(await r.text());
      window.location.reload();
    } catch (e) {
      setErr(e.message || "ส่งคำขอไม่สำเร็จ");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg p-4">
        <div className="text-lg font-semibold mb-2">แจ้งคืน</div>
        <label className="block text-sm mb-1">วิธีคืน</label>
        <div className="flex gap-2 mb-3">
          {["ship", "dropoff", "pickup"].map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`px-3 h-9 rounded-full border ${
                method === m ? "bg-black text-white" : "hover:bg-neutral-50"
              }`}
            >
              {m === "ship" ? "ส่งพัสดุ" : m === "dropoff" ? "นำไปคืนเอง" : "นัดรับคืน"}
            </button>
          ))}
        </div>

        {method === "ship" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">ขนส่ง</label>
                <input
                  className="border rounded px-3 py-2 w-full"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">เลขพัสดุ</label>
                <input
                  className="border rounded px-3 py-2 w-full"
                  value={track}
                  onChange={(e) => setTrack(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm mb-1">คืนจากที่อยู่</label>
              <input
                className="border rounded px-3 py-2 w-full"
                value={fromText}
                onChange={(e) => setFromText(e.target.value)}
              />
            </div>
          </>
        )}

        {method === "dropoff" && (
          <div className="mt-2">
            <label className="block text-sm mb-1">คืนจากสาขา/ที่อยู่</label>
            <input
              className="border rounded px-3 py-2 w-full"
              value={fromText}
              onChange={(e) => setFromText(e.target.value)}
            />
          </div>
        )}

        {method === "pickup" && (
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <label className="block text-sm mb-1">เวลานัดรับ</label>
              <input
                type="datetime-local"
                className="border rounded px-3 py-2 w-full"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">จุดนัด/ที่อยู่</label>
              <input
                className="border rounded px-3 py-2 w-full"
                value={fromText}
                onChange={(e) => setFromText(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="mt-3">
          <label className="block text-sm mb-1">หมายเหตุ</label>
          <textarea
            className="border rounded px-3 py-2 w-full"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {err && <div className="text-red-600 text-sm mt-2">{err}</div>}

        <div className="mt-4 flex justify-end gap-2">
          <button className="px-3 h-9 rounded border hover:bg-neutral-50" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            className={`px-3 h-9 rounded text-white ${
              posting ? "bg-neutral-400" : "bg-black hover:bg-gray-800"
            }`}
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
