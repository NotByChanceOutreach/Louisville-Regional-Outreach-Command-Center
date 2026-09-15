import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="w-[min(36rem,calc(100%-1.5rem))] rounded-xl border border-slate-200 bg-white shadow-xl"
    >
      <div className="flex items-start justify-between border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
        <h2 className="text-base font-bold">{title}</h2>
        <button type="button" className="min-h-11 min-w-11 text-2xl leading-none text-slate-300 hover:text-white" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
    </dialog>
  );
}
