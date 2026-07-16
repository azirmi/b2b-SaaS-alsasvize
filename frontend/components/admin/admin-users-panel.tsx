"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, api } from "@/lib/api";
import { Department, Role } from "@/lib/enums";
import { timeAgo } from "@/lib/format";
import type {
  AdminCreateUserPayload,
  AdminCreatableRole,
  AdminUserRecord,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const CREATABLE_ROLES: AdminCreatableRole[] = [
  Role.SALES,
  Role.DOC,
  Role.SEC,
  Role.CUSTOMER,
];

const ROLE_LABEL: Record<Role, string> = {
  [Role.ADMIN]: "Yönetici",
  [Role.SALES]: "Satış",
  [Role.DOC]: "Evrak",
  [Role.SEC]: "Sekreterya",
  [Role.CUSTOMER]: "Danışan",
};

const DEPARTMENT_LABEL: Record<Department, string> = {
  [Department.SALES]: "Satış",
  [Department.DOC]: "Evrak",
  [Department.SEC]: "Sekreterya",
};

const INITIAL_FORM: AdminCreateUserPayload = {
  fullName: "",
  email: "",
  password: "",
  role: Role.CUSTOMER,
};

function formatCreatedAt(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return "—";
  }
  return value.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function roleBadgeClass(role: Role): string {
  switch (role) {
    case Role.ADMIN:
      return "border-[#23345D]/35 text-[#23345D] dark:border-[#8ea0cc]/45 dark:text-[#c3cfeb]";
    case Role.SALES:
      return "border-blue-300/70 text-blue-700 dark:border-blue-700/60 dark:text-blue-400";
    case Role.DOC:
      return "border-emerald-300/70 text-emerald-700 dark:border-emerald-700/60 dark:text-emerald-400";
    case Role.SEC:
      return "border-amber-300/70 text-amber-700 dark:border-amber-700/60 dark:text-amber-400";
    case Role.CUSTOMER:
      return "border-zinc-300/80 text-zinc-700 dark:border-zinc-700/70 dark:text-zinc-300";
  }
}

function statusBadgeClass(isActive: boolean): string {
  return isActive
    ? "border-emerald-300/70 text-emerald-700 dark:border-emerald-700/60 dark:text-emerald-400"
    : "border-red-300/70 text-red-700 dark:border-red-700/60 dark:text-red-400";
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "İşlem sırasında beklenmeyen bir hata oluştu.";
}

export function AdminUsersPanel({
  initialUsers,
  currentUserId,
}: {
  initialUsers: AdminUserRecord[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<AdminUserRecord[]>(initialUsers);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<AdminCreateUserPayload>(INITIAL_FORM);

  const [deleteTarget, setDeleteTarget] = useState<AdminUserRecord | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const sortedUsers = useMemo(() => {
    return [...users].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [users]);

  async function refreshUsers() {
    setIsRefreshing(true);
    setPanelError(null);
    try {
      const next = await api.get<AdminUserRecord[]>("/admin/users");
      setUsers(next);
    } catch (error) {
      setPanelError(errorMessage(error));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);

    const payload: AdminCreateUserPayload = {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
    };

    if (!payload.fullName || !payload.email || !payload.password) {
      setCreateError("Tüm alanları doldurmanız gerekir.");
      return;
    }

    setCreatePending(true);
    try {
      await api.post("/admin/users", payload);
      setCreateOpen(false);
      setForm(INITIAL_FORM);
      await refreshUsers();
    } catch (error) {
      setCreateError(errorMessage(error));
    } finally {
      setCreatePending(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeletePending(true);
    setPanelError(null);
    try {
      await api.del(`/admin/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      await refreshUsers();
    } catch (error) {
      setPanelError(errorMessage(error));
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <section className="rounded-lg border border-border/40 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-3 py-3.5 sm:px-5">
        <div>
          <h2 className="text-sm font-medium">Kullanıcılar</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Hesapları panelden yönetin, ekip üyelerini ekleyin ve gerektiğinde güvenle silin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {isRefreshing ? "Güncelleniyor..." : `${sortedUsers.length} kullanıcı`}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Ekle
          </Button>
        </div>
      </div>

      {panelError ? (
        <p className="px-3 pt-3 text-xs text-red-600 dark:text-red-400 sm:px-5">
          {panelError}
        </p>
      ) : null}

      {sortedUsers.length === 0 ? (
        <div className="px-3 py-12 text-center text-sm text-muted-foreground sm:px-5">
          Henüz kullanıcı bulunmuyor.
        </div>
      ) : (
        <>
          <div className="space-y-3 px-3 py-4 md:hidden">
            {sortedUsers.map((user) => {
              const isSelf = user.id === currentUserId;

              return (
                <article
                  key={user.id}
                  className="rounded-lg border border-border/40 bg-background p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Kullanıcı
                      </p>
                      <p className="truncate text-sm font-medium text-foreground">
                        {user.fullName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground break-all">
                        {user.email}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(user)}
                      disabled={isSelf}
                      aria-label={`${user.fullName} kullanıcısını sil`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Rol
                      </p>
                      <Badge
                        variant="outline"
                        className={cn("rounded-md text-[11px]", roleBadgeClass(user.role))}
                      >
                        {ROLE_LABEL[user.role]}
                      </Badge>
                      {user.staffProfile ? (
                        <p className="text-xs text-muted-foreground">
                          Birim: {DEPARTMENT_LABEL[user.staffProfile.department]}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-1 text-right">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Durum
                      </p>
                      <Badge
                        variant="outline"
                        className={cn("rounded-md text-[11px]", statusBadgeClass(user.isActive))}
                      >
                        {user.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {formatCreatedAt(user.createdAt)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-2 text-right text-[11px] text-muted-foreground">
                    {isSelf ? "Oturumdaki kullanıcı" : `Açılış: ${timeAgo(user.createdAt)}`}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    Ad Soyad
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    E-posta
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    Rol / Birim
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    Durum
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    Oluşturulma
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">
                    İşlem
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.map((user) => {
                  const isSelf = user.id === currentUserId;

                  return (
                    <TableRow key={user.id} className="border-border/40">
                      <TableCell className="font-medium">{user.fullName}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("rounded-md text-[11px]", roleBadgeClass(user.role))}
                        >
                          {ROLE_LABEL[user.role]}
                        </Badge>
                        {user.staffProfile ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {DEPARTMENT_LABEL[user.staffProfile.department]}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("rounded-md text-[11px]", statusBadgeClass(user.isActive))}
                        >
                          {user.isActive ? "Aktif" : "Pasif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <p>{formatCreatedAt(user.createdAt)}</p>
                        <p>{timeAgo(user.createdAt)}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => setDeleteTarget(user)}
                          disabled={isSelf}
                          aria-label={`${user.fullName} kullanıcısını sil`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(nextOpen) => {
          if (!createPending) {
            setCreateOpen(nextOpen);
            if (!nextOpen) {
              setCreateError(null);
            }
          }
        }}
      >
        <DialogContent className="max-w-[calc(100%-1.5rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kullanıcı Ekle</DialogTitle>
            <DialogDescription>
              Personel veya danışan hesabını güvenli şekilde oluşturun.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-user-fullName">Ad Soyad</Label>
              <Input
                id="admin-user-fullName"
                value={form.fullName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fullName: event.target.value,
                  }))
                }
                placeholder="Örn. Elif Kaya"
                autoComplete="off"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-user-email">E-posta</Label>
              <Input
                id="admin-user-email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="ornek@alsasvize.com"
                autoComplete="off"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-user-password">Şifre</Label>
              <Input
                id="admin-user-password"
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                minLength={8}
                maxLength={72}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select
                value={form.role}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    role: value as AdminCreatableRole,
                  }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Rol seçin" />
                </SelectTrigger>
                <SelectContent>
                  {CREATABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABEL[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {createError ? (
              <p className="text-xs text-red-600 dark:text-red-400">{createError}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={createPending}
              >
                Vazgeç
              </Button>
              <Button type="submit" disabled={createPending}>
                {createPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deletePending) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-[calc(100%-1.5rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kullanıcıyı Sil</DialogTitle>
            <DialogDescription>
              Bu kullanıcıyı ve tüm verilerini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget ? (
            <div className="rounded-md border border-border/40 bg-muted/40 px-3 py-2 text-sm">
              <p className="font-medium">{deleteTarget.fullName}</p>
              <p className="font-mono text-xs text-muted-foreground">{deleteTarget.email}</p>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deletePending}
              onClick={() => setDeleteTarget(null)}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletePending}
              onClick={confirmDelete}
            >
              {deletePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
