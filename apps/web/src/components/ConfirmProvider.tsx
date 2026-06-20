"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ConfirmOptions = { title?: string; message: string; confirmLabel?: string };
type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

const btnStyle: React.CSSProperties = {
  padding: "9px 16px",
  border: "none",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
};

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!state) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const confirm = useCallback<ConfirmFn>((opts) => {
    const normalized = typeof opts === "string" ? { message: opts } : opts;
    return new Promise<boolean>((resolve) => {
      setState({ opts: normalized, resolve });
    });
  }, []);

  function close(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {mounted &&
        state &&
        createPortal(
          <div
            onClick={() => close(false)}
            className="modal-backdrop"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(20,20,20,.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 200,
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="modal-panel"
              style={{
                background: "var(--card)",
                borderRadius: "var(--rl)",
                padding: 24,
                width: "100%",
                maxWidth: 380,
                boxShadow: "0 20px 60px rgba(0,0,0,.25)",
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>{state.opts.title ?? "Are you sure?"}</div>
              <div style={{ fontSize: 14, color: "var(--ink2)", marginBottom: 20, lineHeight: 1.5 }}>{state.opts.message}</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => close(false)} style={{ ...btnStyle, background: "var(--bg)", color: "var(--ink2)" }}>
                  Cancel
                </button>
                <button onClick={() => close(true)} style={{ ...btnStyle, background: "var(--red)", color: "#fff" }}>
                  {state.opts.confirmLabel ?? "Delete"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ConfirmContext.Provider>
  );
}
