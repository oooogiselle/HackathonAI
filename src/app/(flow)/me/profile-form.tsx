"use client";

import { Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { useCalendarConnection } from "@/components/ask/calendar-slots";
import { Field, RemovableChip, ToggleChip } from "@/components/ask/form-bits";
import { ScrubNotice } from "@/components/ask/scrub-notice";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cleanTags, INTEREST_LABELS, MAX_TAGS, type SkillSuggestion } from "@/lib/ask/helper-fit";
import {
  type BlockedEntry,
  INTERESTS,
  type Interest,
  type Profile,
  type ThanksNote,
} from "@/lib/ask/types";
import {
  busyFromFree,
  cellKey,
  DAY_PARTS,
  freeCells,
  freeSummary,
  WEEK_DAYS,
} from "@/lib/ask/week-grid";
import { scrubForAnonymous } from "@/server/actions/ask";
import { mockSignOut, unblockPerson, updateMyProfile } from "@/server/actions/session";

import { SkillsFromWords } from "./skills-from-words";

const CLASS_YEARS = ["First-year", "Sophomore", "Junior", "Senior", "Grad student", "Alum"];
const BLURB_MAX = 160;
// Changes save on their own this long after the last edit.
const AUTOSAVE_MS = 600;

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
  note,
  children,
}: {
  title: string;
  // One line under the title: who sees this section.
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-bold">{title}</h2>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
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
      <span className="font-medium">{children}</span>
    </div>
  );
}

