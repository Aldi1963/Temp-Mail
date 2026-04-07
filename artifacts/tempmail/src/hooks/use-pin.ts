import { useState, useCallback } from "react";
import { useLocalStorage } from "./use-local-storage";

const PIN_HASH_KEY = "tempmail_pin_hash";

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`tempmail:${pin}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function usePin() {
  const [pinHash, setPinHash] = useLocalStorage<string | null>(PIN_HASH_KEY, null);
  const [isUnlocked, setIsUnlocked] = useState(!pinHash);

  const hasPin = !!pinHash;

  const setupPin = useCallback(async (pin: string) => {
    const hash = await hashPin(pin);
    setPinHash(hash);
    setIsUnlocked(true);
  }, [setPinHash]);

  const removePin = useCallback(() => {
    setPinHash(null);
    setIsUnlocked(true);
  }, [setPinHash]);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!pinHash) return true;
    const hash = await hashPin(pin);
    const ok = hash === pinHash;
    if (ok) setIsUnlocked(true);
    return ok;
  }, [pinHash]);

  const lock = useCallback(() => {
    if (pinHash) setIsUnlocked(false);
  }, [pinHash]);

  return { hasPin, isUnlocked, setupPin, removePin, verifyPin, lock };
}
