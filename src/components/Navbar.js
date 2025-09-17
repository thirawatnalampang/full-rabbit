// src/components/Navbar.jsx
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import {
  FaHome,
  FaPaw,
  FaShoppingCart,
  FaUserAlt,
  FaPlus,
  FaSearch,
  FaArrowLeft,
  FaListAlt,
  FaTimes,
  FaBookOpen,
  
} from 'react-icons/fa';

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  useEffect(() => { setShowMobileSearch(false); }, [location.pathname]);

  const handleSearch = () => {
  const q = searchQuery.trim();
  if (!q) {
    navigate('/search');                  // ไม่มีคำค้น → ไปหน้า search เปล่า
  } else {
    navigate(`/search?q=${encodeURIComponent(q)}`);  // ✅ ใช้ q แทน query
  }
  setShowMobileSearch(false);             // ปิดแผงค้นหาในมือถือหลังค้นหา
};
  return (
    <>
      {/* ===== Desktop / Tablet แนวนอน (คงเดิม) ===== */}
      <nav
        className="hidden md:flex bg-black text-white p-4 justify-between items-center shadow-md"
        key={user?.user_id || 'guest'}
      >
      {/* ปุ่มย้อนกลับ (ซ่อนถ้าอยู่หน้า Home) */}
{location.pathname !== "/" && (
  <button
    onClick={() => navigate(-1)}
    className="text-white mr-4 hover:text-teal-300 transition-colors duration-300"
    title="ย้อนกลับ"
  >
    <FaArrowLeft size={26} />
  </button>
)}

        {/* โลโก้ */}
        <span className="text-2xl font-extrabold tracking-wide text-white">🐾 PetShop</span>

        {/* ช่องค้นหา */}
        <div className="flex items-center bg-white rounded-full px-3 py-1 mx-4 flex-grow max-w-lg">
          <input
            type="text"
            placeholder="Search products..."
            className="focus:outline-none text-black bg-transparent w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch}>
            <FaSearch className="text-black ml-2" />
          </button>
        </div>

        {/* เมนูขวา */}
        <div className="flex items-center space-x-6 text-lg font-medium">
          <Link to="/" title="หน้าแรก" className="hover:text-teal-300 transition-colors duration-300">
            <FaHome size={26} />
          </Link>
          <Link to="/pets" title="สัตว์เลี้ยง" className="hover:text-teal-300 transition-colors duration-300">
            <FaPaw size={26} />
          </Link>
          <Link to="/cart" title="ตะกร้าสินค้า" className="hover:text-teal-300 transition-colors duration-300">
            <FaShoppingCart size={26} />
          </Link>
{user && (
  <Link to="/my-loans" title="การยืมของฉัน" className="hover:text-teal-300 transition-colors duration-300">
    <FaBookOpen size={26} />
  </Link>
)}

          {user && (
            <Link to="/my-orders" title="คำสั่งซื้อของฉัน" className="hover:text-teal-300 transition-colors duration-300">
              <FaListAlt size={26} />
            </Link>
          )}

          {user?.role === 'admin' && (
            <Link
              to="/seller-dashboard"
              title="จัดการสินค้า"
              className="bg-green-500 hover:bg-green-600 transition-colors duration-300 rounded-full p-2"
            >
              <FaPlus size={20} />
            </Link>
          )}

          {user ? (
            <Link to="/profile" title="โปรไฟล์" className="hover:text-teal-300 transition-colors duration-300">
              {user.profileImage && user.profileImage.trim() !== '' ? (
                <img
                  src={`${user.profileImage}?t=${Date.now()}`}
                  alt="Profile"
                  className="w-12 h-12 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <FaUserAlt size={28} className="w-8 h-8 p-1 rounded-full bg-white text-black" />
              )}
            </Link>
          ) : (
            <Link to="/login" title="เข้าสู่ระบบ" className="hover:text-teal-300 transition-colors duration-300">
              เข้าสู่ระบบ
            </Link>
          )}
        </div>
      </nav>

      {/* ===== Mobile / Tablet เล็ก ===== */}
      <nav className="md:hidden sticky top-0 z-50 bg-black text-white shadow-md" key={(user?.user_id || 'guest') + '-m'}>
        {/* แถบบนบาง */}
        <div className="h-14 px-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-white/10 active:scale-95 transition"
            title="ย้อนกลับ"
            aria-label="ย้อนกลับ"
          >
            <FaArrowLeft size={20} />
          </button>

          <span className="text-xl font-extrabold tracking-wide select-none">🐾 PetShop</span>

          <button
            className="p-2 rounded-lg hover:bg-white/10 active:scale-95 transition"
            onClick={() => setShowMobileSearch((v) => !v)}
            aria-label="เปิดค้นหา"
            title="ค้นหา"
          >
            {showMobileSearch ? <FaTimes size={20} /> : <FaSearch size={20} />}
          </button>
        </div>

        {/* แผงค้นหา (สไลด์ลง) */}
        <div
          className={`overflow-hidden transition-[max-height] duration-300 ease-out ${
            showMobileSearch ? 'max-h-24' : 'max-h-0'
          }`}
        >
          <div className="px-3 pb-3">
            <div className="flex items-center bg-white rounded-xl px-3 py-2">
              <input
                type="text"
                placeholder="ค้นหาสินค้า..."
                className="focus:outline-none text-black bg-transparent w-full placeholder-gray-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                className="ml-2 px-3 py-1.5 rounded-lg bg-black text-white active:scale-95 transition"
                aria-label="ค้นหา"
              >
                ค้นหา
              </button>
            </div>
          </div>
        </div>
      </nav>

{/* Bottom Tab Bar (เฉพาะจอเล็ก) */}
<nav
  className="md:hidden fixed bottom-0 inset-x-0 z-[60] bg-black/95 backdrop-blur
             pb-[calc(env(safe-area-inset-bottom,0px))]
             border-t border-white/10"
  role="navigation"
  aria-label="เมนูด้านล่าง"
>
  <div className="flex items-stretch justify-around">
    <TabLink to="/"        label="หน้าแรก"     icon={<FaHome />}          active={location.pathname === '/'} />
    <TabLink to="/pets"    label="สัตว์เลี้ยง" icon={<FaPaw />}           active={location.pathname.startsWith('/pets')} />
    <TabLink to="/cart"    label="ตะกร้า"       icon={<FaShoppingCart />}  active={location.pathname.startsWith('/cart')} />

    {user && (
      <TabLink to="/my-loans" label="การยืม" icon={<FaBookOpen />} active={location.pathname.startsWith('/my-loans')} />
    )}

    {user ? (
      <TabLink to="/my-orders" label="คำสั่งซื้อ" icon={<FaListAlt />} active={location.pathname.startsWith('/my-orders')} />
    ) : (
      <TabLink to="/login"     label="เข้าสู่ระบบ" icon={<FaUserAlt />} active={location.pathname.startsWith('/login')} />
    )}

    <TabLink
      to={user ? '/profile' : '/login'}
      label="โปรไฟล์"
      icon={<FaUserAlt />}
      active={
        user
          ? location.pathname.startsWith('/profile')
          : location.pathname.startsWith('/login')
      }
    />
  </div>
</nav>


{/* Spacer กันคอนเทนต์ทับ Bottom Bar */}
<div className="md:hidden h-[64px]" />

      {/* Admin FAB (จอเล็ก) */}
      {user?.role === 'admin' && (
        <Link
          to="/seller-dashboard"
          className="md:hidden fixed right-4 bottom-20 rounded-full bg-green-500 hover:bg-green-600 text-white p-4 shadow-xl active:scale-95 transition"
          title="จัดการสินค้า"
          aria-label="จัดการสินค้า"
        >
          <FaPlus />
        </Link>
      )}

      {/* Spacer กันคอนเทนต์ทับ Bottom Bar */}
      <div className="md:hidden h-16" />
    </>
  );
}

function TabLink({ to, icon, label, active }) {
  return (
    <Link
      to={to}
      className={`flex-1 min-w-[64px] flex flex-col items-center justify-center
                  py-2.5 text-[11px] leading-none transition
                  ${active ? 'text-teal-300' : 'text-white/90 hover:text-white'}`}
      title={label}
      aria-label={label}
    >
      <div className={`text-xl ${active ? 'scale-110' : ''}`}>{icon}</div>
      {/* ซ่อน label เมื่อจอกว้าง < 360px เพื่อลดการเบียด */}
      <span className="mt-1 hidden [@media(min-width:360px)]:inline">{label}</span>
    </Link>
  );
}
