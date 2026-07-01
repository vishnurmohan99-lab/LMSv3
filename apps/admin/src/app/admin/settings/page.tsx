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

const OPENROUTER_TEXT_MODEL_OPTIONS = [
  "openai/gpt-oss-20b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "deepseek/deepseek-chat-v3.1:free",
];
const OPENROUTER_VISION_MODEL_OPTIONS = ["nvidia/nemotron-nano-12b-v2-vl:free", "google/gemini-2.0-flash-exp:free"];
const OPENROUTER_IMAGE_MODEL_OPTIONS = ["google/gemini-2.5-flash-image"];

const OPENAI_TEXT_MODEL_OPTIONS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"];
const OPENAI_VISION_MODEL_OPTIONS = ["gpt-4o-mini", "gpt-4o"];
const OPENAI_IMAGE_MODEL_OPTIONS = ["gpt-image-1"];

/** Mirrors the OPENAI_*_DEFAULT constants in apps/api/src/ai/ai.service.ts, so the "default"
 *  label shown here matches what actually gets called once a feature is switched to OpenAI. */
function openAiDefaultFor(feature: AiFeature): string {
  if (VISION_FEATURES.includes(feature)) return "gpt-4o-mini";
  if (IMAGE_FEATURES.includes(feature)) return "gpt-image-1";
  return "gpt-4o-mini";
}

function modelOptionsFor(feature: AiFeature, provider: AiProvider): string[] {
  if (provider === "OPENAI") {
    if (VISION_FEATURES.includes(feature)) return OPENAI_VISION_MODEL_OPTIONS;
    if (IMAGE_FEATURES.includes(feature)) return OPENAI_IMAGE_MODEL_OPTIONS;
    return OPENAI_TEXT_MODEL_OPTIONS;
  }
  if (VISION_FEATURES.includes(feature)) return OPENROUTER_VISION_MODEL_OPTIONS;
  if (IMAGE_FEATURES.includes(feature)) return OPENROUTER_IMAGE_MODEL_OPTIONS;
  return OPENROUTER_TEXT_MODEL_OPTIONS;
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
  const initialOptions = modelOptionsFor(setting.feature, setting.provider);
  const initialIsCustom = !!setting.model && !initialOptions.includes(setting.model);

  const [provider, setProvider] = useState<AiProvider>(setting.provider);
  const [model, setModel] = useState(setting.model ?? "");
  const [customMode, setCustomMode] = useState(initialIsCustom);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const options = modelOptionsFor(setting.feature, provider);
  const effectiveDefault = provider === "OPENAI" ? openAiDefaultFor(setting.feature) : setting.defaultModel;
  const dirty = provider !== setting.provider || model !== (setting.model ?? "");

  function onChangeProvider(next: AiProvider) {
    setProvider(next);
    // Presets differ per provider (OpenRouter ids vs OpenAI ids) — a model chosen for the old
    // provider is almost never valid for the new one, so reset to that provider's default.
    setModel("");
    setCustomMode(false);
  }

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
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: 12, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink2)", display: "block", marginBottom: 6 }}>Provider</label>
          <select value={provider} onChange={(e) => onChangeProvider(e.target.value as AiProvider)} style={{ ...selectStyle, width: "100%" }}>
            <option value="OPENROUTER">OpenRouter</option>
            <option value="OPENAI">OpenAI</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink2)", display: "block", marginBottom: 6 }}>
            Model <span style={{ color: "var(--ink3)", fontWeight: 600 }}>(default: {effectiveDefault})</span>
          </label>
          {customMode ? (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={provider === "OPENAI" ? "e.g. gpt-4o" : "e.g. provider/model-name:free"}
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
              <option value="__default__">Default ({effectiveDefault})</option>
              {options
                .filter((o) => o !== effectiveDefault)
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
