"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Check, Loader2, Mail, Phone, ShieldCheck, ShieldAlert, Smartphone, Trash2 } from "lucide-react";
import {
  confirmEmailCode,
  confirmPhoneCode,
  getProtectionStatus,
  removePhone,
  sendEmailCode,
  sendPhoneCode,
  sendTwoFactorChallenge,
  setTwoFactor,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const inputClass = "h-10 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60";
const goldBtn = "inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-50";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-amber-400/50 disabled:opacity-50";

function errorText(error: unknown) {
  if (axios.isAxiosError(error)) return (error.response?.data as { error?: string } | undefined)?.error ?? error.message;
  return error instanceof Error ? error.message : "Something went wrong";
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${ok ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-amber-400/40 bg-amber-500/10 text-amber-200"}`}>
      {ok ? <Check className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />} {label}
    </span>
  );
}

function DevCode({ code }: { code?: string }) {
  if (!code) return null;
  return (
    <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
      Development mode: delivery is not configured, so the code is <span className="font-mono font-bold">{code}</span>. Configure SMTP and Twilio in the server environment for real delivery.
    </p>
  );
}

export function AccountProtection({ highlight = false }: { highlight?: boolean }) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken, fetchMe } = useAuthStore();
  const [emailCode, setEmailCode] = useState("");
  const [emailSent, setEmailSent] = useState<{ devCode?: string; sentTo?: string } | null>(null);
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneSent, setPhoneSent] = useState<{ devCode?: string; sentTo?: string } | null>(null);
  const [offCode, setOffCode] = useState("");
  const [offChallenge, setOffChallenge] = useState<{ devCode?: string } | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const statusQuery = useQuery({
    queryKey: ["protection", accessToken],
    queryFn: () => getProtectionStatus(accessToken!),
    enabled: Boolean(accessToken),
  });
  const protection = statusQuery.data?.protection;
  const delivery = statusQuery.data?.delivery;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["protection"] });
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
    await fetchMe();
  };

  const sendEmail = useMutation({
    mutationFn: () => sendEmailCode(accessToken!, csrfToken!),
    onSuccess: (result) => {
      setEmailSent({ devCode: result.devCode, sentTo: result.sentTo });
      setNotice({ tone: "ok", text: result.alreadyVerified ? "Your email is already verified." : `Code sent to ${result.sentTo}.` });
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const confirmEmail = useMutation({
    mutationFn: () => confirmEmailCode(accessToken!, csrfToken!, emailCode),
    onSuccess: async () => {
      setEmailCode("");
      setEmailSent(null);
      setNotice({ tone: "ok", text: "Email verified." });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const sendPhone = useMutation({
    mutationFn: () => sendPhoneCode(accessToken!, csrfToken!, phone),
    onSuccess: (result) => {
      setPhoneSent({ devCode: result.devCode, sentTo: result.sentTo });
      setNotice({ tone: "ok", text: `Text message sent to ${result.sentTo}.` });
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const confirmPhone = useMutation({
    mutationFn: () => confirmPhoneCode(accessToken!, csrfToken!, phoneCode),
    onSuccess: async () => {
      setPhoneCode("");
      setPhoneSent(null);
      setPhone("");
      setNotice({ tone: "ok", text: "Phone number verified." });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const dropPhone = useMutation({
    mutationFn: () => removePhone(accessToken!, csrfToken!),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Phone number removed." });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const enable2fa = useMutation({
    mutationFn: () => setTwoFactor(accessToken!, csrfToken!, { enabled: true, channels: ["EMAIL", "SMS"] }),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Two-factor is on. Sign-ins now need a code from your email and phone." });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const challengeOff = useMutation({
    mutationFn: () => sendTwoFactorChallenge(accessToken!, csrfToken!),
    onSuccess: (result) => {
      setOffChallenge({ devCode: result.devCode });
      setNotice({ tone: "ok", text: "Confirmation code sent. Enter it to turn two-factor off." });
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const disable2fa = useMutation({
    mutationFn: () => setTwoFactor(accessToken!, csrfToken!, { enabled: false, code: offCode }),
    onSuccess: async () => {
      setOffCode("");
      setOffChallenge(null);
      setNotice({ tone: "ok", text: "Two-factor is off. Your account is less protected." });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  if (!protection) {
    return <div className="rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4 text-sm text-slate-400"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading account protection...</div>;
  }

  const steps = [protection.emailVerified, protection.phoneVerified, protection.twoFactorEnabled].filter(Boolean).length;

  return (
    <section className={`rounded-2xl border bg-[#0d1119] p-4 ${highlight && !protection.complete ? "border-amber-400/60 shadow-[0_0_30px_rgba(230,179,37,0.2)]" : "border-amber-500/15"}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="nf-heading inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white">
            <ShieldCheck className={`h-4 w-4 ${protection.complete ? "text-emerald-300" : "text-amber-300"}`} /> Account Protection
          </h2>
          <p className="text-xs text-slate-400">Verify your email and phone, then turn on two-factor so nobody can take your account.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{steps}/3 complete</span>
          <span className="flex gap-1">
            {[0, 1, 2].map((index) => <span key={index} className={`h-1.5 w-6 rounded-full ${index < steps ? "bg-emerald-400" : "bg-slate-700"}`} />)}
          </span>
        </div>
      </div>

      {notice ? (
        <p className={`mb-3 rounded-xl border px-3 py-2 text-xs ${notice.tone === "ok" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-rose-400/30 bg-rose-500/10 text-rose-100"}`}>{notice.text}</p>
      ) : null}
      {delivery && (delivery.email === "unconfigured" || delivery.sms === "unconfigured") ? (
        <p className="mb-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          Delivery is not configured on the server{delivery.email === "unconfigured" ? " for email" : ""}{delivery.sms === "unconfigured" ? " for SMS" : ""}. Codes cannot be sent until SMTP and Twilio credentials are set.
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Email */}
        <div className="rounded-xl border border-white/5 bg-[#11151e] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white"><Mail className="h-4 w-4 text-amber-300" /> Email</p>
            <StatusPill ok={protection.emailVerified} label={protection.emailVerified ? "Verified" : "Unverified"} />
          </div>
          <p className="mb-2 text-xs text-slate-400">{protection.email}</p>
          {!protection.emailVerified ? (
            <div className="space-y-2">
              {!emailSent ? (
                <button type="button" className={goldBtn} disabled={sendEmail.isPending} onClick={() => sendEmail.mutate()}>
                  {sendEmail.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Send code
                </button>
              ) : (
                <>
                  <DevCode code={emailSent.devCode} />
                  <div className="flex gap-2">
                    <input className={inputClass} inputMode="numeric" maxLength={6} placeholder="6-digit code" value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
                    <button type="button" className={goldBtn} disabled={emailCode.length !== 6 || confirmEmail.isPending} onClick={() => confirmEmail.mutate()}>Verify</button>
                  </div>
                  <button type="button" className="text-[11px] text-slate-400 hover:text-amber-200" disabled={sendEmail.isPending} onClick={() => sendEmail.mutate()}>Resend code</button>
                </>
              )}
            </div>
          ) : (
            <p className="text-xs text-emerald-200">Codes for sign-in and account changes can go to this address.</p>
          )}
        </div>

        {/* Phone */}
        <div className="rounded-xl border border-white/5 bg-[#11151e] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white"><Phone className="h-4 w-4 text-amber-300" /> Phone</p>
            <StatusPill ok={protection.phoneVerified} label={protection.phoneVerified ? "Verified" : "Not added"} />
          </div>
          {protection.phoneVerified ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">{protection.phoneNumber}</p>
              <p className="text-xs text-emerald-200">Text-message codes protect sign-ins and changes.</p>
              <button type="button" className={`${ghostBtn} text-rose-200`} disabled={dropPhone.isPending} onClick={() => window.confirm("Remove your verified phone number?") && dropPhone.mutate()}>
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {!phoneSent ? (
                <>
                  <input className={inputClass} type="tel" autoComplete="tel" placeholder="+1 555 123 4567" value={phone} onChange={(event) => setPhone(event.target.value)} />
                  <button type="button" className={goldBtn} disabled={phone.trim().length < 7 || sendPhone.isPending} onClick={() => sendPhone.mutate()}>
                    {sendPhone.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />} Text me a code
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-400">Sent to {phoneSent.sentTo}</p>
                  <DevCode code={phoneSent.devCode} />
                  <div className="flex gap-2">
                    <input className={inputClass} inputMode="numeric" maxLength={6} placeholder="6-digit code" value={phoneCode} onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
                    <button type="button" className={goldBtn} disabled={phoneCode.length !== 6 || confirmPhone.isPending} onClick={() => confirmPhone.mutate()}>Verify</button>
                  </div>
                  <div className="flex gap-3 text-[11px] text-slate-400">
                    <button type="button" className="hover:text-amber-200" disabled={sendPhone.isPending} onClick={() => sendPhone.mutate()}>Resend</button>
                    <button type="button" className="hover:text-amber-200" onClick={() => setPhoneSent(null)}>Change number</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Two-factor */}
        <div className="rounded-xl border border-white/5 bg-[#11151e] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="h-4 w-4 text-amber-300" /> Two-factor sign-in</p>
            <StatusPill ok={protection.twoFactorEnabled} label={protection.twoFactorEnabled ? "On" : "Off"} />
          </div>
          {protection.twoFactorEnabled ? (
            <div className="space-y-2">
              <p className="text-xs text-emerald-200">Every sign-in needs a code sent by {protection.twoFactorChannels.map((channel) => (channel === "SMS" ? "text" : "email")).join(" and ")}.</p>
              {!offChallenge ? (
                <button type="button" className={ghostBtn} disabled={challengeOff.isPending} onClick={() => challengeOff.mutate()}>Turn off</button>
              ) : (
                <>
                  <DevCode code={offChallenge.devCode} />
                  <div className="flex gap-2">
                    <input className={inputClass} inputMode="numeric" maxLength={6} placeholder="Confirmation code" value={offCode} onChange={(event) => setOffCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
                    <button type="button" className={`${ghostBtn} text-rose-200`} disabled={offCode.length !== 6 || disable2fa.isPending} onClick={() => disable2fa.mutate()}>Confirm off</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">
                {protection.emailVerified && protection.phoneVerified ? "Both channels are verified. Turn this on to lock down sign-ins." : "Verify your email and phone first, then turn this on."}
              </p>
              <button type="button" className={goldBtn} disabled={!protection.emailVerified || !protection.phoneVerified || enable2fa.isPending} onClick={() => enable2fa.mutate()}>
                {enable2fa.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Turn on two-factor
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
