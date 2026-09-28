// Registri per-sesi: id pesan yang OTP-nya sudah disalin otomatis.
// Dipakai bersama oleh hook mailbox (salin saat pesan baru tiba) dan
// OtpBanner (salin saat banner muncul) agar tidak dobel salin/toast.
const copiedIds = new Set<string>();

export function wasOtpAutoCopied(id: string): boolean {
  return copiedIds.has(id);
}

export function markOtpAutoCopied(id: string): void {
  copiedIds.add(id);
}
