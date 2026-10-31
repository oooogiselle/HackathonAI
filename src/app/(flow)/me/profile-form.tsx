"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useCalendarConnection } from "@/components/ask/calendar-slots";
import { Field, ToggleChip } from "@/components/ask/form-bits";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INTEREST_LABELS } from "@/lib/ask/helper-fit";
import { INTERESTS, type Interest, type Profile } from "@/lib/ask/types";
import { mockSignOut, updateMyProfile } from "@/server/actions/session";

function SwitchRow({
  title,
  detail,
  on,
  onChange,
}: {
  title: string;
  detail: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-11 items-center gap-3 text-left"
    >
      <span className="flex flex-1 flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted-foreground">{detail}</span>
      </span>
      <span
        aria-hidden
        className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          on ? "justify-end bg-primary" : "justify-start bg-input"
        }`}
      >
        <span className="size-5 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-card p-4">
      <h2 className="text-[15px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function ProfileForm({ profile, backToAsk }: { profile: Profile; backToAsk?: boolean }) {
  const router = useRouter();
  const calendar = useCalendarConnection();
  const [form, setForm] = useState({
    firstName: profile.firstName,
    canAcceptPayment: Boolean(profile.canAcceptPayment),
    payoutMethod: profile.payoutMethod ?? "venmo",
    payoutHandle: profile.payoutHandle ?? "",
    interests: profile.interests,
    weeklyLimit: profile.weeklyLimit,
    emailNotifications: profile.emailNotifications,
  });
  const [error, setError] = useState<{ field: "firstName" | "payoutHandle"; text: string }>();
  const [saving, startSave] = useTransition();
  const [signingOut, startSignOut] = useTransition();
  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setError(undefined);
  };

  function toggleInterest(interest: Interest) {
    set({
      interests: form.interests.includes(interest)
        ? form.interests.filter((i) => i !== interest)
        : [...form.interests, interest],
    });
  }

  function save() {
    if (!form.firstName.trim()) {
      setError({ field: "firstName", text: "Add your first name." });
      return document.getElementById("me-name")?.focus();
    }
    if (form.canAcceptPayment && !form.payoutHandle.trim()) {
      setError({ field: "payoutHandle", text: "Add where your payouts go, or turn payment off." });
      return document.getElementById("me-payout")?.focus();
    }
    startSave(async () => {
      const result = await updateMyProfile({ ...form, firstName: form.firstName.trim() });
      if ("error" in result) return void toast.error(result.error);
      toast.success("Saved");
      router.refresh();
    });
  }

  const invalid = (field: string) =>
    error?.field === field
      ? {
          "aria-invalid": true,
          "aria-describedby": `${field === "firstName" ? "me-name" : "me-payout"}-error`,
        }
      : {};

  return (
    <>
      <Card title="You">
        <Field
          label="First name"
          id="me-name"
          hint="Shown on asks you don't post anonymously, and to helpers you confirm."
          error={error?.field === "firstName" ? error.text : undefined}
        >
          <Input
            id="me-name"
            value={form.firstName}
            maxLength={40}
            autoComplete="given-name"
            onChange={(e) => set({ firstName: e.target.value })}
            {...invalid("firstName")}
          />
        </Field>
        <p className="text-sm text-muted-foreground">
          Signed in as {profile.email}. Your school email is never shown to other students.
        </p>
      </Card>

      <Card title="Helping">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-muted-foreground">
            What you&apos;d enjoy helping with
          </span>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((interest) => (
              <ToggleChip
                key={interest}
                label={INTEREST_LABELS[interest]}
                pressed={form.interests.includes(interest)}
                onClick={() => toggleInterest(interest)}
              />
            ))}
          </div>
        </div>
        <Field
          label="Most asks a week"
          id="me-limit"
          hint="We won't match you with more than this. 0 pauses matching."
        >
          <Input
            id="me-limit"
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            value={form.weeklyLimit}
            onChange={(e) =>
              set({
                weeklyLimit: Math.min(20, Math.max(0, Math.round(Number(e.target.value) || 0))),
              })
            }
            className="w-24"
          />
        </Field>
        <SwitchRow
          title="I can accept payment"
          detail="Paid asks only go to helpers who turn this on. Many F-1 students can't be paid; leave it off if that's you."
          on={form.canAcceptPayment}
          onChange={(canAcceptPayment) => set({ canAcceptPayment })}
        />
        {form.canAcceptPayment && (
          <div className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-3">
            <div className="flex gap-2">
              <ToggleChip
                label="Venmo"
                pressed={form.payoutMethod === "venmo"}
                onClick={() => set({ payoutMethod: "venmo" })}
              />
              <ToggleChip
                label="Bank or debit card"
                pressed={form.payoutMethod === "bank"}
                onClick={() => set({ payoutMethod: "bank" })}
              />
            </div>
            <Field
              label={form.payoutMethod === "venmo" ? "Venmo username" : "Last 4 digits"}
              id="me-payout"
              hint="Demo: no real account is connected."
              error={error?.field === "payoutHandle" ? error.text : undefined}
            >
              <Input
                id="me-payout"
                value={form.payoutHandle}
                maxLength={100}
                inputMode={form.payoutMethod === "bank" ? "numeric" : "text"}
                placeholder={form.payoutMethod === "venmo" ? "@your-name" : "4242"}
                onChange={(e) => set({ payoutHandle: e.target.value })}
                {...invalid("payoutHandle")}
              />
            </Field>
          </div>
        )}
      </Card>

      <Card title="Calendar">
        <SwitchRow
          title="Connect Google Calendar"
          detail="Ask sees only when you're free, never event details, and suggests times when you ask. Turns on right away. Demo: no real calendar is connected."
          on={calendar.connected}
          onChange={calendar.setConnected}
        />
        {backToAsk && calendar.connected && (
          <Link href="/ask" className={buttonVariants({ variant: "outline" })}>
            Back to your ask
          </Link>
        )}
      </Card>

      <Card title="Notifications">
        <SwitchRow
          title="Email me updates"
          detail="When someone claims your ask, asks you privately, or marks help done."
          on={form.emailNotifications}
          onChange={(emailNotifications) => set({ emailNotifications })}
        />
      </Card>

      <div className="flex flex-col gap-2">
        <Button size="lg" className="text-base" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          variant="ghost"
          disabled={signingOut}
          onClick={() =>
            startSignOut(async () => {
              await mockSignOut();
              router.push("/");
              router.refresh();
            })
          }
        >
          Sign out
        </Button>
      </div>
    </>
  );
}
