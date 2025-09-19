// AuthContext.js
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const login = (userData) => {
    setUser((prevUser) => {
      const genderToUse = prevUser?.gender || userData.gender || '';
      const fullUserData = {
        user_id: userData.user_id,
        username: userData.username,
        email: userData.email || '',
        phone: userData.phone || '',
        address: userData.address || '',
        gender: genderToUse,
        profileImage: userData.profileImage || userData.profile_image || '',
        role: userData.role || 'user',
      };
      // console.log แค่ครั้งเดียวเมื่อ login จริงๆ
      if (!prevUser) console.log('Login userData:', fullUserData);
      return fullUserData;
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const loginWithGoogle = async () => {
    setUser({
      user_id: 9999,
      username: 'google_user',
      email: 'google@example.com',
      phone: '',
      address: '',
      gender: '',
      profileImage: '',
      role: 'user',
    });
  };
 // ✅ เพิ่มฟังก์ชัน updateUser ตรงนี้
    const updateUser = (updatedUserData) => {
        setUser(updatedUserData);
    };

    // ✅ เพิ่ม updateUser เข้าไปใน value ของ Provider
    return (
        <AuthContext.Provider value={{ user, login, logout, loginWithGoogle, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
  return useContext(AuthContext);
}
