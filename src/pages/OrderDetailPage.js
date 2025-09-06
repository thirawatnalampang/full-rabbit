import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(Number(n || 0));

/** ชื่อภาษาไทย */
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
const METHOD_TH = {
  cod: "เก็บเงินปลายทาง",
  bank_transfer: "โอน",
};
const ITEM_TYPE_TH = {
  rabbit: "กระต่าย",
  "pet-food": "อาหารสัตว์",
  equipment: "อุปกรณ์",
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/orders/${id}`);
        if (!res.ok) throw new Error("not ok");
        setData(await res.json());
      } catch (e) {
        setErr("ไม่พบคำสั่งซื้อ");
      }
    })();
  }, [id]);

  if (err) return <div className="max-w-4xl mx-auto p-6">{err}</div>;
  if (!data) return <div className="max-w-4xl mx-auto p-6">กำลังโหลด...</div>;

  const { order, items } = data;

  // บางฐานข้อมูลอาจเก็บ address เป็น string ให้ลอง parse ถ้าเป็น string
  let addr = order.shipping_address || {};
  if (typeof addr === "string") {
    try { addr = JSON.parse(addr); } catch {}
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
      <div className="text-sm text-neutral-500 mb-2">
        <Link to="/" className="hover:underline">หน้าแรก</Link> <span className="mx-1">/</span>
        <Link to="/my-orders" className="hover:underline">คำสั่งซื้อของฉัน</Link> <span className="mx-1">/</span>
        คำสั่งซื้อ #{order.order_id}
      </div>

      <h1 className="text-2xl font-extrabold mb-4">คำสั่งซื้อ #{order.order_id}</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* กล่องสถานะ */}
        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold mb-2">สถานะ</div>
          <div className="text-sm">
            คำสั่งซื้อ: <span className="px-2 py-0.5 bg-neutral-100 rounded">
              {STATUS_TH[order.status] || order.status}
            </span>
          </div>
          <div className="text-sm mt-1">
            การชำระเงิน: {METHOD_TH[order.payment_method] || order.payment_method} •{" "}
            <span className="px-2 py-0.5 bg-neutral-100 rounded">
              {PAYMENT_TH[order.payment_status] || order.payment_status}
            </span>
          </div>
          {order.tracking_number && (
            <div className="text-sm mt-1">เลขพัสดุ: {order.tracking_number}</div>
          )}
          {order.payment_slip_path && (
            <div className="text-sm mt-1">
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

        {/* กล่องผู้รับ & การจัดส่ง */}
        <div className="bg-white border rounded-2xl p-4">
          <div className="font-semibold mb-2">ผู้รับ & การจัดส่ง</div>
          <div className="text-sm">{order.contact_full_name} • {order.contact_phone}</div>
          <div className="text-sm">วิธีส่ง: {order.shipping_method || "-"}</div>
          {order.shipping_address && (
            <div className="text-sm mt-1 whitespace-pre-line">
              {`${addr.address || ""}\n${addr.district || ""} ${addr.province || ""} ${addr.zipcode || ""}`}
            </div>
          )}
        </div>
      </div>

      {/* รายการสินค้า */}
      <div className="bg-white border rounded-2xl p-4 mt-4">
        <div className="font-semibold mb-3">รายการสินค้า</div>
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.order_detail_id} className="flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">
                  {ITEM_TYPE_TH[it.item_type] || it.item_type} #{it.item_id}
                </div>
                <div className="text-neutral-500">x{it.quantity}</div>
              </div>
              <div className="font-semibold">{thb(it.quantity * it.price)}</div>
            </div>
          ))}
        </div>
        <div className="my-3 border-t" />
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span>ยอดสินค้า</span><span>{thb(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>ค่าส่ง</span><span>{thb(order.shipping_fee)}</span>
          </div>
          {Number(order.discount) > 0 && (
            <div className="flex justify-between">
              <span>ส่วนลด</span><span>-{thb(order.discount)}</span>
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
