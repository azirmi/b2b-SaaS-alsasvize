"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Loader2, RefreshCcw } from "lucide-react";

import { ApiError, api } from "@/lib/api";
import { Role, type Role as RoleType } from "@/lib/enums";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface UnreadMessage {
  id: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    fullName: string;
    role: RoleType;
  };
}

function canReadMessages(role: RoleType): boolean {
  return role === Role.ADMIN || role === Role.SALES || role === Role.DOC;
}

function extractError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return fallback;
}

export function StaffMessagesBell({ role }: { role: RoleType }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UnreadMessage[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const hasBootstrapped = useRef(false);
  const lastUnreadCount = useRef(0);

  const enabled = useMemo(() => canReadMessages(role), [role]);

  const playNotificationSound = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }

      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.06, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);

      setTimeout(() => {
        void context.close();
      }, 300);
    } catch {
      // Sound is best-effort; skip silently if browser blocks audio.
    }
  }, []);

  const refreshUnread = useCallback(
    async (showLoader: boolean) => {
      if (!enabled) {
        return;
      }

      if (showLoader) {
        setLoading(true);
      }

      try {
        const unread = await api.get<UnreadMessage[]>("/messages/unread");
        setMessages(unread);
        setErrorText(null);

        const previousCount = lastUnreadCount.current;
        const nextCount = unread.length;
        if (hasBootstrapped.current && nextCount > previousCount) {
          playNotificationSound();
        }
        lastUnreadCount.current = nextCount;
        hasBootstrapped.current = true;
      } catch (error) {
        setErrorText(extractError(error, "Mesajlar alınamadı."));
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [enabled, playNotificationSound],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void refreshUnread(true);

    const interval = setInterval(() => {
      void refreshUnread(false);
    }, 30_000);

    return () => clearInterval(interval);
  }, [enabled, refreshUnread]);

  if (!enabled) {
    return null;
  }

  async function markAsRead(messageId: string) {
    setMarkingId(messageId);
    setErrorText(null);

    try {
      await api.patch(`/messages/${messageId}/read`);
      setMessages((current) => current.filter((message) => message.id !== messageId));
    } catch (error) {
      setErrorText(extractError(error, "Mesaj güncellenemedi."));
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          void refreshUnread(true);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="relative"
          aria-label="Mesajlar"
        >
          <Bell className="size-4" />
          {messages.length > 0 ? (
            <span className="absolute -top-1 -right-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold leading-none text-white">
              {messages.length > 9 ? "9+" : messages.length}
            </span>
          ) : null}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Okunmamış Mesajlar</DialogTitle>
          <DialogDescription>
            Yönetici tarafından size gönderilen dahili bildirimleri burada görebilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{messages.length} okunmamış mesaj</span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-auto px-1.5 py-1"
              onClick={() => void refreshUnread(true)}
              disabled={loading}
            >
              <RefreshCcw className="mr-1 size-3" />
              Yenile
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 rounded-md border border-border/60 p-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Mesajlar yükleniyor...
            </div>
          ) : null}

          {errorText ? (
            <p className="text-sm text-red-600">{errorText}</p>
          ) : null}

          {!loading && messages.length === 0 ? (
            <div className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">
              Yeni mesaj bulunmuyor.
            </div>
          ) : null}

          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {messages.map((message) => (
              <article key={message.id} className="rounded-md border border-border/60 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium tracking-tight text-foreground">
                    {message.sender.fullName}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(message.createdAt)}
                  </span>
                </div>

                <p className="mb-3 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                  {message.content}
                </p>

                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  disabled={markingId === message.id}
                  onClick={() => void markAsRead(message.id)}
                >
                  {markingId === message.id ? (
                    <>
                      <Loader2 className="mr-1 size-3 animate-spin" />
                      İşleniyor
                    </>
                  ) : (
                    <>
                      <CheckCheck className="mr-1 size-3" />
                      Okundu Olarak İşaretle
                    </>
                  )}
                </Button>
              </article>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
