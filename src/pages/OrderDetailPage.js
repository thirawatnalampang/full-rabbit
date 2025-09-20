// src/pages/OrderDetailPage.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";
const thb = (n) =>
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
const METHOD_TH = { cod: "เก็บเงินปลายทาง", bank_transfer: "โอน" };
const ITEM_TYPE_TH = { rabbit: "กระต่าย", "pet-food": "อาหารสัตว์", equipment: "อุปกรณ์" };
const SHIPPING_TH = { standard: "จัดส่งปกติ", express: "จัดส่งด่วน", pickup: "รับที่ร้าน" };

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
    <div className="flex flex-col items-start gap-0.5 text-xs mt-2">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200"
        title="กดเพื่อดูสถานะพัสดุ"
      >
        📦 {carrier ? `${carrier} • ` : ""}เลขพัสดุ: <span className="font-semibold">{code}</span>
      </a>
      {updatedAt ? (
        <span className="text-neutral-400">อัปเดต {new Date(updatedAt).toLocaleString("th-TH")}</span>
      ) : null}
    </div>
  );
}

/* ---------- ฟอร์แมตที่อยู่ ---------- */
function formatAddress(a) {
  if (!a) return "";
  if (typeof a === "string") {
    const parts = a.split("|").map(p => p.trim());
    const detail = parts[0] || "";
    const tambon = parts[1] || "";
    const amphoe = parts[2] || "";
    const province = parts[3] || "";
    const zipcode = parts[4] || "";
    const line1 = detail;
    const line2 = [tambon, amphoe, province].filter(Boolean).join(" ");
    const line3 = zipcode;
    return [line1, line2, line3].filter(Boolean).join("\n");
  }
  const line1 = a.detail || "";
  const line2 = [a.tambon, a.amphoe, a.province].filter(Boolean).join(" ");
  const line3 = a.zipcode || "";
  return [line1, line2, line3].filter(Boolean).join("\n");
}

/* ---------- ดึงที่อยู่จาก order (รองรับทั้งรูปแบบเก่า/ใหม่) ---------- */
function getShippingAddress(order) {
  // หากเป็น pickup ก็ไม่ต้องแสดงที่อยู่
  if (order?.shipping_method === "pickup") return null;

  // 1) ถ้ายังมี shipping_address (string หรือ json) ใช้อันนี้ก่อน
  let addr = order?.shipping_address;
  if (addr) {
    if (typeof addr === "string") {
      try { addr = JSON.parse(addr); } catch { /* keep string */ }
    }
    if (addr && (typeof addr === "string" || typeof addr === "object")) return addr;
  }

  // 2) ถ้าไม่มี ให้ประกอบจากคอลัมน์ที่แยก (ship_*)
  const obj = {
    detail: order?.ship_detail || "",
    tambon: order?.ship_subdistrict || "",
    amphoe: order?.ship_district || "",
    province: order?.ship_province || "",
    zipcode: order?.ship_zipcode || "",
  };

  // ถ้าไม่มีอะไรเลย ให้คืน null
  return Object.values(obj).some(Boolean) ? obj : null;
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/orders/${id}`);
        if (!res.ok) throw new Error("not ok");
        const json = await res.json();
        setData(json);
      } catch {
        setErr("ไม่พบคำสั่งซื้อ");
      }
    })();
  }, [id]);

  if (err) return <div className="max-w-4xl mx-auto p-6">{err}</div>;
  if (!data) return <div className="max-w-4xl mx-auto p-6">กำลังโหลด...</div>;

  const { order, items } = data;

  const addressForShow = getShippingAddress(order);
  const trackingCarrier = order.carrier || "";
  const trackingCode = order.tracking_code || order.tracking_number || "";
  const trackingUpdatedAt = order.tracking_updated_at || null;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
      <div className="text-sm text-neutral-500 mb-2">
        <Link to="/" className="hover:underline">หน้าแรก</Link> <span className="mx-1">/</span>
        <Link to="/my-orders" className="hover:underline">คำสั่งซื้อของฉัน</Link> <span className="mx-1">/</span>
        คำสั่งซื้อ #{order.order_id}
      </div>

      <h1 className="text-2xl font-extrabold mb-4">คำสั่งซื้อ #{order.order_id}</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold mb-2">สถานะ</div>

          <div className="text-sm">
            คำสั่งซื้อ:{" "}
            <span className="px-2 py-0.5 bg-neutral-100 rounded">
              {STATUS_TH[order.status] || order.status}
            </span>
          </div>

          <div className="text-sm mt-1">
            การชำระเงิน: {METHOD_TH[order.payment_method] || order.payment_method} •{" "}
            <span className="px-2 py-0.5 bg-neutral-100 rounded">
              {PAYMENT_TH[order.payment_status] || order.payment_status}
            </span>
          </div>

          <TrackingBadge carrier={trackingCarrier} code={trackingCode} updatedAt={trackingUpdatedAt} />

          {order.payment_slip_path && (
            <div className="text-sm mt-2">
              สลิปโอน:{" "}
              <a
                href={`${API_BASE}${order.payment_slip_path}`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                เปิดดู
              </a>
            </div>
          )}

          <div className="text-sm mt-1">
            วันที่: {new Date(order.order_date).toLocaleString("th-TH")}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold mb-2">ผู้รับ & การจัดส่ง</div>

          <div className="text-sm">
            {order.contact_full_name} • {order.contact_phone}
          </div>

          <div className="text-sm mt-1">
            วิธีส่ง: {SHIPPING_TH[order.shipping_method] || order.shipping_method || "-"}
          </div>

         {addressForShow ? (
  <div className="mt-2">
    <div className="text-sm font-semibold mb-1">ที่อยู่</div>
    <div
      className="text-sm truncate"                              // บรรทัดเดียว + …
      title={formatAddress(addressForShow, { inline: true })}    // โชว์เต็มเมื่อโฮเวอร์
    >
      {formatAddress(addressForShow, { inline: true })}
    </div>
  </div>
) : null}
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-4 mt-4">
        <div className="font-semibold mb-3">รายการสินค้า</div>

        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.order_detail_id ?? `${it.item_type}-${it.item_id}`} className="flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">
                  {ITEM_TYPE_TH[it.item_type] || it.item_type} #{it.item_id}
                </div>
                <div className="text-neutral-500">x{it.quantity}</div>
              </div>
              <div className="font-semibold">{thb((it.quantity || 0) * (it.price || 0))}</div>
            </div>
          ))}
        </div>

        <div className="my-3 border-t" />

        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span>ยอดสินค้า</span>
            <span>
              {thb(order.subtotal ?? items.reduce((s, it) => s + Number((it.quantity || 0) * (it.price || 0)), 0))}
            </span>
          </div>
          <div className="flex justify-between">
            <span>ค่าส่ง</span>
            <span>{thb(order.shipping_fee || 0)}</span>
          </div>
          {Number(order.discount) > 0 && (
            <div className="flex justify-between">
              <span>ส่วนลด</span>
              <span>-{thb(order.discount || 0)}</span>
            </div>
          )}
        </div>

        <div className="my-3 border-t" />

        <div className="flex justify-between font-semibold">
          <span>รวมทั้งหมด</span>
          <span className="text-emerald-600">{thb(order.total_amount)}</span>
        </div>
      </div>
    </div>
  );
}
