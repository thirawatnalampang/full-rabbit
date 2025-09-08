import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaUserAlt } from 'react-icons/fa'; // ✅ เพิ่มไอคอนโปรไฟล์

export default function ProfilePage() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  // รูป
  const [selectedImage, setSelectedImage] = useState(null);
  const [serverUrl, setServerUrl] = useState(null);
  const [localPreview, setLocalPreview] = useState(null);
  const [imgError, setImgError] = useState(false);
  const retryRef = useRef(0);

  // เพศ
  const [gender, setGender] = useState(user?.gender ?? '');
  const [genderDirty, setGenderDirty] = useState(false);

  // อินพุต
  const usernameRef = useRef();
  const emailRef = useRef();
  const phoneRef = useRef();
  const addressRef = useRef();
  const fileInputRef = useRef();

  const mergeUser = useCallback((prev, incoming) => {
    const next = { ...prev, ...incoming };
    next.role = (incoming?.role ?? prev?.role);
    return next;
  }, []);

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
      if (img.decode) {
        await img.decode();
      } else {
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
        });
      }
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

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/users/${user.user_id}`);
        if (!res.ok) throw new Error('Failed to fetch user data');
        const data = await res.json();

        const base = (data.profile_image || '').split('?')[0];
        const showUrl = toDisplayUrl(base);
        await preloadAndSet(showUrl);

        if (!genderDirty) setGender(data.gender || '');
      } catch (err) {
        console.error(err);
      }
    })();
  }, [user, navigate, genderDirty, preloadAndSet, toDisplayUrl]);

  useEffect(() => {
    if (!selectedImage) return;
    const objectUrl = URL.createObjectURL(selectedImage);
    setLocalPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedImage]);

  if (!user) return null;

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      alert('รองรับเฉพาะไฟล์ JPG/PNG/WEBP เท่านั้น');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('ขนาดรูปต้องไม่เกิน 5MB');
      e.target.value = '';
      return;
    }

    setSelectedImage(file);
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

      login(
        mergeUser(user, {
          ...(updateData.user || {}),
          profileImage: displayUrl,
          gender: gender,
        })
      );

      setSelectedImage(null);
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleSave = async () => {
    try {
      const phoneValue = phoneRef.current.value.trim();
      if (phoneValue !== '' && phoneValue.length !== 10) {
        alert('กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 ตัว');
        return;
      }

      const normalizedImage = (() => {
        const src = (serverUrl || user.profileImage || '');
        if (!src) return null;
        return String(src).split('?')[0];
      })();

      const updatedUser = {
        username: usernameRef.current.value,
        email: emailRef.current.value,
        phone: phoneValue,
        address: addressRef.current.value,
        gender,
        profileImage: normalizedImage
      };

      const res = await fetch(`/api/users/${user.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกข้อมูลไม่สำเร็จ');

      const base = (data.profile_image || '').split('?')[0];
      const profileUrl = toDisplayUrl(base);

      await preloadAndSet(profileUrl);

      login(
        mergeUser(user, {
          ...data,
          user_id: data.user_id,
          username: data.username,
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          gender: (data.gender ?? gender),
          profileImage: profileUrl,
        })
      );

      setGenderDirty(false);
      alert('✅ บันทึกข้อมูลสำเร็จ');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  const displaySrc = localPreview || serverUrl || user.profileImage || '';
  const hasRealImage = Boolean(localPreview || serverUrl || user.profileImage);

  return (
    <div className="flex h-screen bg-black text-white">
      <div className="w-20 md:w-48 bg-black flex flex-col items-center py-6 space-y-10">
        <div className="text-sm md:text-base font-semibold">Profile</div>
      </div>

      <div className="flex-1 bg-white text-black rounded-tl-3xl p-8 overflow-auto">
        <h2 className="text-xl font-bold mb-4">EDIT YOUR PROFILE</h2>

        {/* Profile Image */}
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
                    const bumped = `${base}?v=${Date.now() + 1}`;
                    setServerUrl(bumped);
                  } else {
                    setImgError(true);
                  }
                }}
              />
            ) : (
              <FaUserAlt className="text-gray-400 w-12 h-12" /> // ✅ fallback icon
            )}

            <button
              onClick={() => fileInputRef.current.click()}
              className="absolute bottom-1 right-1 w-6 h-6 bg-white border-2 border-white rounded-full shadow flex items-center justify-center hover:bg-gray-100 transition"
              title="เปลี่ยนรูปโปรไฟล์"
              style={{ boxShadow: '0 0 4px rgba(0,0,0,0.15)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6.536-6.536a2 2 0 112.828 2.828L11.828 13.828a2 2 0 01-1.414.586H9v-1.414a2 2 0 01.586-1.414z"/>
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
            <p className="text-xs text-red-500 mt-2">
              โหลดรูปไม่สำเร็จ ลองเปลี่ยนรูปหรือบันทึกใหม่อีกครั้ง
            </p>
          )}
        </div>

        {/* Input Fields */}
        <div className="space-y-4 max-w-md mx-auto">
          <div>
            <label className="block text-sm font-semibold mb-1">Username</label>
            <input type="text" ref={usernameRef} className="w-full border-b border-black focus:outline-none p-1" defaultValue={user.username} disabled />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input type="email" ref={emailRef} className="w-full border-b border-black focus:outline-none p-1" defaultValue={user.email} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Phone</label>
            <input type="tel" ref={phoneRef} className="w-full border-b border-black focus:outline-none p-1" defaultValue={user.phone} maxLength={10} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Address</label>
            <input type="text" ref={addressRef} className="w-full border-b border-black focus:outline-none p-1" defaultValue={user.address} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Gender</label>
            <select
              value={gender}
              onChange={(e) => { setGenderDirty(true); setGender(e.target.value); }}
              className="w-full border-b border-black focus:outline-none p-1"
            >
              <option value="">เลือกเพศ</option>
              <option value="male">ชาย</option>
              <option value="female">หญิง</option>
              <option value="other">อื่นๆ</option>
            </select>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 text-center">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-blue-700 transition"
          >
            บันทึก
          </button>
        </div>
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleLogout}
            className="bg-black text-white px-6 py-2 rounded-full font-semibold hover:bg-gray-800 transition"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}
