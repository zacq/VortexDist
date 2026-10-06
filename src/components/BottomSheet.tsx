import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function BottomSheet({ open, title, description, onClose, children, labelledBy }: {
  open: boolean;
  title: string;
  description?: string;
  onClose?: () => void;
  children: ReactNode;
  labelledBy?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-stone-950/35 p-0 md:items-center md:p-6" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="sheet-motion w-full max-w-lg rounded-t-2xl border border-stone-200 bg-[#fffefa] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:rounded-lg md:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={labelledBy} className="text-lg font-semibold tracking-tight text-stone-950">{title}</h2>
            {description && <p className="mt-1 text-sm leading-5 text-stone-600">{description}</p>}
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className="tap-target flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
        {children}
      </section>
    </div>
  );
}

export function DemoToast({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null;
  return (
    <div role="status" className="toast-motion fixed bottom-[calc(230px+env(safe-area-inset-bottom))] left-1/2 z-[120] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-md bg-stone-900 px-4 py-3 text-sm font-medium text-white shadow-lg xl:bottom-6">
      <Icon name="check" size={16} className="text-emerald-300" />
      <span>{message}</span>
      <button type="button" onClick={onClose} className="tap-target -mr-2 ml-1 flex h-11 w-11 items-center justify-center rounded text-stone-300 hover:bg-white/10" aria-label="Dismiss message"><Icon name="close" size={14} /></button>
    </div>
  );
}