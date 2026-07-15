"use client";

import { useMemo, useState } from "react";
import { Loader2, MessageSquarePlus, Send } from "lucide-react";

import { ApiError, api } from "@/lib/api";
import { Department, Role, type Role as RoleType } from "@/lib/enums";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface StaffUserRow {
  id: string;
  fullName: string;
  role: RoleType;
  isActive: boolean;
  staffProfile: {
    department: Department;
    isAvailable: boolean;
  } | null;
}

const TARGET_ROLES = new Set<RoleType>([Role.SALES, Role.DOC]);

function roleLabel(role: RoleType): string {
  if (role === Role.SALES) return "Satış";
  if (role === Role.DOC) return "Evrak";
  return role;
}

function extractError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return fallback;
}

export function AdminMessageComposer({ role }: { role: RoleType }) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<StaffUserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [receiverId, setReceiverId] = useState("");
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const recipients = useMemo(
    () =>
      users
        .filter(
          (user) =>
            user.isActive &&
            user.staffProfile?.isAvailable === true &&
            TARGET_ROLES.has(user.role),
        )
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "tr")),
    [users],
  );

  if (role !== Role.ADMIN) {
    return null;
  }

  async function loadRecipients() {
    setLoadingUsers(true);
    setFeedback(null);

    try {
      const rows = await api.get<StaffUserRow[]>("/users");
      setUsers(rows);
      if (!receiverId && rows.length > 0) {
        const firstEligible = rows.find(
          (row) =>
            row.isActive &&
            row.staffProfile?.isAvailable === true &&
            TARGET_ROLES.has(row.role),
        );
        if (firstEligible) {
          setReceiverId(firstEligible.id);
        }
      }
    } catch (error) {
      setFeedback({
        type: "error",
        text: extractError(error, "Personel listesi alınamadı."),
      });
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleSend() {
    const normalizedContent = content.trim();
    if (!receiverId) {
      setFeedback({ type: "error", text: "Lütfen alıcı personeli seçin." });
      return;
    }
    if (!normalizedContent) {
      setFeedback({ type: "error", text: "Mesaj içeriği boş olamaz." });
      return;
    }

    setIsSending(true);
    setFeedback(null);

    try {
      await api.post("/messages", {
        receiverId,
        content: normalizedContent,
      });

      setContent("");
      setFeedback({
        type: "success",
        text: "Mesaj başarıyla gönderildi.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text: extractError(error, "Mesaj gönderilemedi."),
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          void loadRecipients();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <MessageSquarePlus className="size-4" />
          Mesaj Gönder
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>İç Mesaj Gönder</DialogTitle>
          <DialogDescription>
            Aktif satış ve evrak personeline dahili bilgilendirme mesajı gönderin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="message-receiver">Alıcı</Label>
            <Select value={receiverId} onValueChange={setReceiverId}>
              <SelectTrigger id="message-receiver" className="w-full">
                <SelectValue placeholder="Personel seçin" />
              </SelectTrigger>
              <SelectContent>
                {recipients.map((recipient) => (
                  <SelectItem key={recipient.id} value={recipient.id}>
                    {recipient.fullName} - {roleLabel(recipient.role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loadingUsers ? (
              <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Personel listesi yükleniyor...
              </p>
            ) : recipients.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Mesaj gönderilebilecek aktif personel bulunamadı.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message-content">Mesaj</Label>
            <Textarea
              id="message-content"
              placeholder="Mesajınızı yazın"
              value={content}
              maxLength={1500}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-28"
            />
            <p className="text-right text-xs text-muted-foreground">
              {content.length}/1500
            </p>
          </div>

          {feedback ? (
            <p
              className={
                feedback.type === "error"
                  ? "text-sm text-red-600"
                  : "text-sm text-emerald-600"
              }
            >
              {feedback.text}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Kapat
          </Button>
          <Button type="button" onClick={handleSend} disabled={isSending || loadingUsers}>
            {isSending ? (
              <>
                <Loader2 className="mr-1 size-4 animate-spin" />
                Gönderiliyor
              </>
            ) : (
              <>
                <Send className="mr-1 size-4" />
                Gönder
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
