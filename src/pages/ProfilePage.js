// src/pages/ProfilePage.jsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUserAlt } from 'react-icons/fa';

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  // ===== UI helpers
  const FIELD_CLS = "w-full h-10 border-b border-black focus:outline-none px-2 rounded-none";

  // ===== รูปโปรไฟล์
  const [serverUrl, setServerUrl] = useState(null);
  const [localPreview, setLocalPreview] = useState(null);
  const [imgError, setImgError] = useState(false);
  const retryRef = useRef(0);
  const fileInputRef = useRef(null);

  // ===== เพศ
  const [gender, setGender] = useState(user?.gender ?? '');
  const [genderDirty, setGenderDirty] = useState(false);

  // ===== อินพุตทั่วไป
  const usernameRef = useRef();
  const emailRef = useRef();
  const phoneRef = useRef();

  // ===== ที่อยู่ (รายละเอียด)
  const addressDetailRef = useRef();

  // ===== ที่อยู่แบบเลือก
  const [addressData, setAddressData] = useState([]);
  const [province, setProvince] = useState('');
  const [amphoe, setAmphoe] = useState('');      // district
  const [tambon, setTambon] = useState('');      // subdistrict
  const [zipcode, setZipcode] = useState('');

  // ===== ฟังก์ชันช่วย
  const toDisplayUrl = useCallback((src) => {
    if (!src) return null;
    const base = String(src).split('?')[0];
    return `${base}?v=${Date.now()}`;
  }, []);

  const preloadAndSet = useCallback(async (url) => {
    if (!url) return;
    try {
      const img = new Image();
      img.src = url;
      if (img.decode) await img.decode();
      else await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      setServerUrl(url);
      setImgError(false);
      retryRef.current = 0;
      setLocalPreview(null);
    } catch {
      if (retryRef.current < 1) {
        retryRef.current += 1;
        await preloadAndSet(toDisplayUrl(url));
      } else {
        setImgError(true);
      }
    }
  }, [toDisplayUrl]);

  // แปลงสตริง address ↔ object (detail|tambon|amphoe|province|zipcode)
  const parseAddressString = (addrStr = '') => {
    const parts = String(addrStr).split('|').map(s => s.trim());
    return {
      detail: parts[0] || '',
      tambon: parts[1] || '',
      amphoe: parts[2] || '',
      province: parts[3] || '',
      zipcode: parts[4] || '',
    };
  };


  // โหลดไฟล์จังหวัด/อำเภอ/ตำบล
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/thai-address.json');
        const json = await res.json();
        setAddressData(json || []);
      } catch (e) { console.error('โหลด thai-address.json ไม่สำเร็จ', e); }
    })();
  }, []);

  // โหลด user และพรีฟิล
  useEffect(() => {
    if (!user || addressData.length === 0) {
      if (!user) navigate('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/users/${user.user_id}`);
        if (!res.ok) throw new Error('Failed to fetch user data');
        const data = await res.json();

        // รูป
        const showUrl = toDisplayUrl((data.profile_image || '').split('?')[0]);
        await preloadAndSet(showUrl);

        // ฟิลด์ทั่วไป
        if (usernameRef.current) usernameRef.current.value = data.username ?? user.username ?? '';
        if (emailRef.current)    emailRef.current.value    = data.email ?? user.email ?? '';
        if (phoneRef.current)    phoneRef.current.value    = data.phone ?? user.phone ?? '';
        if (!genderDirty) setGender(data.gender || '');

        // ===== Prefill Address (คอลัมน์ใหม่มาก่อน / ถ้าไม่มี ใช้ address string เดิม)
        const fromNewCols =
          (data.province || data.district || data.subdistrict || data.zipcode) ? {
            detail: (parseAddressString(data.address || '').detail || ''),
            province: data.province || '',
            amphoe: data.district || '',
            tambon: data.subdistrict || '',
            zipcode: data.zipcode || ''
          } : null;

        const parsed = fromNewCols || parseAddressString(data.address || user.address || '');

        if (addressDetailRef.current) addressDetailRef.current.value = parsed.detail || '';
        setProvince(parsed.province);
        setAmphoe(parsed.amphoe);
        setTambon(parsed.tambon);
        setZipcode(parsed.zipcode);
      } catch (e) {
        console.error(e);
      }
    };

    fetchData();
  }, [user, navigate, genderDirty, preloadAndSet, toDisplayUrl, addressData]);

  // พรีวิวรูป: clear URL object
  useEffect(() => {
    if (!localPreview) return;
    return () => URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  if (!user) return null;

  // ===== Address dropdown handlers
  const handleProvinceChange = (e) => {
    const selectedProvince = e.target.value;
    setProvince(selectedProvince);
    setAmphoe('');
    setTambon('');
    setZipcode('');
  };

  const handleAmphoeChange = (e) => {
    const selectedAmphoe = e.target.value;
    setAmphoe(selectedAmphoe);
    setTambon('');
    setZipcode('');
  };

  const handleTambonChange = (e) => {
    const selectedTambon = e.target.value;
    setTambon(selectedTambon);

    const provinceObj = addressData.find(p => p.province === province);
    const amphoeObj = provinceObj?.amphoes.find(a => a.amphoe === amphoe);
    const tambonObj = amphoeObj?.tambons.find(t => t.tambon === selectedTambon);

    setZipcode(tambonObj?.zipcode || '');
  };

  // ===== Dropdown options
  const provinceList = addressData.map(p => p.province);
  const amphoeList =
    addressData.find(p => p.province === province)?.amphoes.map(a => a.amphoe) || [];
  const tambonList =
    addressData.find(p => p.province === province)?.amphoes.find(a => a.amphoe === amphoe)?.tambons.map(t => t.tambon) || [];

  // ===== Upload รูป
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowed.includes(file.type)) { alert('รองรับเฉพาะไฟล์ JPG/PNG/WEBP เท่านั้น'); e.target.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { alert('ขนาดรูปต้องไม่เกิน 5MB'); e.target.value = ''; return; }

    setLocalPreview(URL.createObjectURL(file));
    setImgError(false);

    try {
      const formData = new FormData();
      formData.append('profileImage', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

      const cleanUrl = String(uploadData.url || '').split('?')[0];
      const displayUrl = toDisplayUrl(cleanUrl);

      const updateRes = await fetch(`/api/users/${user.user_id}/profile-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileImage: cleanUrl }),
      });
      const updateData = await updateRes.json();
      if (!updateRes.ok) throw new Error(updateData.error || 'Update failed');

      await preloadAndSet(displayUrl);

      updateUser({ ...user, profileImage: cleanUrl });
    } catch (err) { console.error(err); alert(err.message); }
  };

  // ===== บันทึกโปรไฟล์
  const handleSave = async () => {
    try {
      const phoneValue = (phoneRef.current?.value || '').trim();
      if (phoneValue !== '' && phoneValue.length !== 10) {
        alert('กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 ตัว'); return;
      }

      const normalizedImage = (() => {
        const src = (serverUrl || user.profileImage || '');
        if (!src) return null;
        return String(src).split('?')[0];
      })();

      const addressDetail = (addressDetailRef.current?.value || '').trim();

      const updatedUser = {
        username: usernameRef.current?.value ?? '',
        phone: phoneValue,
        address: addressDetail,   // ✅ ส่งเฉพาะ detail
        gender,
        profileImage: normalizedImage,
        // ===== คอลัมน์ใหม่ในตาราง users =====
        province,
        district: amphoe,
        subdistrict: tambon,
        zipcode
      };

      const res = await fetch(`/api/users/${user.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกข้อมูลไม่สำเร็จ');

      const profileUrl = toDisplayUrl((data.profile_image || '').split('?')[0]);
      await preloadAndSet(profileUrl);

      // อัปเดต AuthContext ให้ตรงกับ DB
      updateUser({
        ...user,
        username: data.username,
        phone: data.phone,
        email: data.email,
        address: data.address,
        gender: data.gender,
        profileImage: data.profile_image,
        province: data.province,
        district: data.district,
        subdistrict: data.subdistrict,
        zipcode: data.zipcode
      });

      setGenderDirty(false);
      alert('✅ บันทึกข้อมูลสำเร็จ');
    } catch (err) { alert(err.message); }
  };

  const handleLogout = () => { logout(); window.location.reload(); };

  const displaySrc = localPreview || serverUrl || user.profileImage || '';
  const hasRealImage = Boolean(localPreview || serverUrl || user.profileImage);

  return (
    <div className="flex h-screen bg-black text-white">
      {/* ซ้าย */}
      <div className="w-20 md:w-48 bg-black flex flex-col items-center py-6 space-y-10">
        <div className="text-sm md:text-base font-semibold">Profile</div>
      </div>

      {/* ขวา */}
      <div className="flex-1 bg-white text-black rounded-tl-3xl p-8 overflow-auto">
        <h2 className="text-xl font-bold mb-4">EDIT YOUR PROFILE</h2>

        {/* รูปโปรไฟล์ */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white flex items-center justify-center bg-gray-200">
            {hasRealImage ? (
              <img
                key={displaySrc}
                src={displaySrc}
                alt="profile"
                className="w-full h-full object-cover"
                loading="lazy"
                onLoad={() => setImgError(false)}
                onError={() => {
                  if (!hasRealImage) return;
                  if (retryRef.current < 1 && displaySrc && displaySrc.includes('?v=')) {
                    retryRef.current += 1;
                    const base = displaySrc.split('?')[0];
                    setServerUrl(`${base}?v=${Date.now() + 1}`);
                  } else { setImgError(true); }
                }}
              />
            ) : (
              <FaUserAlt className="text-gray-400 w-12 h-12" />
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-1 right-1 w-6 h-6 bg-white border-2 border-white rounded-full shadow flex items-center justify-center hover:bg-gray-100 transition"
              title="เปลี่ยนรูปโปรไฟล์"
              style={{ boxShadow: '0 0 4px rgba(0,0,0,0.15)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6.536-6.536a2 2 0 112.828 2.828L11.828 13.828a2 2 0 01-1.414.586H9v-1.414a2 2 0 01.586-1.414z" />
              </svg>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>
          {imgError && hasRealImage && (
            <p className="text-xs text-red-500 mt-2">โหลดรูปไม่สำเร็จ ลองเปลี่ยนรูปหรือบันทึกใหม่อีกครั้ง</p>
          )}
        </div>

        {/* ฟอร์ม */}
        <div className="space-y-4 max-w-md mx-auto">
          <div>
            <label className="block text-sm font-semibold mb-1">Username</label>
            <input type="text" ref={usernameRef} className={FIELD_CLS} defaultValue={user.username} />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input
              type="email"
              ref={emailRef}
              className={`${FIELD_CLS} bg-gray-100 cursor-not-allowed`}
              defaultValue={user.email}
              disabled readOnly aria-disabled="true" autoComplete="off"
              title="อีเมลไม่สามารถแก้ไขได้"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Phone</label>
            <input type="tel" ref={phoneRef} className={FIELD_CLS} defaultValue={user.phone} maxLength={10} />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">รายละเอียดที่อยู่</label>
            <input
              type="text"
              ref={addressDetailRef}
              className={FIELD_CLS}
              placeholder="บ้านเลขที่ / หมู่บ้าน / ถนน"
              defaultValue={(() => parseAddressString(user.address || '').detail || '')()}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">จังหวัด</label>
            <select value={province} onChange={handleProvinceChange} className={FIELD_CLS}>
              <option value="">เลือกจังหวัด</option>
              {provinceList.map((p) => (<option key={p} value={p}>{p}</option>))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">อำเภอ/เขต</label>
            <select value={amphoe} onChange={handleAmphoeChange} className={FIELD_CLS} disabled={!province}>
              <option value="">{province ? 'เลือกอำเภอ/เขต' : 'กรุณาเลือกจังหวัดก่อน'}</option>
              {amphoeList.map((a) => (<option key={a} value={a}>{a}</option>))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">ตำบล/แขวง</label>
            <select value={tambon} onChange={handleTambonChange} className={FIELD_CLS} disabled={!amphoe}>
              <option value="">{amphoe ? 'เลือกตำบล/แขวง' : 'กรุณาเลือกอำเภอก่อน'}</option>
              {tambonList.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">รหัสไปรษณีย์</label>
            <input type="text" value={zipcode} readOnly className={`${FIELD_CLS} bg-gray-100`} placeholder="จะเติมอัตโนมัติเมื่อเลือกตำบล" />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Gender</label>
            <select
              value={gender}
              onChange={(e) => { setGenderDirty(true); setGender(e.target.value); }}
              className={FIELD_CLS}
            >
              <option value="">ไม่ระบุ</option>
              <option value="male">ชาย</option>
              <option value="female">หญิง</option>
              <option value="other">อื่นๆ</option>
            </select>
          </div>
        </div>

        {/* ปุ่ม */}
        <div className="mt-6 text-center">
          <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-blue-700 transition">
            บันทึก
          </button>
        </div>

        <div className="mt-8 flex justify-end">
          <button onClick={handleLogout} className="bg-black text-white px-6 py-2 rounded-full font-semibold hover:bg-gray-800 transition">
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}
