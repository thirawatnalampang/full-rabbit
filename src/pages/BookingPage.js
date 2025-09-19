// src/pages/BookingPage.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const FALLBACK_IMG = "https://placehold.co/300x300?text=Rabbit";
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";
const getUserId = (user) =>
  user?.user_id ?? JSON.parse(localStorage.getItem("user") || "{}")?.user_id ?? null;

/* ---------- address helpers ---------- */
const parseAddressString = (addrStr = "") => {
  const p = String(addrStr).split("|").map((s) => s.trim());
  return {
    detail: p[0] || "",
    tambon: p[1] || "",
    amphoe: p[2] || "",
    province: p[3] || "",
    zipcode: p[4] || "",
  };
};
const composeAddressString = ({ detail, tambon, amphoe, province, zipcode }) =>
  [detail || "", tambon || "", amphoe || "", province || "", zipcode || ""].join("|");

export default function BookingPage() {
  const { state } = useLocation();
  const nav = useNavigate();
  const { user } = useAuth();
  const rabbit = state?.rabbit;

  // ราคา
  const baseDays = 3;
  const basePrice = Number(rabbit?.price ?? 0);
  const pricePerDay = baseDays > 0 ? basePrice / baseDays : 0;

  // ฟอร์มหลัก
  const [form, setForm] = useState({
    name: "",              // ❗ ไม่เติมชื่ออัตโนมัติ
    date: "",
    returnDate: "",
    message: "",
    agree: false,
  });
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((s) => ({ ...s, [name]: type === "checkbox" ? checked : value }));
  };

  // เบอร์โทร (เติมจากโปรไฟล์)
  const [phone, setPhone] = useState("");
  const handlePhoneChange = (e) => {
    const only = e.target.value.replace(/\D/g, "");
    if (only.length <= 10) setPhone(only);
  };

  // ที่อยู่แบบ “เลือกจังหวัด/อำเภอ/ตำบล”
  const [addrData, setAddrData] = useState([]);
  const [provList, setProvList] = useState([]);
  const [amphoeList, setAmphoeList] = useState([]);
  const [tambonList, setTambonList] = useState([]);
  const [detail, setDetail] = useState("");
  const [province, setProvince] = useState("");
  const [amphoe, setAmphoe] = useState("");
  const [tambon, setTambon] = useState("");
  const [zipcode, setZipcode] = useState("");

  // ค่าที่ "ต้องการเติม" จากโปรไฟล์ไว้ก่อน แล้วค่อยใส่ตามลำดับ
  const [wanted, setWanted] = useState(null); // { detail, province, amphoe, tambon, zipcode }

  // โหลดไฟล์ตำแหน่ง (วางไว้ที่ public/thai-address.json)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/thai-address.json");
        const j = await r.json();
        setAddrData(j || []);
        setProvList((j || []).map((p) => p.province));
      } catch (e) {
        console.error("โหลด thai-address.json ไม่สำเร็จ", e);
      }
    })();
  }, []);

  // เติม “เฉพาะเบอร์ + ที่อยู่” จากโปรไฟล์ (ไม่เติมชื่อ) → เก็บไว้ใน wanted
  useEffect(() => {
    const u =
      (user && (user.profile || user)) ||
      JSON.parse(localStorage.getItem("user") || "{}");
    if (!u) return;

    const parsed = parseAddressString(u.address || "");
    setPhone((p) => p || u.phone || u.tel || "");
    setDetail((d) => d || parsed.detail || u.detail || "");

    setWanted({
      detail: parsed.detail || u.detail || "",
      province: parsed.province || u.province || "",
      amphoe: parsed.amphoe || u.amphoe || u.district || "",
      tambon: parsed.tambon || u.tambon || u.subdistrict || "",
      zipcode: parsed.zipcode || u.zipcode || u.postcode || "",
    });
  }, [user]);

  // province -> อำเภอ (รีเฟรชลิสต์)
  useEffect(() => {
    const p = addrData.find((x) => x.province === province);
    setAmphoeList(p ? p.amphoes.map((a) => a.amphoe) : []);
    setAmphoe((prev) => (p && p.amphoes.some((a) => a.amphoe === prev) ? prev : ""));
    setTambon("");
    setZipcode("");
  }, [province, addrData]);

  // amphoe -> ตำบล (รีเฟรชลิสต์)
  useEffect(() => {
    const p = addrData.find((x) => x.province === province);
    const a = p?.amphoes.find((y) => y.amphoe === amphoe);
    setTambonList(a ? a.tambons.map((t) => t.tambon) : []);
    setTambon((prev) => (a && a.tambons.some((t) => t.tambon === prev) ? prev : ""));
    setZipcode("");
  }, [amphoe, province, addrData]);

  // tambon -> zipcode
  useEffect(() => {
    const p = addrData.find((x) => x.province === province);
    const a = p?.amphoes.find((y) => y.amphoe === amphoe);
    const t = a?.tambons.find((z) => z.tambon === tambon);
    setZipcode(t?.zipcode || "");
  }, [province, amphoe, tambon, addrData]);

  // ===== Prefill แบบหลายสเต็ปตามลิสต์พร้อม =====
  // 1) addrData พร้อมแล้ว ค่อยอัดจังหวัดที่ต้องการ
  useEffect(() => {
    if (!wanted || !addrData.length) return;
    if (wanted.province) setProvince(wanted.province);
  }, [wanted, addrData]);

  // 2) ลิสต์อำเภอพร้อมแล้ว ค่อยตั้งอำเภอ
  useEffect(() => {
    if (!wanted) return;
    if (amphoeList.includes(wanted.amphoe)) setAmphoe(wanted.amphoe);
  }, [amphoeList, wanted]);

  // 3) ลิสต์ตำบลพร้อมแล้ว ค่อยตั้งตำบล (zipcode จะตามเอง)
  useEffect(() => {
    if (!wanted) return;
    if (tambonList.includes(wanted.tambon)) setTambon(wanted.tambon);
  }, [tambonList, wanted]);

  // ดึงพ่อ/แม่พันธุ์ล่าสุด (optional)
  const [freshRabbit, setFreshRabbit] = useState(rabbit || null);
  useEffect(() => {
    if (!rabbit?.rabbit_id) return;
    fetch(`${API_BASE}/api/parents/${rabbit.rabbit_id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setFreshRabbit((prev) => ({ ...prev, ...data })))
      .catch(() => {});
  }, [rabbit?.rabbit_id]);

  // ราคา/วันที่
  const diffDays = (s, e) =>
    !s || !e ? 0 : Math.ceil((new Date(e) - new Date(s)) / 86400000);
  const days = useMemo(() => diffDays(form.date, form.returnDate), [form.date, form.returnDate]);
  const totalPrice = useMemo(() => (days > 0 ? days * pricePerDay : 0), [days, pricePerDay]);
  const minReturnDate = useMemo(() => {
    if (!form.date) return "";
    const d = new Date(form.date);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, [form.date]);

  // สต็อก/สถานะ
  const currentStock = freshRabbit?.stock ?? rabbit?.stock ?? 0;
  const STATUS_LABELS = {
    available: "พร้อมให้เช่า",
    out_of_stock: "ของหมดชั่วคราว",
    unavailable: "ไม่พร้อมให้เช่า",
    breeding: "กำลังยืม",
    reserved: "ถูกจองแล้ว",
  };
  const rawStatus = (freshRabbit?.status ?? rabbit?.status) || "available";
  const isOOS = currentStock <= 0 || String(rawStatus).toLowerCase() === "out_of_stock";
  const currentStatus =
    currentStock <= 0 ? "ของหมดชั่วคราว" : (STATUS_LABELS[String(rawStatus).toLowerCase()] || "พร้อมให้เช่า");

  // ชำระเงิน + สลิป
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState("");
  const pickSlip = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSlipFile(f);
    setSlipPreview(URL.createObjectURL(f));
  };
  const removeSlip = () => {
    setSlipFile(null);
    setSlipPreview("");
  };

  // ตรวจสอบก่อนส่ง
  const needShipOk = detail && province && amphoe && tambon && zipcode;
  const canSubmit =
    !!rabbit &&
    !isOOS &&
    form.name.trim() &&            // ชื่อให้ผู้ใช้กรอกเอง
    phone.length === 10 &&
    needShipOk &&
    form.date &&
    form.returnDate &&
    days > 0 &&
    form.agree &&
    (paymentMethod === "cod" || (paymentMethod === "bank_transfer" && !!slipFile));

  // ส่งคำขอ
  const [success, setSuccess] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  const submitLoan = async (e) => {
    e.preventDefault();
    setError("");
    if (!canSubmit) {
      setError(isOOS ? "ของหมดชั่วคราว" : "กรอกข้อมูลให้ครบ และแนบสลิปหากเลือกโอน");
      return;
    }

    const uid = getUserId(user);
    if (!uid) {
      nav("/login", { state: { from: "/booking", rabbit }, replace: true });
      return;
    }

    try {
      setPlacing(true);

      const address_string = composeAddressString({ detail, tambon, amphoe, province, zipcode });

      const createPayload = {
        rabbit_id: rabbit.rabbit_id ?? rabbit.id ?? rabbit._id,
        borrower_name: form.name.trim(),
        borrower_phone: phone,
        borrower_address: address_string,
        start_date: form.date,
        end_date: form.returnDate,
        notes: form.message || null,
        total_price: Number(totalPrice.toFixed(2)),
        user_id: uid,
        payment_method: paymentMethod,
      };

      const res = await fetch(`${API_BASE}/api/breeding-loans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPayload),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json().catch(() => ({}));
      const loanId = created.loan_id ?? created.id;
      if (!loanId) throw new Error("ไม่พบหมายเลขคำขอ (loan_id)");

      if (paymentMethod === "bank_transfer" && slipFile) {
        const fd = new FormData();
        fd.append("payment_method", "bank_transfer");
        fd.append("payment_amount", String(createPayload.total_price || ""));
        fd.append("payment_ref", `BT-${Date.now()}`);
        fd.append("slip", slipFile);
        const pay = await fetch(`${API_BASE}/api/breeding-loans/${loanId}/pay`, {
          method: "POST",
          body: fd,
        });
        if (!pay.ok) throw new Error(await pay.text());
      }

      setSuccess({
        loan_id: loanId,
        total: createPayload.total_price,
        paid: paymentMethod === "bank_transfer",
      });

      nav(`/my-loans?new=${loanId}`, { replace: true });
    } catch (err) {
      setError(err.message || "ส่งคำขอยืมไม่สำเร็จ");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {!rabbit ? (
        <div>ไม่พบข้อมูลพ่อ/แม่พันธุ์ที่ต้องการยืม</div>
      ) : (
        <>
          <h2 className="text-xl font-bold">🐰 ขอ<strong>ยืมผสมพันธุ์</strong>: {rabbit.name}</h2>

          {isOOS && (
            <div className="bg-red-50 text-red-700 border border-red-200 rounded p-3">
              ของหมดชั่วคราว • คงเหลือ: {currentStock}
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded p-4">
              ✅ ส่งคำขอยืมเรียบร้อย • หมายเลขคำขอ: <b>{success.loan_id}</b>
              {" • "}ยอดโดยประมาณ: <b>{success.total.toFixed(2)} บาท</b>
              <div className="text-sm mt-1 text-emerald-700">
                สถานะเริ่มต้น: <b>{success.paid ? "paid" : "requested"}</b>
              </div>
            </div>
          )}

          <div className="flex gap-6 mb-2">
            <img
              src={freshRabbit?.image || rabbit.image || FALLBACK_IMG}
              alt={rabbit.name}
              className="w-60 h-60 object-cover rounded-lg border"
              onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }}
            />
            <div className="flex-1 space-y-2">
              {(freshRabbit?.breed || rabbit.breed) && <p>🔹 สายพันธุ์: {freshRabbit?.breed ?? rabbit.breed}</p>}
              <p>⚥ เพศ: {(freshRabbit?.gender ?? rabbit.gender) === "male" ? "ผู้" : "เมีย"}</p>
              {(freshRabbit?.age ?? rabbit.age) != null && <p>📅 อายุ: {freshRabbit?.age ?? rabbit.age} ปี</p>}
              <p>📦 คงเหลือ: {currentStock}</p>
              <p>สถานะ: {currentStatus}</p>

              <div className="mt-3 p-3 rounded-lg bg-neutral-50 border">
                <div>💰 ราคาแพ็กพื้นฐาน : {basePrice.toFixed(2)} บาท / {baseDays} วัน</div>
                <div>⇒ เฉลี่ย {pricePerDay.toFixed(2)} บาท/วัน</div>
                {days > 0 ? (
                  <div className="font-semibold text-green-700 mt-1">
                    รวม {days} วัน = {totalPrice.toFixed(2)} บาท
                  </div>
                ) : (
                  <div className="text-neutral-500 mt-1">เลือกวันที่เริ่มและวันสิ้นสุด เพื่อคำนวณราคา</div>
                )}
              </div>
            </div>
          </div>

          <form className="space-y-4" onSubmit={submitLoan}>
            {/* ชื่อ (ไม่เติมอัตโนมัติ) */}
            <div>
              <label className="block mb-1">👤 ชื่อผู้ขอยืม:</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className="border w-full p-2 rounded"
                placeholder="ชื่อ-นามสกุล"
              />
            </div>

            {/* เบอร์ (เติมจากโปรไฟล์ได้) */}
            <div>
              <label className="block mb-1">📞 เบอร์โทร (10 ตัวเลข):</label>
              <input
                type="text"
                value={phone}
                onChange={handlePhoneChange}
                className="border w-full p-2 rounded"
                inputMode="numeric"
                maxLength={10}
                placeholder="09XXXXXXXX"
              />
            </div>

            {/* ที่อยู่แบบเลือก */}
            <div className="space-y-3">
              <div>
                <label className="block mb-1">📍 รายละเอียดที่อยู่</label>
                <textarea
                  rows={2}
                  className="border w-full p-2 rounded"
                  placeholder="บ้านเลขที่ / หมู่บ้าน / ถนน"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1">จังหวัด</label>
                  <select
                    className="border w-full p-2 rounded"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                  >
                    <option value="">เลือกจังหวัด</option>
                    {provList.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1">อำเภอ/เขต</label>
                  <select
                    className="border w-full p-2 rounded"
                    value={amphoe}
                    onChange={(e) => setAmphoe(e.target.value)}
                    disabled={!province}
                  >
                    <option value="">{province ? "เลือกอำเภอ/เขต" : "เลือกจังหวัดก่อน"}</option>
                    {amphoeList.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1">ตำบล/แขวง</label>
                  <select
                    className="border w-full p-2 rounded"
                    value={tambon}
                    onChange={(e) => setTambon(e.target.value)}
                    disabled={!amphoe}
                  >
                    <option value="">{amphoe ? "เลือกตำบล/แขวง" : "เลือกอำเภอก่อน"}</option>
                    {tambonList.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1">รหัสไปรษณีย์</label>
                  <input
                    className="border w-full p-2 rounded bg-neutral-100"
                    value={zipcode}
                    readOnly
                    placeholder="จะเติมอัตโนมัติเมื่อเลือกตำบล"
                  />
                </div>
              </div>
            </div>

            {/* วันที่ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block mb-1">📅 วันที่เริ่มยืม</label>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((s) => ({
                      ...s,
                      date: v,
                      returnDate:
                        s.returnDate && new Date(s.returnDate) > new Date(v)
                          ? s.returnDate
                          : "",
                    }));
                  }}
                  className="border w-full p-2 rounded"
                />
              </div>
              <div>
                <label className="block mb-1">📦 วันที่สิ้นสุด</label>
                <input
                  type="date"
                  name="returnDate"
                  min={minReturnDate || undefined}
                  value={form.returnDate}
                  onChange={handleChange}
                  className="border w-full p-2 rounded"
                />
              </div>
            </div>

            {/* วิธีชำระเงิน */}
            <div className="border-t pt-3">
              <label className="block font-medium mb-1">💳 วิธีชำระเงิน</label>
              <div className="flex gap-3 flex-wrap">
                <label className={`px-3 py-2 rounded border cursor-pointer ${paymentMethod === "cod" ? "bg-black text-white" : "hover:bg-neutral-50"}`}>
                  <input
                    type="radio"
                    className="mr-2"
                    name="pay"
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                  />
                  เก็บเงินปลายทาง (COD)
                </label>
                <label className={`px-3 py-2 rounded border cursor-pointer ${paymentMethod === "bank_transfer" ? "bg-black text-white" : "hover:bg-neutral-50"}`}>
                  <input
                    type="radio"
                    className="mr-2"
                    name="pay"
                    checked={paymentMethod === "bank_transfer"}
                    onChange={() => setPaymentMethod("bank_transfer")}
                  />
                  โอนเงิน/พร้อมเพย์ (แนบสลิป)
                </label>
              </div>

              {paymentMethod === "bank_transfer" && (
                <div className="mt-3">
                  <div className="text-center mb-4">
                    <p className="text-sm text-neutral-600 mb-2">สแกน QR เพื่อชำระเงิน</p>
                    <img
                      src="/images/qrcode.jpg"
                      alt="QR Code สำหรับโอนเงิน"
                      className="w-40 h-40 mx-auto rounded border shadow-sm"
                    />
                  </div>

                  {slipPreview ? (
                    <div className="flex items-center gap-3">
                      <img src={slipPreview} alt="slip" className="w-24 h-24 rounded border object-cover" />
                      <div className="space-x-2">
                        <button type="button" className="px-3 py-2 rounded border"
                          onClick={() => document.getElementById("slipInput").click()}>
                          เปลี่ยนรูป
                        </button>
                        <button type="button" className="px-3 py-2 rounded border border-red-300 text-red-600"
                          onClick={removeSlip}>
                          ลบรูป
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => document.getElementById("slipInput").click()}
                      className="px-4 py-2 rounded border border-dashed w-full text-left hover:bg-neutral-50"
                    >
                      แนบสลิปการโอน
                    </button>
                  )}
                  <input id="slipInput" type="file" accept="image/*" className="hidden" onChange={pickSlip} />
                </div>
              )}
            </div>

            {/* ข้อความ + ยอมรับเงื่อนไข */}
            <div>
              <label className="block mb-1">📝 ข้อความเพิ่มเติม</label>
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                className="border w-full p-2 rounded"
                rows="3"
              />
            </div>
            <div className="border-t pt-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="agree" checked={form.agree} onChange={handleChange} />
                ยอมรับข้อตกลงการยืมผสมพันธุ์
              </label>
            </div>

            {error && <div className="text-red-600 text-sm">{error}</div>}

            <button
              type="submit"
              disabled={!canSubmit || placing}
              className={`py-2 px-4 rounded text-white ${
                !canSubmit || placing ? "bg-neutral-400 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
              }`}
            >
              {placing ? "กำลังบันทึก..." : "ยืนยันการยืมผสมพันธุ์"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
