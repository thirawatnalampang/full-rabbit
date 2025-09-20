// src/pages/CheckoutPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const formatTHB = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(Number(n || 0));
const FALLBACK_IMG = "https://placehold.co/80x80?text=Img";

/* ---------- item helpers ---------- */
function getImage(it) { return it.image || it.image_url || it.img || it.photo || FALLBACK_IMG; }
function getName(it) { return it.name || it.title || it.product_name || it.rabbit_name || "ไม่มีชื่อ"; }
function getUnitPrice(it) { return Number(it.price ?? it.unitPrice ?? it.amount ?? 0); }
function getQty(it) { return Math.max(0, Number(it.quantity ?? it.qty ?? 1)); }
function getId(it) { return it.id ?? it.product_id ?? it.rabbit_id ?? it._id ?? String(it.name || Math.random()); }
function getType(it) {
  if (it.type) return String(it.type).toLowerCase();
  const cat = String(it.category || "").toLowerCase();
  if (cat.includes("equip")) return "equipment";
  if (cat.includes("food")) return "pet-food";
  return "rabbit";
}
const toInt = (v) => {
  if (v == null) return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const m = v.match(/\d+/);
    return m ? Number(m[0]) : NaN;
  }
  return NaN;
};
function toOrderItem(it) {
  const type = getType(it);
  const qty = getQty(it);
  const unit_price = getUnitPrice(it);

  if (type === "rabbit") {
    const rabbit_id = toInt(it.rabbit_id ?? it.base_id ?? it.id);
    if (!Number.isInteger(rabbit_id) || rabbit_id <= 0) return null;
    return { type: "rabbit", rabbit_id, id: rabbit_id, base_id: rabbit_id, name: getName(it), image: getImage(it), unit_price, qty };
  }
  const product_id = toInt(it.product_id ?? it.base_id ?? it.id);
  if (!Number.isInteger(product_id) || product_id <= 0) return null;
  return { type, product_id, id: product_id, base_id: product_id, name: getName(it), image: getImage(it), unit_price, qty };
}

/* ---------- address helpers ---------- */
const parseAddressString = (addrStr = "") => {
  const p = String(addrStr).split("|").map(s => s.trim());
  return { detail: p[0]||"", tambon: p[1]||"", amphoe: p[2]||"", province: p[3]||"", zipcode: p[4]||"" };
};

// normalize helpers เหมือนเดิม...
const clean = (s="") => String(s).trim().replace(/\s+/g, " ");
const norm  = (s="") => clean(s).toLowerCase();
const normalizeProvince = (p="") => clean(p).replace(/^จังหวัด\s*/, '');
const normalizeAmphoe   = (a="") => clean(a).replace(/^(อำเภอ|อําเภอ|เขต)\s*/, '');
const normalizeTambon   = (t="") => clean(t).replace(/^(ตำบล|แขวง)\s*/, '');

/** รวมค่าที่อยู่จากโปรไฟล์ (ยกเว้นชื่อ) */
const prefillFromProfile = (profile) => {
  const p = profile || {};
  // ถ้ามีคอลัมน์ใหม่ ใช้ก่อน; ไม่งั้นแยกจาก address เดิม
  const haveNewCols = p.province || p.district || p.subdistrict || p.zipcode;
  const parsed = haveNewCols
    ? { detail: parseAddressString(p.address || "").detail || "",
        province: p.province || "",
        amphoe: p.district || "",
        tambon: p.subdistrict || "",
        zipcode: p.zipcode || "" }
    : parseAddressString(p.address || "");

  return {
    phone: p.phone || p.tel || "",
    detail: parsed.detail || p.detail || "",
    province: parsed.province || "",
    amphoe: parsed.amphoe || "",
    tambon: parsed.tambon || "",
    zipcode: parsed.zipcode || "",
  };
};

/* ---------- config ---------- */
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3000";
const SHIPPING_THRESHOLD = 1500;
const SHIPPING_STD = 50;
const SHIPPING_EXPRESS = 90;

