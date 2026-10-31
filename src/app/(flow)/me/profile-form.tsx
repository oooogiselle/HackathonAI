"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// View mode: a label and its saved value.
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}

type FormState = {
  firstName: string;
  canAcceptPayment: boolean;
  payoutMethod: "venmo" | "bank";
  payoutHandle: string;
  interests: Interest[];
  weeklyLimit: number;
  emailNotifications: boolean;
};
type FormError = { field: "firstName" | "payoutHandle"; text: string };

function validate(form: FormState): FormError | undefined {
  if (!form.firstName.trim()) return { field: "firstName", text: "Add your first name." };
  if (form.canAcceptPayment && !form.payoutHandle.trim()) {
    return { field: "payoutHandle", text: "Add where your payouts go, or turn payment off." };
  }
}

// Changes save on their own this long after the last edit.
const AUTOSAVE_MS = 600;

export function ProfileForm({ profile, backToAsk }: { profile: Profile; backToAsk?: boolean }) {
  const router = useRouter();
  const calendar = useCalendarConnection();
  const [form, setForm] = useState<FormState>({
    firstName: profile.firstName,
    canAcceptPayment: Boolean(profile.canAcceptPayment),
    payoutMethod: profile.payoutMethod ?? "venmo",
    payoutHandle: profile.payoutHandle ?? "",
    interests: profile.interests,
    weeklyLimit: profile.weeklyLimit,
    emailNotifications: profile.emailNotifications,
  });
  // Off until "Edit"; then every change autosaves and "Done" goes back.
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<"idle" | "waiting" | "saved">("idle");
  const [error, setError] = useState<FormError>();
  const [saving, startSave] = useTransition();
  const [signingOut, startSignOut] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function save(next: FormState) {
    clearTimeout(timer.current);
    const problem = validate(next);
    if (problem) {
      setError(problem);
      setStatus("idle");
      return false;
    }
    startSave(async () => {
      const result = await updateMyProfile({ ...next, firstName: next.firstName.trim() });
      if ("error" in result) {
        setStatus("idle");
        return void toast.error(result.error);
      }
      setStatus("saved");
      router.refresh();
    });
    return true;
  }

  const set = (patch: Partial<FormState>) => {
    const next = { ...form, ...patch };
    setForm(next);
    setError(undefined);
    setStatus("waiting");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(next), AUTOSAVE_MS);
  };

  function toggleInterest(interest: Interest) {
    set({
      interests: form.interests.includes(interest)
        ? form.interests.filter((i) => i !== interest)
        : [...form.interests, interest],
    });
  }

  function done() {
    // Stay in edit mode if something needs fixing; otherwise save what's pending now.
    const problem = validate(form);
    if (problem) {
      clearTimeout(timer.current);
      setError(problem);
      return document
        .getElementById(problem.field === "firstName" ? "me-name" : "me-payout")
        ?.focus();
    }
    if (status === "waiting") save(form);
    setEditing(false);
  }

  const invalid = (field: string) =>
    error?.field === field
      ? {
          "aria-invalid": true,
          "aria-describedby": `${field === "firstName" ? "me-name" : "me-payout"}-error`,
        }
      : {};

  const calendarCard = (
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
  );

  const signOutButton = (
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
  );

  const statusText = error
    ? "Not saved yet"
    : saving || status === "waiting"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : "";

  const editButton = editing ? (
    <Button size="sm" onClick={done}>
      Done
    </Button>
  ) : (
    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
      Edit
    </Button>
  );

  const payoutLabel = form.payoutMethod === "venmo" ? "Venmo" : "Bank or debit card";

  if (!editing) {
    return (
      <>
        <p aria-live="polite" className="-mb-2 min-h-5 text-right text-sm text-muted-foreground">
          {statusText}
        </p>
        <Card title="You" action={editButton}>
          <Row label="First name">{form.firstName}</Row>
          <p className="text-sm text-muted-foreground">
            Signed in as {profile.email}. Your school email is never shown to other students.
          </p>
        </Card>

        <Card title="Helping">
          <Row label="What you'd enjoy helping with">
            {form.interests.length > 0
              ? form.interests.map((i) => INTEREST_LABELS[i]).join(", ")
              : "None picked yet"}
          </Row>
          <Row label="Most asks a week">{form.weeklyLimit === 0 ? "Paused" : form.weeklyLimit}</Row>
          <Row label="Payment">
            {form.canAcceptPayment
              ? `I can accept payment (${payoutLabel} ${form.payoutHandle})`
              : "Favors only"}
          </Row>
        </Card>

        {calendarCard}

        <Card title="Notifications">
          <Row label="Email me updates">{form.emailNotifications ? "On" : "Off"}</Row>
        </Card>

        {signOutButton}
      </>
    );
  }

  return (
    <>
      <p aria-live="polite" className="-mb-2 min-h-5 text-right text-sm text-muted-foreground">
        {statusText}
      </p>
      <Card title="You" action={editButton}>
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

      {calendarCard}

      <Card title="Notifications">
        <SwitchRow
          title="Email me updates"
          detail="When someone claims your ask, asks you privately, or marks help done."
          on={form.emailNotifications}
          onChange={(emailNotifications) => set({ emailNotifications })}
        />
      </Card>

      {signOutButton}
    </>
  );
}
