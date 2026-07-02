import { X } from "lucide-react";
import { useEffect } from "react";

export default function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div
        className={`card w-full ${wide ? "max-w-2xl" : "max-w-lg"} p-6`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink/50 hover:bg-ink/5" aria-label="Mbyll">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