export default function CheckoutPage() {
  const { user } = useAuth();
  const { cartItems, clearCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => { if (!user) navigate("/get-started", { state: { from: "/checkout" } }); }, [user, navigate]);

  // ผลลัพธ์สำเร็จ
  const [success, setSuccess] = useState(null); // { orderId, total }

  // ฟอร์มหลัก
  const [form, setForm] = useState({
    fullName: "",        // ไม่ auto-fill ชื่อ
    phone: "",
    detail: "",          // บ้านเลขที่/หมู่บ้าน/ถนน
    note: "",
    shippingMethod: "standard",
    paymentMethod: "cod",
  });

  // dropdown จังหวัด/อำเภอ/ตำบล
  const [addrData, setAddrData] = useState([]);
  const [addrReady, setAddrReady] = useState(false);
  const [provList, setProvList] = useState([]);
  const [amphoeList, setAmphoeList] = useState([]);
  const [tambonList, setTambonList] = useState([]);
  const [province, setProvince] = useState("");
  const [amphoe, setAmphoe] = useState("");
  const [tambon, setTambon] = useState("");
  const [zipcode, setZipcode] = useState("");

  // โหลดไฟล์ตำแหน่งที่อยู่ (จาก public/thai-address.json)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/thai-address.json");
        const j = await r.json();
        setAddrData(j || []);
        setProvList((j || []).map(p => p.province));
      } catch(e) {
        console.error("โหลด thai-address.json ไม่สำเร็จ", e);
      } finally {
        setAddrReady(true);
      }
    })();
  }, []);
 // ⬇️ แทนที่ useEffect พรีฟิลเดิมทั้งหมดด้วยอันนี้
const [prefilledOnce, setPrefilledOnce] = useState(false);

