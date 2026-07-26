export function FieldLabel({ children }) {
  return (
    <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
      {children}
    </label>
  );
}

export const inputClass =
  "w-full px-3 py-2.5 rounded border border-border bg-white text-[14px] text-inktext box-border font-sans focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta";

export function PrimaryButton({ children, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`bg-terracotta text-white border-none rounded px-4 py-2.5 text-[13px] font-semibold cursor-pointer tracking-wide hover:bg-terracottadark transition-colors ${className}`}
    >
      {children}
    </button>
  );
}
