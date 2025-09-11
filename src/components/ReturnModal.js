import React, { useState, useEffect } from "react";
import ReturnModal from "../components/ReturnModal"; // ✅ นำเข้าโมดัล

export default function MyLoansPage() {
  const [loans, setLoans] = useState([]);
  const [openReturn, setOpenReturn] = useState(false);     // ✅ state เปิด/ปิดโมดัล
  const [selectedLoanId, setSelectedLoanId] = useState(null); // ✅ เก็บ loan ที่จะคืน

  const refreshLoans = async () => {
    const res = await fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:3000'}/api/my-loans?buyer_id=...`);
    const data = await res.json();
    setLoans(data || []);
  };

  useEffect(() => { refreshLoans(); }, []);

  const openReturnFor = (loanId) => {     // ✅ ฟังก์ชันกดปุ่ม
    setSelectedLoanId(loanId);
    setOpenReturn(true);
  };

  return (
    <div>
      {loans.map((loan) => (
        <div key={loan.loan_id} className="border rounded p-3 mb-3">
          <div>คำยืม #{loan.loan_id} • สถานะ: {loan.status}</div>

          {loan.status === 'on_loan' && (
            <button
              onClick={() => openReturnFor(loan.loan_id)}   // ✅ ใช้ฟังก์ชันนี้
              className="mt-3 px-3 py-2 rounded border"
            >
              📦 แจ้งคืน
            </button>
          )}
        </div>
      ))}

      {/* ✅ วางโมดัลไว้นอก .map (มีอันเดียวทั้งหน้า) */}
      <ReturnModal
        open={openReturn}
        onClose={() => setOpenReturn(false)}
        loanId={selectedLoanId}
        onDone={() => { setOpenReturn(false); refreshLoans(); }} // รีโหลดรายการหลังแจ้งคืนสำเร็จ
      />
    </div>
  );
}
