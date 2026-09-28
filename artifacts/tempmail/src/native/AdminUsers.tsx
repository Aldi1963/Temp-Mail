// Kelola pengguna: daftar + cari inline, panel inline per user
// (tangguhkan, ubah peran, reset password, hapus).
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { nativeFetch } from "./api";
import { useNativeAuth } from "./useNativeAuth";
import { useToast } from "@/hooks/use-toast";
import {
  AdminToggle,
  DangerConfirm,
  ErrorBox,
  LoadingBlock,
  fmtDateTime,
  inputCls,
} from "./AdminShared";

interface AdminUserRow {
  id: number;
  email: string;
  role: string;
  suspended: boolean;
  createdAt: string;
  emailCount: number;
  messageCount: number;
}

export function AdminUsers() {
  const { user: me } = useNativeAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"semua" | "user" | "admin">("semua");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pwInput, setPwInput] = useState<Record<number, string>>({});
  const [pwError, setPwError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await nativeFetch<AdminUserRow[]>("/api/admin/users");
      setUsers(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat pengguna.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        (roleFilter === "semua" || u.role === roleFilter) &&
        (!q || u.email.toLowerCase().includes(q))
    );
  }, [users, search, roleFilter]);

  const err = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan.");

  async function patchUser(id: number, path: string, body: unknown, key: string) {
    setBusy(key);
    try {
      const res = await nativeFetch<{ message?: string }>(
        `/api/admin/users/${id}${path}`,
        { method: "PATCH", body: JSON.stringify(body) }
      );
      toast({ title: res.message ?? "Berhasil disimpan." });
      return true;
    } catch (e) {
      toast({ title: "Gagal", description: err(e), variant: "destructive" });
      return false;
    } finally {
      setBusy(null);
    }
  }

  const toggleSuspend = async (u: AdminUserRow) => {
    const ok = await patchUser(u.id, "/suspend", { suspended: !u.suspended }, `suspend:${u.id}`);
    if (ok)
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, suspended: !u.suspended } : x))
      );
  };

  const changeRole = async (u: AdminUserRow, role: "user" | "admin") => {
    if (u.role === role) return;
    const ok = await patchUser(u.id, "/role", { role }, `role:${u.id}`);
    if (ok) setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
  };

  const resetPassword = async (u: AdminUserRow) => {
    const pw = (pwInput[u.id] ?? "").trim();
    if (pw.length < 8) {
      setPwError("Password minimal 8 karakter.");
      return;
    }
    setPwError("");
    const ok = await patchUser(u.id, "/password", { password: pw }, `pw:${u.id}`);
    if (ok) setPwInput((prev) => ({ ...prev, [u.id]: "" }));
  };

  const deleteUser = async (u: AdminUserRow) => {
    setBusy(`del:${u.id}`);
    try {
      const res = await nativeFetch<{ message?: string }>(`/api/admin/users/${u.id}`, {
        method: "DELETE",
      });
      toast({ title: res.message ?? "Pengguna dihapus." });
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      setExpanded(null);
    } catch (e) {
      toast({ title: "Gagal menghapus", description: err(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-4 pt-3 pb-6 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13.5px] font-extrabold">Pengguna</p>
        <span className="text-[11px] font-bold text-muted-foreground bg-muted rounded-full px-2.5 py-1">
          {filtered.length} dari {users.length}
        </span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari email..."
          className={cn(inputCls, "pl-9")}
        />
      </div>

      <div className="flex gap-2">
        {(["semua", "user", "admin"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRoleFilter(r)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[12.5px] font-bold capitalize active:scale-[0.97]",
              roleFilter === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {r}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock label="Memuat pengguna..." />
      ) : error ? (
        <ErrorBox message={error} onRetry={() => void load()} />
      ) : filtered.length === 0 ? (
        <p className="text-center text-[13px] text-muted-foreground py-8">
          Tidak ada pengguna yang cocok.
        </p>
      ) : (
        filtered.map((u) => {
          const isSelf = me?.id === u.id;
          const open = expanded === u.id;
          return (
            <div key={u.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setExpanded(open ? null : u.id);
                  setPwError("");
                }}
                className="w-full flex items-center gap-3 p-3 text-left active:bg-muted/50"
              >
                <span className="w-10 h-10 rounded-full bg-primary/15 text-primary text-[16px] font-extrabold flex items-center justify-center shrink-0">
                  {(u.email[0] ?? "?").toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-bold truncate">
                    {u.email}
                    {isSelf && (
                      <span className="text-muted-foreground font-semibold"> (Anda)</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span
                      className={cn(
                        "text-[10px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-md",
                        u.role === "admin"
                          ? "bg-violet-500/15 text-violet-500"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {u.role}
                    </span>
                    {u.suspended && (
                      <span className="text-[10px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-destructive/15 text-destructive">
                        Ditangguhkan
                      </span>
                    )}
                    <span className="text-[10.5px] text-muted-foreground">
                      {u.emailCount} alamat · {u.messageCount} pesan
                    </span>
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                    open && "rotate-180"
                  )}
                />
              </button>

              {open && (
                <div className="px-3.5 pb-3.5 pt-1 space-y-3.5 border-t border-border/60">
                  {isSelf ? (
                    <p className="text-[12px] text-muted-foreground pt-2.5">
                      Ini akun Anda sendiri — tidak dapat diubah dari sini.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between pt-2.5">
                        <div>
                          <p className="text-[13px] font-bold">Status akun</p>
                          <p className="text-[11px] text-muted-foreground">
                            {u.suspended
                              ? "Ditangguhkan — tidak bisa login"
                              : "Aktif — bisa login normal"}
                          </p>
                        </div>
                        <AdminToggle
                          on={!u.suspended}
                          onChange={() => void toggleSuspend(u)}
                          label={u.suspended ? "Aktifkan akun" : "Tangguhkan akun"}
                        />
                      </div>

                      <div>
                        <p className="text-[13px] font-bold mb-1.5">Peran</p>
                        <div className="flex rounded-xl bg-muted p-1 gap-1">
                          {(["user", "admin"] as const).map((r) => (
                            <button
                              key={r}
                              type="button"
                              disabled={busy === `role:${u.id}`}
                              onClick={() => void changeRole(u, r)}
                              className={cn(
                                "flex-1 rounded-lg py-2 text-[13px] font-bold capitalize active:scale-[0.98]",
                                u.role === r
                                  ? "bg-background shadow text-foreground"
                                  : "text-muted-foreground"
                              )}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[13px] font-bold mb-1.5">Reset password</p>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={pwInput[u.id] ?? ""}
                            onChange={(e) =>
                              setPwInput((p) => ({ ...p, [u.id]: e.target.value }))
                            }
                            placeholder="Password baru (min. 8)"
                            autoComplete="new-password"
                            className={cn(inputCls, "flex-1 min-w-0")}
                          />
                          <button
                            type="button"
                            disabled={busy === `pw:${u.id}`}
                            onClick={() => void resetPassword(u)}
                            className="shrink-0 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold px-4 active:scale-[0.97] disabled:opacity-50"
                          >
                            {busy === `pw:${u.id}` ? "..." : "Simpan"}
                          </button>
                        </div>
                        {pwError && (
                          <p className="text-[11px] text-destructive font-semibold mt-1">{pwError}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Semua sesi aktif user akan diakhiri.
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          Terdaftar {fmtDateTime(u.createdAt)}
                        </span>
                        <DangerConfirm
                          onConfirm={() => void deleteUser(u)}
                          disabled={busy === `del:${u.id}`}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
