// src/components/PetCard.jsx
import { Link } from "react-router-dom";

function formatTHB(n) {
  const num = typeof n === "number" ? n : Number(n);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

export default function PetCard({ pet }) {
  const id = pet.id ?? pet.rabbit_id ?? pet.rabbitId;
  const img = pet.image ?? pet.image_url ?? pet.imageUrl;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 text-center flex flex-col shadow-sm hover:shadow-md transition">
      <div className="w-full h-40 overflow-hidden rounded-lg bg-white">
        <img
          src={img || "https://placehold.co/200x200?text=No+Image"}
          alt={pet.name}
          className="w-full h-full object-contain"
          onError={(e) => {
            e.currentTarget.src = "https://placehold.co/200x200?text=No+Image";
          }}
          draggable={false}
        />
      </div>

      <p className="mt-2 font-semibold line-clamp-2">{pet.name}</p>
      <p className="text-sm text-gray-600">ราคา {formatTHB(pet.price)} บาท</p>

      <Link
  to={`/pets/${id}`}
  className="inline-block px-4 py-1 mt-2 bg-green-600 text-white rounded-full hover:bg-green-700 text-sm mx-auto"
>
  ดูรายละเอียด
</Link>
    </div>
  );
}
