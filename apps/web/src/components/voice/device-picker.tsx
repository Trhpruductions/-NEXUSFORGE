"use client";

import { realDevices, type DeviceKind } from "@/lib/media/media-prefs";

/** Shared look for Voice & Video controls (same classes as the Settings page). */
export const voiceInput = "h-10 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60 disabled:opacity-50";
export const voiceLabel = "mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500";

const fallbackNoun: Record<DeviceKind, string> = { audioinput: "Microphone", audiooutput: "Speakers", videoinput: "Camera" };

/**
 * A device picker: System default, then the connected devices. A saved device that isn't
 * connected stays selected (shown as "not connected"), so the choice isn't lost while it's unplugged.
 */
export function DevicePicker({
  id,
  label,
  kind,
  devices,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  label: string;
  kind: DeviceKind;
  devices: readonly MediaDeviceInfo[];
  value: string | null;
  onChange: (deviceId: string | null) => void;
  disabled?: boolean;
}) {
  const list = realDevices(devices, kind);
  const listed = value === null || list.some((device) => device.deviceId === value);
  return (
    <label className="block text-xs text-slate-300">
      <span className={voiceLabel}>{label}</span>
      <select id={id} className={voiceInput} value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">System default</option>
        {list.map((device, index) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `${fallbackNoun[kind]} ${index + 1}`}
          </option>
        ))}
        {value && !listed ? <option value={value}>{list.length ? "Saved device (not connected)" : "Saved device"}</option> : null}
      </select>
    </label>
  );
}
