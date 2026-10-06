import { useState, type FormEvent } from "react";
import type { AuthUser } from "../../shared/types";
import { api } from "../api/client";
import { buttonClass, InlineMessage, inputClass, PageHeader } from "../components/common";
import { useSession } from "../state/session";

export function AccountScreen({ forced = false }: { forced?: boolean }) {
  const { user, setUser } = useSession();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (newPin !== confirmPin) {
      setMessage({ tone: "danger", text: "The new PINs don't match." });
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ user: AuthUser }>("/auth/pin", { body: { currentPin, newPin } });
      setUser(result.user);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setMessage({ tone: "success", text: "PIN changed." });
    } catch (err) {
      setMessage({ tone: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const pinInput = (value: string, set: (v: string) => void, label: string, autoComplete: string) => (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-stone-600">{label}</span>
      <input value={value} onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" autoComplete={autoComplete} required className={`${inputClass} tracking-[0.3em]`} />
    </label>
  );

  return (
    <div className="screen-enter mx-auto max-w-md px-4 py-6 sm:px-6">
      <PageHeader title={forced ? "Choose your PIN" : "Change PIN"} supporting={forced ? `Welcome, ${user?.name}. Replace the starting PIN before you continue.` : user?.phone} />
      <form onSubmit={submit} className="space-y-4">
        {pinInput(currentPin, setCurrentPin, forced ? "Starting PIN" : "Current PIN", "current-password")}
        {pinInput(newPin, setNewPin, "New PIN (4–6 digits)", "new-password")}
        {pinInput(confirmPin, setConfirmPin, "Repeat new PIN", "new-password")}
        {message && <InlineMessage tone={message.tone}>{message.text}</InlineMessage>}
        <button type="submit" disabled={busy || newPin.length < 4 || currentPin.length < 4} className={`${buttonClass.primary} w-full`}>Save PIN</button>
      </form>
    </div>
  );
}