// The card other students see when you're suggested as a helper, drawn from the
// form as you edit. Your alias, never your name.
function HelperPreview({
  alias,
  classYear,
  showClassYear,
  blurb,
  interests,
  tags,
  free,
  weeklyLimit,
  canAcceptPayment,
}: {
  alias: string;
  classYear: string;
  showClassYear: boolean;
  blurb: string;
  interests: Interest[];
  tags: string[];
  free: Set<string>;
  weeklyLimit: number;
  canAcceptPayment: boolean;
}) {
  const paused = weeklyLimit === 0;
  return (
    <section aria-labelledby="preview-title" className="flex flex-col gap-2">
      <h2 id="preview-title" className="px-1 text-[13px] font-semibold text-muted-foreground">
        How others see you
      </h2>
      <div
        className={`relative overflow-hidden rounded-[28px] bg-primary text-primary-foreground transition-opacity ${
          paused ? "opacity-75" : ""
        }`}
      >
        {/* A big soft initial behind the card, the one playful flourish on this screen. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-10 -right-4 text-[180px] leading-none font-extrabold text-white/[0.07] select-none"
        >
          {alias.slice(0, 1)}
        </span>

        <div className="relative flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-14 shrink-0 -rotate-6 items-center justify-center rounded-2xl bg-pay text-2xl font-extrabold text-ink shadow-[0_4px_0_0_rgba(14,42,32,0.35)]">
              {alias.slice(0, 1)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xl font-extrabold tracking-tight">{alias}</span>
              <span className="text-sm text-white/70">
                {showClassYear && classYear ? classYear : "Dartmouth"}
              </span>
            </div>
            <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
              {paused ? "Taking a break" : canAcceptPayment ? "Paid or favors" : "Favors only"}
            </span>
          </div>

          <p className={`text-[15px] leading-snug ${blurb.trim() ? "" : "text-white/60 italic"}`}>
            {blurb.trim() || "Add a line about you so askers know who's coming, without your name."}
          </p>

          {interests.length + tags.length > 0 && (
            <ul aria-label="Helps with" className="flex flex-wrap gap-1.5">
              {interests.map((i) => (
                <li
                  key={i}
                  className="rounded-full bg-pay px-2.5 py-1 text-xs font-semibold text-ink"
                >
                  {INTEREST_LABELS[i]}
                </li>
              ))}
              {tags.map((t) => (
                <li key={t} className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative flex border-t-2 border-dashed border-white/20 text-sm">
          <div className="flex flex-1 flex-col gap-0.5 p-4 pr-2">
            <span className="text-xs text-white/60">Usually free</span>
            <span className="font-semibold">{freeSummary(free, 2)}</span>
          </div>
          <div className="flex w-28 shrink-0 flex-col gap-0.5 border-l-2 border-dashed border-white/20 p-4">
            <span className="text-xs text-white/60">Each week</span>
            <span className="font-semibold">
              {paused ? "Paused" : `Up to ${weeklyLimit} ${weeklyLimit === 1 ? "ask" : "asks"}`}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function WeekGrid({ free, onToggle }: { free: Set<string>; onToggle: (key: string) => void }) {
  return (
    <div role="group" aria-label="When you're free" className="flex flex-col gap-1.5">
      <div className="flex gap-1 pl-[4.5rem]" aria-hidden>
        {WEEK_DAYS.map((d) => (
          <span key={d.day} className="flex-1 text-center text-xs font-bold text-muted-foreground">
            {d.short}
          </span>
        ))}
      </div>
      {DAY_PARTS.map((part, p) => (
        <div key={part.key} className="flex items-center gap-1">
          <span className="w-[4.25rem] shrink-0 text-xs font-semibold text-muted-foreground">
            {part.label}
          </span>
          {WEEK_DAYS.map((d) => {
            const key = cellKey(d.day, p);
            const on = free.has(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                aria-label={`${d.name} ${part.label.toLowerCase()}`}
                onClick={() => onToggle(key)}
                className={`h-11 flex-1 rounded-lg transition-colors ${
                  on ? "bg-primary" : "bg-muted hover:bg-input"
                }`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function ProfileForm({
  profile,
  thanks,
  blocked,
  backToAsk,
}: {
  profile: Profile;
  thanks: ThanksNote[];
  blocked: BlockedEntry[];
  // From "See when you're free" on Post a need (?next=/ask).
  backToAsk?: boolean;
}) {
  const router = useRouter();
  const calendar = useCalendarConnection();
  const [form, setForm] = useState({
    firstName: profile.firstName,
    classYear: profile.classYear ?? "",
    showClassYear: profile.showClassYear,
    blurb: profile.blurb ?? "",
    phone: profile.phone ?? "",
    canAcceptPayment: Boolean(profile.canAcceptPayment),
    payoutMethod: profile.payoutMethod ?? "venmo",
    payoutHandle: profile.payoutHandle ?? "",
    interests: profile.interests,
    tags: profile.tags,
    weeklyLimit: profile.weeklyLimit,
    emailNotifications: profile.emailNotifications,
  });
  const initialFree = useMemo(() => freeCells(profile.busy), [profile.busy]);
  const [free, setFree] = useState(initialFree);
  // Only send free/busy when the grid changed, so finer seeded slots are kept.
  const [gridTouched, setGridTouched] = useState(false);
  const [error, setError] = useState<{ field: "firstName" | "payoutHandle"; text: string }>();
  // The blurb goes through the privacy check on Save, like an anonymous ask.
  // `checked` is the wording already checked (or kept with Undo), so it isn't checked again.
  const [checked, setChecked] = useState(profile.blurb ?? "");
  const [scrub, setScrub] = useState<{ original: string; text: string; removed: string[] }>();
  const [scrubUndone, setScrubUndone] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [saving, startSave] = useTransition();
  const [signingOut, startSignOut] = useTransition();
  const [unblocking, startUnblock] = useTransition();
  // Off until "Edit"; then every change autosaves, and "Done" goes back.
  const [editing, setEditing] = useState(false);
  // Bumped on every change; the autosave runs once it stops changing.
  const [version, setVersion] = useState(0);
  const [savedVersion, setSavedVersion] = useState(0);
  const [saved, setSaved] = useState(false);
  const touch = () => {
    setVersion((v) => v + 1);
    setSaved(false);
  };
  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setError(undefined);
    touch();
  };

  function toggleInterest(interest: Interest) {
    set({
      interests: form.interests.includes(interest)
        ? form.interests.filter((i) => i !== interest)
        : [...form.interests, interest],
    });
  }

  function addSkills(add: SkillSuggestion) {
    set({
      interests: [...new Set([...form.interests, ...add.interests])],
      tags: cleanTags([...form.tags, ...add.tags]),
    });
  }

  function addTypedTag() {
    const next = cleanTags([...form.tags, newTag]);
    if (next.length === form.tags.length) return;
    set({ tags: next });
    setNewTag("");
  }

  function toggleFree(key: string) {
    setFree((f) => {
      const next = new Set(f);
      if (!next.delete(key)) next.add(key);
      return next;
    });
    setGridTouched(true);
    touch();
  }

  function validate() {
    if (!form.firstName.trim())
      return { field: "firstName" as const, text: "Add your first name." };
    if (form.canAcceptPayment && !form.payoutHandle.trim()) {
      return {
        field: "payoutHandle" as const,
        text: "Add where your payouts go, or turn payment off.",
      };
    }
  }

  // A blurb that hasn't been through the privacy check yet.
  const blurbUnchecked = () => {
    const blurb = form.blurb.trim();
    return Boolean(blurb) && blurb !== checked;
  };

  // checkBlurb: run the privacy check on a changed blurb now. Autosave leaves
  // the blurb as last checked, so the check never rewrites it while you type;
  // it runs when you leave the box or tap Done.
  function save(checkBlurb: boolean) {
    setSavedVersion(version);
    const problem = validate();
    if (problem) return setError(problem);
    startSave(async () => {
      let blurb = form.blurb.trim();
      if (blurbUnchecked()) {
        if (checkBlurb) {
          const result = await scrubForAnonymous(blurb);
          setScrub({ original: blurb, text: result.text, removed: result.removed });
          setScrubUndone(false);
          blurb = result.text.trim();
          setChecked(blurb);
          setForm((f) => ({ ...f, blurb }));
        } else {
          blurb = checked;
        }
      }
      const result = await updateMyProfile({
        ...form,
        blurb,
        firstName: form.firstName.trim(),
        ...(gridTouched ? { busy: busyFromFree(free) } : {}),
      });
      if ("error" in result) return void toast.error(result.error);
      setSaved(true);
      setGridTouched(false);
      router.refresh();
    });
  }

  const autosave = useEffectEvent(() => {
    if (savedVersion !== version) save(false);
  });
  useEffect(() => {
    if (version === 0) return;
    const timer = setTimeout(autosave, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [version]);

  function done() {
    // Stay in edit mode until it's valid; otherwise save what's pending now.
    const problem = validate();
    if (problem) {
      setError(problem);
      return document
        .getElementById(problem.field === "firstName" ? "me-name" : "me-payout")
        ?.focus();
    }
    if (savedVersion !== version || blurbUnchecked()) save(true);
    setEditing(false);
  }

  // Undo puts the original wording back; the next Save keeps it as written.
  function toggleScrub() {
    if (!scrub) return;
    const blurb = scrubUndone ? scrub.text : scrub.original;
    set({ blurb });
    setChecked(blurb);
    setScrubUndone(!scrubUndone);
  }

  const invalid = (field: string) =>
    error?.field === field
      ? {
          "aria-invalid": true,
          "aria-describedby": `${field === "firstName" ? "me-name" : "me-payout"}-error`,
        }
      : {};

  const status = error
    ? "Not saved yet"
    : saving || savedVersion !== version
      ? "Saving…"
      : saved
        ? "Saved"
        : "";

  const header = (
    <div className="flex items-center justify-end gap-3">
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {status}
      </p>
      {!editing && (
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Edit
        </Button>
      )}
    </div>
  );

  const scrubNotice = scrub && (
    <ScrubNotice removed={scrub.removed} undone={scrubUndone} onToggle={toggleScrub} />
  );

  const calendarSwitch = (
    <>
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
    </>
  );

  const thanksCard = (
    <Card title="Thank-you notes" note="From people you've helped. Only you see these.">
      {thanks.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {thanks.map((t, i) => (
            <li
              key={`${t.at}-${i}`}
              className={`flex flex-col gap-1 rounded-2xl bg-pay p-4 text-ink ${
                i % 2 ? "rotate-[0.6deg]" : "-rotate-[0.6deg]"
              }`}
            >
              <p className="text-[15px] leading-snug font-medium">&ldquo;{t.thanks}&rdquo;</p>
              <span className="text-xs text-secondary-foreground/80">For {t.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">
            When someone you help writes a thank-you, it lands here.
          </p>
          <Link
            href="/"
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Find an ask on the board
          </Link>
        </div>
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

  if (!editing) {
    return (
      <>
        {header}
        <HelperPreview {...form} alias={profile.alias} free={free} />
        {scrubNotice}

        <Card title="Private" note="Only you see this.">
          <Row label="First name">{form.firstName}</Row>
          <Row label="School email">{profile.email}</Row>
          <Row label="Phone">{form.phone || "Not added"}</Row>
          <Row label="Getting paid">
            {form.canAcceptPayment
              ? `I can accept payment (${form.payoutMethod === "venmo" ? "Venmo" : "Bank or debit card"} ${form.payoutHandle})`
              : "Favors only"}
          </Row>
          <Row label="Email me updates">{form.emailNotifications ? "On" : "Off"}</Row>
        </Card>

        <Card title="Calendar">{calendarSwitch}</Card>

        {thanksCard}
        {signOutButton}
      </>
    );
  }

  return (
    <>
      {header}
      <HelperPreview {...form} alias={profile.alias} free={free} />

      <Card
        title="Your helper card"
        note={`Everyone sees you as ${profile.alias}, never your name. Your alias stays the same.`}
      >
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-muted-foreground">Year</span>
          <div className="flex flex-wrap gap-2">
            {CLASS_YEARS.map((year) => (
              <ToggleChip
                key={year}
                label={year}
                pressed={form.classYear === year}
                onClick={() => set({ classYear: form.classYear === year ? "" : year })}
              />
            ))}
          </div>
        </div>
        <SwitchRow
          title="Show my year"
          detail="Off shows just Dartmouth."
          on={form.showClassYear}
          onChange={(showClassYear) => set({ showClassYear })}
        />
        <Field
          label="A line about you"
          id="me-blurb"
          hint={`${form.blurb.length}/${BLURB_MAX}. What you've been through that might help. Skip your name, dorm and contact info; we check it when you leave this box.`}
        >
          <Textarea
            id="me-blurb"
            value={form.blurb}
            maxLength={BLURB_MAX}
            rows={3}
            placeholder="Senior with a car. Went through the SSN line last year and survived."
            onChange={(e) => set({ blurb: e.target.value })}
            onBlur={() => blurbUnchecked() && save(true)}
          />
        </Field>
        {scrubNotice}
      </Card>

      <Card
        title="What you help with"
        note="Matching only sends you asks that fit what you pick here."
      >
        <div role="group" aria-label="Interests" className="flex flex-wrap gap-2">
          {INTERESTS.map((interest) => (
            <ToggleChip
              key={interest}
              label={INTEREST_LABELS[interest]}
              pressed={form.interests.includes(interest)}
              onClick={() => toggleInterest(interest)}
            />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-muted-foreground">Specifics</span>
          {form.tags.length > 0 && (
            <ul aria-label="Specifics" className="flex flex-wrap gap-2">
              {form.tags.map((t) => (
                <li key={t}>
                  <RemovableChip
                    label={t}
                    strong
                    onRemove={() => set({ tags: form.tags.filter((x) => x !== t) })}
                  />
                </li>
              ))}
            </ul>
          )}
          {form.tags.length < MAX_TAGS && (
            <div className="flex gap-2">
              <Input
                aria-label="Add a specific"
                value={newTag}
                maxLength={24}
                placeholder="Add one, like korean or ikea furniture"
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTypedTag();
                  }
                }}
              />
              <Button
                variant="secondary"
                aria-label="Add specific"
                disabled={!newTag.trim()}
                onClick={addTypedTag}
              >
                <Plus aria-hidden className="size-4" />
              </Button>
            </div>
          )}
        </div>
        <SkillsFromWords interests={form.interests} tags={form.tags} onAdd={addSkills} />
        <div className="flex items-center gap-3">
          <div className="flex flex-1 flex-col">
            <span id="me-limit-label" className="font-semibold">
              Most asks a week
            </span>
            <span className="text-sm text-muted-foreground">0 pauses matching.</span>
          </div>
          <div
            role="group"
            aria-labelledby="me-limit-label"
            className="flex items-center gap-1 rounded-full bg-muted p-1"
          >
            <button
              type="button"
              aria-label="One fewer"
              disabled={form.weeklyLimit === 0}
              onClick={() => set({ weeklyLimit: form.weeklyLimit - 1 })}
              className="flex size-9 items-center justify-center rounded-full bg-card disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <output aria-live="polite" className="w-8 text-center text-lg font-extrabold">
              {form.weeklyLimit}
            </output>
            <button
              type="button"
              aria-label="One more"
              disabled={form.weeklyLimit === 20}
              onClick={() => set({ weeklyLimit: form.weeklyLimit + 1 })}
              className="flex size-9 items-center justify-center rounded-full bg-card disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
      </Card>

      <Card
        title="When you're free"
        note="Green means free. Tap the times you're usually busy. Matching only reads free or busy, never what you're doing."
      >
        <WeekGrid free={free} onToggle={toggleFree} />
        {calendarSwitch}
      </Card>

      <Card title="Getting paid" note="Private.">
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

      <Card title="Account" note="Private. Only you see this.">
        <Field
          label="First name"
          id="me-name"
          hint="Only you see it, when we say hi. Everyone else sees your alias."
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
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-muted-foreground">School email</span>
          <span className="font-medium">{profile.email}</span>
          <span className="text-xs text-muted-foreground">
            Signed in with Dartmouth. Your email is never shown to other students.
          </span>
        </div>
        <Field label="Phone (optional)" id="me-phone" hint="Never shown to other students.">
          <Input
            id="me-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
            value={form.phone}
            onChange={(e) => set({ phone: e.target.value })}
          />
        </Field>
        <SwitchRow
          title="Email me updates"
          detail="When someone claims your ask, asks you privately, or marks help done."
          on={form.emailNotifications}
          onChange={(emailNotifications) => set({ emailNotifications })}
        />
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-muted-foreground">Blocked people</span>
          {blocked.length > 0 ? (
            <ul className="flex flex-col divide-y rounded-2xl border">
              {blocked.map((b) => (
                <li key={b.key} className="flex items-center gap-3 py-2 pr-2 pl-3">
                  <span className="flex-1 text-sm">{b.label}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={unblocking}
                    onClick={() =>
                      startUnblock(async () => {
                        const result = await unblockPerson(b.key);
                        if ("error" in result) return void toast.error(result.error);
                        toast.success("Unblocked");
                        router.refresh();
                      })
                    }
                  >
                    Unblock
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-sm text-muted-foreground">No one.</span>
          )}
        </div>
      </Card>

      <div className="sticky bottom-24 z-10 flex flex-col gap-2 md:bottom-6">
        <Button size="lg" className="text-base shadow-md" onClick={done}>
          Done
        </Button>
      </div>
      {signOutButton}
    </>
  );
}
