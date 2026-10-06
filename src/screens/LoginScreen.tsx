import { useState, type FormEvent } from "react";
import { BrandMark } from "../components/AppShell";
import { buttonClass, InlineMessage, inputClass } from "../components/common";
import { useSession } from "../state/session";

export function LoginScreen() {
  const { login } = useSession();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(phone, pin);
    } catch (err) {
      setError((err as Error).message);
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#f6f5f1] px-4 pt-[12vh]">
      <form onSubmit={submit} className="screen-enter w-full max-w-sm">
        <BrandMark />
        <h1 className="mt-8 text-[26px] font-semibold tracking-[-0.04em] text-stone-950">Sign in</h1>
        <p className="mt-1 text-sm text-stone-500">Use your phone number and PIN.</p>
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-stone-600">Phone number</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="username" placeholder="0700 000 001" required className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-stone-600">PIN</span>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" autoComplete="current-password" placeholder="4–6 digits" required className={`${inputClass} tracking-[0.3em]`} />
          </label>
          {error && <InlineMessage tone="danger">{error}</InlineMessage>}
          <button type="submit" disabled={busy || pin.length < 4 || !phone} className={`${buttonClass.primary} w-full`}>{busy ? "Signing in…" : "Sign in"}</button>
        </div>
        <p className="mt-6 text-xs leading-5 text-stone-500">Forgot your PIN? Ask the Owner to reset it in Settings.</p>
      </form>
    </div>
  );
}
