"use client";

import Link from "next/link";
import { useActionState } from "react";

import { login, type AuthFormState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL_STATE: AuthFormState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(login, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="space-y-2">
        <Label htmlFor="email">E-posta</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="siz@ornek.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Şifre</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
        >
          Şifremi unuttum
        </Link>
      </div>

      <div className="flex items-center gap-2.5">
        <Checkbox id="rememberMe" name="rememberMe" value="true" />
        <Label
          htmlFor="rememberMe"
          className="text-sm leading-relaxed font-normal text-muted-foreground"
        >
          Beni hatırla
        </Label>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}
