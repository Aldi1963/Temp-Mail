/**
 * Manage token: bukti kepemilikan alamat untuk operasi destruktif
 * (DELETE /api/email/reset & /destroy) via header X-Manage-Token.
 * Token diterbitkan server saat alamat dibuat (/generate -> manageToken),
 * disimpan di localStorage per alamat. Hanya hash yang disimpan server.
 */
const keyFor = (email: string) => `tmail_manage_token:${email.toLowerCase()}`;

export function saveManageToken(email: string, token: string | undefined | null): void {
  try {
    if (email && token) localStorage.setItem(keyFor(email), token);
  } catch {
    /* abaikan */
  }
}

export function getManageToken(email: string): string | null {
  try {
    return localStorage.getItem(keyFor(email));
  } catch {
    return null;
  }
}

export function clearManageToken(email: string): void {
  try {
    localStorage.removeItem(keyFor(email));
  } catch {
    /* abaikan */
  }
}
