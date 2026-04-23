"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type AlertOpts = {
  title?: string;
  message: string;
  icon?: string;
  confirmLabel?: string;
  tone?: "default" | "success" | "danger";
};

type ConfirmOpts = {
  title?: string;
  message: string;
  icon?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ToastOpts = { message: string; type?: "info" | "success" | "error" };

type DialogApi = {
  alert: (opts: AlertOpts) => Promise<void>;
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  toast: (msg: string | ToastOpts) => void;
};

const Ctx = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}

type Modal =
  | { kind: "alert"; id: string; opts: AlertOpts; resolve: () => void }
  | {
      kind: "confirm";
      id: string;
      opts: ConfirmOpts;
      resolve: (v: boolean) => void;
    };

type Toast = {
  id: string;
  message: string;
  type: "info" | "success" | "error";
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [modals, setModals] = useState<Modal[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const alert = useCallback((opts: AlertOpts) => {
    return new Promise<void>((resolve) => {
      setModals((m) => [...m, { kind: "alert", id: uid(), opts, resolve }]);
    });
  }, []);

  const confirm = useCallback((opts: ConfirmOpts) => {
    return new Promise<boolean>((resolve) => {
      setModals((m) => [...m, { kind: "confirm", id: uid(), opts, resolve }]);
    });
  }, []);

  const toast = useCallback((msg: string | ToastOpts) => {
    const id = uid();
    const t: Toast =
      typeof msg === "string"
        ? { id, message: msg, type: "info" }
        : { id, message: msg.message, type: msg.type ?? "info" };
    setToasts((prev) => [...prev, t]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 2400);
  }, []);

  function dismissModal(id: string, value?: boolean) {
    setModals((prev) => {
      const m = prev.find((x) => x.id === id);
      if (m) {
        if (m.kind === "alert") m.resolve();
        else m.resolve(value ?? false);
      }
      return prev.filter((x) => x.id !== id);
    });
  }

  // ESC to cancel topmost modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && modals.length > 0) {
        const top = modals[modals.length - 1];
        dismissModal(top.id, false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modals]);

  return (
    <Ctx.Provider value={{ alert, confirm, toast }}>
      {children}
      {modals.map((m) => (
        <ModalView
          key={m.id}
          modal={m}
          onClose={(v) => dismissModal(m.id, v)}
        />
      ))}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-bounce-in pointer-events-auto rounded-full px-5 py-2.5 text-sm font-semibold shadow-xl ${
              t.type === "success"
                ? "bg-green-600 text-white shadow-green-600/30"
                : t.type === "error"
                  ? "bg-red-600 text-white shadow-red-600/30"
                  : "bg-ink-950 text-white shadow-ink-950/30"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ModalView({
  modal,
  onClose,
}: {
  modal: Modal;
  onClose: (v?: boolean) => void;
}) {
  const isConfirm = modal.kind === "confirm";
  const opts = modal.opts as AlertOpts & ConfirmOpts;
  const tone = (modal.opts as AlertOpts).tone;
  const danger = (modal.opts as ConfirmOpts).danger;
  const icon =
    opts.icon ??
    (danger || tone === "danger" ? "⚠️" : tone === "success" ? "✅" : isConfirm ? "❓" : "💬");
  const iconBg =
    danger || tone === "danger"
      ? "bg-red-100"
      : tone === "success"
        ? "bg-green-100"
        : "bg-brand-100";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      onClick={() => onClose(false)}
    >
      <div
        className="animate-fade-up w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`inline-flex h-11 w-11 flex-none items-center justify-center rounded-2xl text-2xl ${iconBg}`}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            {opts.title && (
              <h3 className="font-display text-lg font-bold leading-snug text-ink-950">
                {opts.title}
              </h3>
            )}
            <p
              className={`text-ink-600 ${opts.title ? "mt-1 text-sm" : "text-base"}`}
            >
              {opts.message}
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {isConfirm && (
            <button
              onClick={() => onClose(false)}
              className="rounded-xl bg-ink-100 px-4 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-200"
            >
              {opts.cancelLabel ?? "Huỷ"}
            </button>
          )}
          <button
            autoFocus
            onClick={() => onClose(true)}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition active:scale-[0.98] ${
              danger || tone === "danger"
                ? "bg-red-600 shadow-red-500/30 hover:bg-red-700"
                : tone === "success"
                  ? "bg-green-600 shadow-green-500/30 hover:bg-green-700"
                  : "bg-brand-600 shadow-brand-600/30 hover:bg-brand-700"
            }`}
          >
            {opts.confirmLabel ?? (isConfirm ? "Xác nhận" : "OK")}
          </button>
        </div>
      </div>
    </div>
  );
}
