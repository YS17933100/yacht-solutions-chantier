"use client";
import { X } from "lucide-react";

export default function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(30,45,78,0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg bg-white border border-border"
        style={{ boxShadow: "0 12px 32px rgba(30,45,78,0.2)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border" style={{ background: "#1E2D4E", borderRadius: "8px 8px 0 0" }}>
          <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white p-1 bg-transparent border-none cursor-pointer" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
