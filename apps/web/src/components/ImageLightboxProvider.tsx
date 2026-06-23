"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type OpenImageFn = (url: string, alt?: string) => void;

const ImageLightboxContext = createContext<OpenImageFn | null>(null);

export function useImageLightbox(): OpenImageFn {
  const ctx = useContext(ImageLightboxContext);
  if (!ctx) throw new Error("useImageLightbox must be used within ImageLightboxProvider");
  return ctx;
}

export default function ImageLightboxProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ url: string; alt?: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!state) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setState(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [state]);

  const openImage = useCallback<OpenImageFn>((url, alt) => {
    setState({ url, alt });
  }, []);

  return (
    <ImageLightboxContext.Provider value={openImage}>
      {children}
      {mounted &&
        state &&
        createPortal(
          <div
            onClick={() => setState(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,15,15,.82)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 300,
              padding: 24,
            }}
          >
            <button
              onClick={() => setState(null)}
              aria-label="Close"
              style={{
                position: "absolute",
                top: 18,
                right: 22,
                width: 38,
                height: 38,
                borderRadius: "50%",
                border: "none",
                background: "rgba(255,255,255,.12)",
                color: "#fff",
                fontSize: 18,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.url}
              alt={state.alt ?? "Image preview"}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "90vw",
                maxHeight: "90vh",
                borderRadius: "var(--rm)",
                boxShadow: "0 20px 60px rgba(0,0,0,.4)",
                objectFit: "contain",
              }}
            />
          </div>,
          document.body,
        )}
    </ImageLightboxContext.Provider>
  );
}
