"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Check, Copy, Download, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { disableTotp, enableTotp, getApiErrorMessage, regenerateRecoveryCodes, startTotpSetup, type ProtectionStatus } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const inputClass = "h-10 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-400/60";
const primaryBtn = "inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-300 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:brightness-110 disabled:opacity-50";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-violet-400/50 disabled:opacity-50";

type Step = "idle" | "password" | "scan" | "codes";

/** Authenticator-app two-factor: password → scan → confirm a code → save recovery codes. */
export function AuthenticatorCard({ protection }: { protection: ProtectionStatus }) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const [step, setStep] = useState<Step>("idle");
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [manageCode, setManageCode] = useState("");
  const [manageMode, setManageMode] = useState<"off" | "codes" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!setup) return;
    void QRCode.toDataURL(setup.otpauthUrl, { margin: 1, width: 200, color: { dark: "#0b0e17", light: "#ffffff" } }).then(setQr).catch(() => setQr(null));
  }, [setup]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["protection"] });

  const start = useMutation({
    mutationFn: () => startTotpSetup(accessToken!, csrfToken!, password),
    onSuccess: (data) => {
      setSetup(data);
      setPassword("");
      setStep("scan");
      setError(null);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  const enable = useMutation({
    mutationFn: () => enableTotp(accessToken!, csrfToken!, code),
    onSuccess: async (data) => {
      setRecoveryCodes(data.recoveryCodes);
      setStep("codes");
      setCode("");
      setSetup(null);
      setError(null);
      await refresh();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  const turnOff = useMutation({
    mutationFn: () => disableTotp(accessToken!, csrfToken!, manageCode.trim()),
    onSuccess: async () => {
      setManageMode(null);
      setManageCode("");
      setError(null);
      await refresh();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  const newCodes = useMutation({
    mutationFn: () => regenerateRecoveryCodes(accessToken!, csrfToken!, manageCode.trim()),
    onSuccess: async (data) => {
      setRecoveryCodes(data.recoveryCodes);
      setStep("codes");
      setManageMode(null);
      setManageCode("");
      setError(null);
      await refresh();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const codesText = recoveryCodes ? `Nexus Forge Gaming recovery codes\nEach code works once.\n\n${recoveryCodes.join("\n")}\n` : "";
  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(codesText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy. Select the codes and copy them by hand.");
    }
  };
  const downloadCodes = () => {
    const url = URL.createObjectURL(new Blob([codesText], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "nexus-forge-recovery-codes.txt";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const enabled = Boolean(protection.totpEnabled);

  return (
    <div className="rounded-xl border border-white/5 bg-[#11151e] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-white"><KeyRound className="h-4 w-4 text-violet-300" /> Authenticator app</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${enabled ? "bg-emerald-500/15 text-emerald-200" : "bg-white/5 text-slate-400"}`}>{enabled ? "On" : "Off"}</span>
      </div>

      {step === "codes" && recoveryCodes ? (
        <div className="space-y-3">
          <p className="text-xs text-amber-100">
            Save these recovery codes somewhere safe. Each one signs you in once if you lose your phone. <strong>They won&apos;t be shown again.</strong>
          </p>
          <ol className="grid grid-cols-2 gap-1.5 rounded-lg border border-white/10 bg-[#0a0d14] p-3 font-mono text-sm text-slate-100">
            {recoveryCodes.map((entry) => <li key={entry}>{entry}</li>)}
          </ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={ghostBtn} onClick={() => void copyCodes()}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}</button>
            <button type="button" className={ghostBtn} onClick={downloadCodes}><Download className="h-3.5 w-3.5" /> Download</button>
            <button type="button" className={primaryBtn} onClick={() => { setRecoveryCodes(null); setStep("idle"); }}>I&apos;ve saved them</button>
          </div>
        </div>
      ) : enabled ? (
        <div className="space-y-2">
          <p className="text-xs text-emerald-200">
            Sign-ins ask for a code from your authenticator app. {protection.recoveryCodesLeft ?? 0} recovery code{protection.recoveryCodesLeft === 1 ? "" : "s"} left.
          </p>
          {(protection.recoveryCodesLeft ?? 0) <= 3 ? <p className="text-xs text-amber-200">You&apos;re running low on recovery codes. Make a new set.</p> : null}
          {manageMode ? (
            <div className="space-y-2">
              <input className={inputClass} value={manageCode} onChange={(event) => setManageCode(event.target.value)} placeholder="Code from your app (or a recovery code)" autoComplete="one-time-code" />
              <div className="flex flex-wrap gap-2">
                {manageMode === "off" ? (
                  <button type="button" className={`${ghostBtn} text-rose-200`} disabled={manageCode.trim().length < 6 || turnOff.isPending} onClick={() => turnOff.mutate()}>Confirm turn off</button>
                ) : (
                  <button type="button" className={primaryBtn} disabled={manageCode.trim().length < 6 || newCodes.isPending} onClick={() => newCodes.mutate()}>Make new codes</button>
                )}
                <button type="button" className={ghostBtn} onClick={() => { setManageMode(null); setManageCode(""); setError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={ghostBtn} onClick={() => setManageMode("codes")}>New recovery codes</button>
              <button type="button" className={ghostBtn} onClick={() => setManageMode("off")}>Turn off</button>
            </div>
          )}
        </div>
      ) : step === "idle" ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Use an app like Google Authenticator, Microsoft Authenticator, Authy or 1Password. Works without a phone number, and nothing is sent by email or text.</p>
          <button type="button" className={primaryBtn} onClick={() => { setStep("password"); setError(null); }}><ShieldCheck className="h-3.5 w-3.5" /> Set up</button>
        </div>
      ) : step === "password" ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Confirm your password to start.</p>
          <input type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && password) start.mutate(); }} />
          <div className="flex gap-2">
            <button type="button" className={primaryBtn} disabled={!password || start.isPending} onClick={() => start.mutate()}>{start.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Continue</button>
            <button type="button" className={ghostBtn} onClick={() => { setStep("idle"); setPassword(""); setError(null); }}>Cancel</button>
          </div>
        </div>
      ) : setup ? (
        <div className="space-y-3">
          <ol className="list-decimal space-y-1 pl-4 text-xs text-slate-300">
            <li>In your authenticator app, add an account and scan this code.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          <div className="flex flex-wrap items-start gap-4">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR code to add Nexus Forge Gaming to your authenticator app" width={160} height={160} className="rounded-lg bg-white p-1" />
            ) : (
              <span className="flex h-40 w-40 items-center justify-center rounded-lg border border-white/10 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /></span>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-[11px] text-slate-400">Can&apos;t scan? Enter this key in the app instead:</p>
              <p className="break-all rounded-lg border border-white/10 bg-[#0a0d14] px-2 py-1.5 font-mono text-xs text-slate-100">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</p>
              <input
                className={inputClass}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(event) => { if (event.key === "Enter" && code.length === 6) enable.mutate(); }}
              />
              <div className="flex gap-2">
                <button type="button" className={primaryBtn} disabled={code.length !== 6 || enable.isPending} onClick={() => enable.mutate()}>{enable.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Turn on</button>
                <button type="button" className={ghostBtn} onClick={() => { setStep("idle"); setSetup(null); setCode(""); setError(null); }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