useEffect(() => {
  if (!user || prefilledOnce || !addrReady) return;

  (async () => {
    // 1) ดึงโปรไฟล์ล่าสุดจาก DB (ถ้าทำได้)
    let profileLike = user.profile || user;
    try {
      const uid = user?.user_id || user?.id;
      if (uid) {
        const r = await fetch(`${API_BASE}/api/users/${uid}`);
        if (r.ok) profileLike = await r.json();
      }
    } catch (_) {}

    // 2) ดึงค่าจากโปรไฟล์ (รองรับคอลัมน์ใหม่: province/district/subdistrict/zipcode)
    const pf = prefillFromProfile(profileLike);

    // 3) หา “ค่าจริงใน dataset” เพื่อให้ตรงกับ option
    const wantProv = normalizeProvince(pf.province || "");
    const wantAmp  = normalizeAmphoe(pf.amphoe || "");
    const wantTam  = normalizeTambon(pf.tambon || "");

    const provObj = addrData.find(p => norm(p.province) === norm(wantProv)) || null;
    const ampObj  = provObj?.amphoes.find(a => norm(a.amphoe) === norm(wantAmp)) || null;
    const tamObj  = ampObj?.tambons.find(t => norm(t.tambon) === norm(wantTam)) || null;

    // 4) เติมฟอร์ม (ไม่แตะชื่อผู้รับ)
    setForm(s => ({ ...s, phone: s.phone || pf.phone, detail: s.detail || pf.detail }));

    setProvince(provObj?.province || "");
    setAmphoe(ampObj?.amphoe || "");
    setTambon(tamObj?.tambon || "");
    setZipcode(tamObj?.zipcode || pf.zipcode || "");

    setPrefilledOnce(true);
  })();
}, [user, prefilledOnce, addrReady, addrData]);
  useEffect(() => {
  if (!addrReady) return;

  const p = addrData.find(x => norm(x.province) === norm(province));
  const newAmphoes = p ? p.amphoes.map(a => a.amphoe) : [];
  setAmphoeList(newAmphoes);
  setAmphoe(prev => (p && p.amphoes.some(a => norm(a.amphoe) === norm(prev)) ? prev : ""));

  const a = p?.amphoes.find(y => norm(y.amphoe) === norm(amphoe));
  const newTambons = a ? a.tambons.map(t => t.tambon) : [];
  setTambonList(newTambons);
  setTambon(prev => (a && a.tambons.some(t => norm(t.tambon) === norm(prev)) ? prev : ""));

  const t = a?.tambons.find(z => norm(z.tambon) === norm(tambon));
  setZipcode(t?.zipcode || "");
}, [addrReady, addrData, province, amphoe, tambon]);
  // slip upload
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState("");
  const onPickSlip = (e) => { const f = e.target.files?.[0]; if (!f) return; setSlipFile(f); setSlipPreview(URL.createObjectURL(f)); };
  const removeSlip = () => { setSlipFile(null); setSlipPreview(""); };

  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  const items = useMemo(() => cartItems.filter((it) => getQty(it) > 0), [cartItems]);
  const subtotal = useMemo(() => items.reduce((s, it) => s + getUnitPrice(it) * getQty(it), 0), [items]);
  const shippingFee = useMemo(() => {
    if (form.shippingMethod === "pickup") return 0;
    if (subtotal >= SHIPPING_THRESHOLD) return 0;
    return form.shippingMethod === "express" ? SHIPPING_EXPRESS : SHIPPING_STD;
  }, [form.shippingMethod, subtotal]);
  const total = subtotal + shippingFee;

  const canPlace = useMemo(() => {
    if (items.length === 0) return false;
    const needShip = form.shippingMethod !== "pickup";
    const baseOk = form.fullName && form.phone && (!needShip || (form.detail && province && amphoe && tambon && zipcode));
    if (!baseOk) return false;
    if (form.paymentMethod === "bank_transfer" && !slipFile) return false;
    return true;
  }, [items.length, form, province, amphoe, tambon, zipcode, slipFile]);

  const handleChange = (e) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));

  async function placeOrder() {
    setError("");
    if (!canPlace) {
      setError(form.paymentMethod === "bank_transfer" && !slipFile ? "กรุณาแนบรูปสลิปการโอนเงิน" : "กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    setPlacing(true);
    try {
      

      const payload = {
        user_id: user?.id ?? user?.user_id ?? null,
        contact: { full_name: form.fullName, phone: form.phone },
        shipping: {
          method: form.shippingMethod,
          address: form.shippingMethod === "pickup" ? null : {
            detail: form.detail, province, amphoe, tambon, zipcode
            
          },
          fee: shippingFee,
        },
        payment: { method: form.paymentMethod, status: form.paymentMethod === "cod" ? "unpaid" : "unpaid" },
        note: form.note || null,
        items: items.map(toOrderItem),
        summary: { subtotal, shipping: shippingFee, total, currency: "THB" },
      };

      let res;
      if (form.paymentMethod === "bank_transfer") {
        const fd = new FormData();
        fd.append("order", JSON.stringify(payload));
        fd.append("slip", slipFile);
        res = await fetch(`${API_BASE}/api/orders`, { method: "POST", body: fd });
      } else {
        res = await fetch(`${API_BASE}/api/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      let orderId;
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        orderId = data?.order_id || data?.id || data?.orderId || Date.now().toString();
      } else {
        orderId = `TEMP-${Date.now()}`;
      }

      clearCart();
      setSuccess({ orderId, total });
    } catch (err) {
      console.error("placeOrder error:", err);
      setError("มีข้อผิดพลาดในการบันทึกคำสั่งซื้อ ลองใหม่อีกครั้ง");
    } finally { setPlacing(false); }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      {/* breadcrumb */}
      <div className="text-sm text-neutral-500 mb-2">
        <Link to="/" className="hover:underline">หน้าแรก</Link> <span className="mx-1">/</span>{" "}
        <Link to="/cart" className="hover:underline">ตะกร้า</Link> <span className="mx-1">/</span>{" "}
        เช็คเอาต์
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight mb-6">🧾 เช็คเอาต์</h1>

      {success && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-5">
          <div className="text-2xl mb-1">🎉 สั่งซื้อสำเร็จ!</div>
          <div className="text-sm">
            หมายเลขคำสั่งซื้อ: <span className="font-semibold">{success.orderId}</span> •
            ยอดรวม: <span className="font-semibold">{formatTHB(success.total)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link to="/my-orders" className="px-4 py-2 rounded-xl border hover:bg-emerald-100">ไปที่คำสั่งซื้อของฉัน</Link>
            <Link to="/" className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white">กลับหน้าแรก</Link>
          </div>
        </div>
      )}

      {success ? null : items.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border p-10 text-center">
          <p className="text-lg text-neutral-600">ตะกร้าของคุณว่างเปล่า</p>
          <Link to="/" className="mt-4 inline-block px-4 py-2 rounded-full border hover:bg-neutral-50">เลือกสินค้าต่อ</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* ซ้าย: ฟอร์มข้อมูล */}
          <div className="md:col-span-2 space-y-6">
            <section className="bg-white border rounded-2xl p-5 shadow-sm">
              <h2 className="text-lg font-bold">ข้อมูลผู้รับ & การจัดส่ง</h2>

              <div className="mt-3 flex gap-3 flex-wrap">
                <label className={`px-3 py-2 rounded-xl border cursor-pointer ${form.shippingMethod === "standard" ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"}`}>
                  <input type="radio" className="mr-2" name="shippingMethod" value="standard"
                    checked={form.shippingMethod === "standard"} onChange={handleChange}/>
                  ส่งปกติ (3-5 วัน) {subtotal >= SHIPPING_THRESHOLD ? "– ฟรี" : `– ${formatTHB(SHIPPING_STD)}`}
                </label>
                <label className={`px-3 py-2 rounded-xl border cursor-pointer ${form.shippingMethod === "express" ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"}`}>
                  <input type="radio" className="mr-2" name="shippingMethod" value="express"
                    checked={form.shippingMethod === "express"} onChange={handleChange}/>
                  ส่งด่วน (1-2 วัน) {subtotal >= SHIPPING_THRESHOLD ? "– ฟรี" : `– ${formatTHB(SHIPPING_EXPRESS)}`}
                </label>
                <label className={`px-3 py-2 rounded-xl border cursor-pointer ${form.shippingMethod === "pickup" ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"}`}>
                  <input type="radio" className="mr-2" name="shippingMethod" value="pickup"
                    checked={form.shippingMethod === "pickup"} onChange={handleChange}/>
                  มารับเองที่ร้าน – ฟรี
                </label>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-neutral-600 mb-1">ชื่อ-นามสกุล</label>
                  <input name="fullName" className="w-full border rounded-xl px-3 py-2"
                    value={form.fullName} onChange={handleChange} placeholder="ชื่อผู้รับ"/>
                </div>
                <div>
                  <label className="block text-sm text-neutral-600 mb-1">เบอร์โทร</label>
                  <input name="phone" className="w-full border rounded-xl px-3 py-2"
                    value={form.phone} onChange={handleChange} placeholder="0812345678"/>
                </div>
              </div>

              {form.shippingMethod !== "pickup" && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-neutral-600 mb-1">รายละเอียดที่อยู่</label>
                    <textarea name="detail" className="w-full border rounded-xl px-3 py-2" rows={2}
                      value={form.detail} onChange={handleChange} placeholder="บ้านเลขที่ / หมู่บ้าน / ถนน"/>
                  </div>

                  <div>
                    <label className="block text-sm text-neutral-600 mb-1">จังหวัด</label>
                    <select className="w-full border rounded-xl px-3 py-2"
                      value={province} onChange={(e)=>setProvince(e.target.value)}>
                      <option value="">{addrReady ? "เลือกจังหวัด" : "กำลังโหลด..."}</option>
                      {provList.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-neutral-600 mb-1">อำเภอ/เขต</label>
                    <select className="w-full border rounded-xl px-3 py-2" disabled={!province}
                      value={amphoe} onChange={(e)=>setAmphoe(e.target.value)}>
                      <option value="">{province ? "เลือกอำเภอ/เขต" : "เลือกจังหวัดก่อน"}</option>
                      {amphoeList.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-neutral-600 mb-1">ตำบล/แขวง</label>
                    <select className="w-full border rounded-xl px-3 py-2" disabled={!amphoe}
                      value={tambon} onChange={(e)=>setTambon(e.target.value)}>
                      <option value="">{amphoe ? "เลือกตำบล/แขวง" : "เลือกอำเภอก่อน"}</option>
                      {tambonList.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-neutral-600 mb-1">รหัสไปรษณีย์</label>
                    <input className="w-full border rounded-xl px-3 py-2 bg-neutral-100" readOnly value={zipcode} placeholder="จะเติมอัตโนมัติเมื่อเลือกตำบล"/>
                  </div>
                </div>
              )}

              <div className="mt-4">
                <label className="block text-sm text-neutral-600 mb-1">หมายเหตุ (ถ้ามี)</label>
                <input name="note" className="w-full border rounded-xl px-3 py-2"
                  value={form.note} onChange={handleChange} placeholder="ตัวอย่าง: ส่งหลัง 6 โมงเย็น"/>
              </div>
            </section>

            {/* วิธีชำระเงิน */}
            <section className="bg-white border rounded-2xl p-5 shadow-sm">
              <h2 className="text-lg font-bold">วิธีชำระเงิน</h2>
              <div className="mt-3 flex gap-3 flex-wrap">
                <label className={`px-3 py-2 rounded-xl border cursor-pointer ${form.paymentMethod === "cod" ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"}`}>
                  <input type="radio" className="mr-2" name="paymentMethod" value="cod"
                    checked={form.paymentMethod === "cod"} onChange={handleChange}/>
                  เก็บเงินปลายทาง (COD)
                </label>
                <label className={`px-3 py-2 rounded-xl border cursor-pointer ${form.paymentMethod === "bank_transfer" ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"}`}>
                  <input type="radio" className="mr-2" name="paymentMethod" value="bank_transfer"
                    checked={form.paymentMethod === "bank_transfer"} onChange={handleChange}/>
                  โอนผ่านธนาคาร 1234-7625-899987 / พร้อมเพย์ 0988405158
                </label>
              </div>

              {form.paymentMethod === "bank_transfer" && (
                <div className="mt-4 space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-neutral-600 mb-2">สแกน QR เพื่อชำระเงิน</p>
                    <img
                      src="/images/qrcode.jpg"
                      alt="QR Code สำหรับโอนเงิน"
                      className="w-48 h-48 mx-auto rounded-xl border shadow-sm"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                    <p className="mt-2 text-xs text-neutral-500">
                      * หลังโอนเงินแล้ว กรุณาอัปโหลดสลิปเพื่อยืนยัน
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm text-neutral-600 mb-2">แนบสลิปการโอน (จำเป็น)</label>

                    {slipPreview ? (
                      <div className="flex items-center gap-3">
                        <img src={slipPreview} alt="slip preview" className="w-28 h-28 object-cover rounded-xl border"/>
                        <div className="space-x-2">
                          <button type="button" onClick={() => document.getElementById("slipInput").click()}
                            className="px-3 py-2 rounded-lg border hover:bg-neutral-50">เปลี่ยนรูป</button>
                          <button type="button" onClick={removeSlip}
                            className="px-3 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50">ลบรูป</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => document.getElementById("slipInput").click()}
                        className="px-4 py-2 rounded-xl border border-dashed w-full text-left hover:bg-neutral-50">
                        อัปโหลดสลิป (JPG, PNG)
                      </button>
                    )}

                    <input id="slipInput" type="file" accept="image/*" className="hidden" onChange={onPickSlip}/>
                    <p className="mt-2 text-xs text-neutral-500">* รองรับไฟล์ภาพ .jpg .png ขนาดไม่เกิน ~5MB</p>
                  </div>
                </div>
              )}

              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3">{error}</div>}
            </section>
          </div>

          {/* ขวา: สรุปคำสั่งซื้อ */}
          <aside className="md:col-span-1">
            <div className="bg-white border rounded-2xl p-5 shadow-sm md:sticky md:top-6">
              <h2 className="text-lg font-bold mb-4">สรุปคำสั่งซื้อ</h2>

              <div className="space-y-3 max-h-64 overflow-auto pr-1">
                {items.map((it) => (
                  <div key={getId(it)} className="flex items-center gap-3">
                    <img src={getImage(it)} alt={getName(it)} className="w-14 h-14 rounded-lg object-cover"
                      onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium line-clamp-1">{getName(it)}</div>
                      <div className="text-xs text-neutral-500">x{getQty(it)}</div>
                    </div>
                    <div className="text-sm font-semibold">{formatTHB(getUnitPrice(it) * getQty(it))}</div>
                  </div>
                ))}
              </div>

              <div className="my-4 border-t" />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>ยอดรวมสินค้า</span><span className="font-medium">{formatTHB(subtotal)}</span></div>
                <div className="flex justify-between"><span>ค่าจัดส่ง</span><span className="font-medium">{subtotal >= SHIPPING_THRESHOLD ? "ฟรี" : formatTHB(shippingFee)}</span></div>
              </div>
              <div className="my-4 border-t" />
              <div className="flex justify-between items-center text-base font-semibold">
                <span>ราคารวม</span><span className="text-emerald-600">{formatTHB(total)}</span>
              </div>

              <button
                disabled={!canPlace || placing}
                onClick={placeOrder}
                className={`mt-5 w-full text-white font-semibold py-3 rounded-xl shadow-md transition-transform ${
                  !canPlace || placing ? "bg-neutral-300 cursor-not-allowed"
                  : "bg-pink-500 hover:bg-pink-600 hover:scale-[1.01] active:scale-[0.99]"
                }`}
              >
                {placing ? "กำลังดำเนินการ..." : "✅ ยืนยันสั่งซื้อ"}
              </button>

              <p className="mt-3 text-xs text-neutral-500">
                * ออเดอร์ที่ส่งแล้วไม่สามารถแก้ไขได้ โปรดตรวจสอบข้อมูลให้ถูกต้อง
              </p>

              <div className="mt-4 text-center">
                <Link to="/cart" className="text-sm text-neutral-600 hover:text-neutral-800">← กลับไปตะกร้า</Link>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
