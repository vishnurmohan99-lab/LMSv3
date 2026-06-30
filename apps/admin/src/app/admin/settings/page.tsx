"use client";

import { useEffect, useState } from "react";
import { aiSettingsApi, ApiError, type AiFeatureSetting, type AiProvider, type AiFeature } from "@/lib/api";

/** Curated model choices per call-type, shown as a dropdown so the admin doesn't have to know
 *  exact OpenRouter model id strings by heart. Only includes the few ids this app has actually
 *  exercised plus other commonly-available OpenRouter free-tier models — not an exhaustive
 *  catalog. "Custom" always falls back to a free-text field for anything else (verify the id
 *  exists at openrouter.ai/models before using it). */
const VISION_FEATURES: AiFeature[] = ["ANSWER_GRADING"];
const IMAGE_FEATURES: AiFeature[] = ["CHEAT_SHEET_IMAGE"];

const TEXT_MODEL_OPTIONS = [
  "openai/gpt-oss-20b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "deepseek/deepseek-chat-v3.1:free",
];
const VISION_MODEL_OPTIONS = ["nvidia/nemotron-nano-12b-v2-vl:free", "google/gemini-2.0-flash-exp:free"];
const IMAGE_MODEL_OPTIONS = ["google/gemini-2.5-flash-image"];

function modelOptionsFor(feature: AiFeature): string[] {
  if (VISION_FEATURES.includes(feature)) return VISION_MODEL_OPTIONS;
  if (IMAGE_FEATURES.includes(feature)) return IMAGE_MODEL_OPTIONS;
  return TEXT_MODEL_OPTIONS;
}

const selectStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--bg)",
  color: "var(--ink)",
};

const inputStyle: React.CSSProperties = {
  ...selectStyle,
  width: "100%",
};

function FeatureRow({ setting, onSaved }: { setting: AiFeatureSetting; onSaved: () => void }) {
  const options = modelOptionsFor(setting.feature);
  const initialIsCustom = !!setting.model && !options.includes(setting.model);

  const [provider, setProvider] = useState<AiProvider>(setting.provider);
  const [model, setModel] = useState(setting.model ?? "");
  const [customMode, setCustomMode] = useState(initialIsCustom);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = provider !== setting.provider || model !== (setting.model ?? "");

  function onPickPreset(value: string) {
    if (value === "__default__") {
      setModel("");
      setCustomMode(false);
    } else if (value === "__custom__") {
      setCustomMode(true);
    } else {
      setModel(value);
      setCustomMode(false);
    }
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await aiSettingsApi.update(setting.feature, { provider, model: model.trim() || undefined });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--rm)", padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>{setting.label}</div>
          <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>{setting.description}</div>
        </div>
        {provider === "OPENAI" && (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--orange)", background: "var(--orange-soft)", padding: "3px 9px", borderRadius: 7, flex: "none", whiteSpace: "nowrap" }}>
            Not integrated yet
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: 12, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink2)", display: "block", marginBottom: 6 }}>Provider</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value as AiProvider)} style={{ ...selectStyle, width: "100%" }}>
            <option value="OPENROUTER">OpenRouter</option>
            <option value="OPENAI">OpenAI</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink2)", display: "block", marginBottom: 6 }}>
            Model <span style={{ color: "var(--ink3)", fontWeight: 600 }}>(default: {setting.defaultModel})</span>
          </label>
          {customMode ? (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. provider/model-name:free"
                style={{ ...inputStyle, background: "var(--card)" }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => onPickPreset("__default__")}
                title="Back to preset list"
                style={{ flex: "none", padding: "0 12px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg)", color: "var(--ink2)", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          ) : (
            <select
              value={model && options.includes(model) ? model : "__default__"}
              onChange={(e) => onPickPreset(e.target.value)}
              style={{ ...selectStyle, width: "100%", background: "var(--card)" }}
            >
              <option value="__default__">Default ({setting.defaultModel})</option>
              {options
                .filter((o) => o !== setting.defaultModel)
                .map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              <option value="__custom__">Custom…</option>
            </select>
          )}
        </div>
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          style={{
            padding: "10px 18px",
            background: !dirty || saving ? "var(--line)" : "var(--ink)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: !dirty || saving ? "default" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {error && <p style={{ color: "var(--red)", fontSize: 12.5, marginTop: 10 }}>{error}</p>}
      {saved && !dirty && <p style={{ color: "var(--green)", fontSize: 12.5, marginTop: 10, fontWeight: 600 }}>✓ Saved</p>}
    </div>
  );
}

export default function AdminAiSettingsPage() {
  const [settings, setSettings] = useState<AiFeatureSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    aiSettingsApi
      .listAll()
      .then(setSettings)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load AI settings"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <main style={{ padding: "30px 30px 60px", maxWidth: 880, margin: "0 auto" }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, marginBottom: 6 }}>Settings — AI Models</div>
      <p style={{ color: "var(--ink2)", fontSize: 13.5, marginBottom: 22 }}>
        Choose which provider and model powers each AI feature. OpenAI isn&apos;t integrated yet — selecting it saves the
        preference, but that feature will return an error until OpenAI support is added.
      </p>

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--ink2)" }}>Loading…</p>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {settings.map((s) => (
            <FeatureRow key={s.feature} setting={s} onSaved={load} />
          ))}
        </div>
      )}
    </main>
  );
}
