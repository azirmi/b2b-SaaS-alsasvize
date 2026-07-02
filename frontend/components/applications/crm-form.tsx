"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveCrm } from "@/lib/actions/applications";
import { CRM_CURRENCIES, CRM_TARGET_COUNTRIES } from "@/lib/crm";
import type { CrmActionState, CrmData } from "@/lib/types";

const INITIAL: CrmActionState = {};

/**
 * Sales CRM data-entry form. Submits via a server action bound to the
 * application id; on success the dashboard subtree revalidates, which flips the
 * "Send to Documents" gate open. All fields are required — the backend re-checks
 * completeness before it will advance the stage.
 */
export function CrmForm({
  applicationId,
  crm,
}: {
  applicationId: string;
  crm: CrmData | null;
}) {
  const action = saveCrm.bind(null, applicationId);
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={crm?.firstName ?? ""}
            maxLength={100}
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={crm?.lastName ?? ""}
            maxLength={100}
            autoComplete="off"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="passportId">Passport ID</Label>
          <Input
            id="passportId"
            name="passportId"
            defaultValue={crm?.passportId ?? ""}
            maxLength={64}
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="targetCountry">Target country</Label>
          <Select name="targetCountry" defaultValue={crm?.targetCountry} required>
            <SelectTrigger id="targetCountry" className="w-full">
              <SelectValue placeholder="Select a country" />
            </SelectTrigger>
            <SelectContent>
              {CRM_TARGET_COUNTRIES.map((country) => (
                <SelectItem key={country} value={country}>
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="totalCost">Total cost</Label>
          <Input
            id="totalCost"
            name="totalCost"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            defaultValue={crm?.totalCost ?? ""}
            placeholder="0.00"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency</Label>
          <Select name="currency" defaultValue={crm?.currency ?? "USD"} required>
            <SelectTrigger id="currency" className="w-full">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              {CRM_CURRENCIES.map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save CRM data"}
        </Button>
        {state.error ? (
          <span role="alert" className="text-xs text-red-600 dark:text-red-400">
            {state.error}
          </span>
        ) : null}
        {state.ok ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            Saved.
          </span>
        ) : null}
      </div>
    </form>
  );
}
