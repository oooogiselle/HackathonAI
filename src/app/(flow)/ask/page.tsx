"use client";

// Post a need (/ask, the round Ask button): a plain form. AI only helps when
// asked ("Get suggestions", or "Let AI help" to start from free text), and
// nothing it suggests is applied without a tap. Continue goes to Quick check,
// which runs the safety check on the final wording.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { CalendarSlots, useCalendarConnection } from "@/components/ask/calendar-slots";
import { DurationField } from "@/components/ask/duration-field";
import { type AskFlowState, useAskFlow } from "@/components/ask/flow-provider";
import { Field, ToggleChip } from "@/components/ask/form-bits";
import { PriceField } from "@/components/ask/price-field";
import { StepHeader } from "@/components/ask/step-header";
import { TimePicker, toLocalInput, tomorrowEvening } from "@/components/ask/time-picker";
import { WhoToAsk } from "@/components/ask/who-to-ask";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  categoryForInterest,
  DEFAULT_CATEGORY,
  guessCategoryFromText,
  interestForCategory,
  normalizeCategory,
} from "@/lib/ask/categories";
import { INTEREST_LABELS, toHelperPrefs } from "@/lib/ask/helper-fit";
import { suggestPrice } from "@/lib/ask/price";
import {
  type AskPart,
  type AssistField,
  type AssistSuggestions,
  type HelperPrefs,
  type PayType,
} from "@/lib/ask/types";
import { assistAsk } from "@/server/actions/ask";

const FIELD_IDS: Record<AssistField, string> = {
  when: "write-when",
  where: "write-where",
  details: "write-details",
};

// The design's pay chips. "Fund" is the asker paying (payType "pay").
const PAY_CHOICES: { label: string; value: PayType }[] = [
  { label: "Fund", value: "pay" },
  { label: "Trade", value: "trade" },
  { label: "Free", value: "free" },
];

function formatWhen(local: string) {
  return new Date(local).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type Form = {
  what: string;
  // Typed under Who to ask > Other; "" = none. Without it, the first interest
  // picked is the category, else Continue falls back to a keyword guess.
  category: string;
  details: string;
  payType: PayType;
  // Local "YYYY-MM-DDTHH:mm" values. A set time is also when the ask comes
  // down; "Any time before" (when = "") asks only for the deadline.
  when: string;
  deadline: string;
  where: string;
  minutes: number;
  helper: HelperPrefs;
  // null = follow the suggested price.
  price: number | null;
};

function initialForm(state: AskFlowState): Form {
  // Once the last ask was posted (it has a token), the next one starts blank.
  const posted = Boolean(state.token);
  const part = posted ? undefined : state.parts[state.activePart];
  if (part) {
    return {
      what: part.what,
      category:
        part.askCategory &&
        part.askCategory !== DEFAULT_CATEGORY &&
        !interestForCategory(part.askCategory)
          ? part.askCategory
          : "",
      details: part.text,
      payType: part.payType ?? (part.priceSet > 0 ? "pay" : "free"),
      when: part.startsAt ? toLocalInput(new Date(part.startsAt)) : "",
      deadline: part.deadline
        ? toLocalInput(new Date(part.deadline))
        : toLocalInput(tomorrowEvening()),
      where: part.where ?? "",
      minutes: part.minutes,
      helper: part.helper,
      price: part.priceSet,
    };
  }
  return {
    what: "",
    category: "",
    // Carried over from the AI path's "I'd rather fill in a form".
    details: posted ? "" : state.need,
    payType: "pay",
    when: "",
    deadline: toLocalInput(tomorrowEvening()),
    where: "",
    minutes: 30,
    helper: toHelperPrefs({ interests: [], needs: [], nice: [], why: "" }),
    price: null,
  };
}

export default function PostNeed() {
  const { state, ready } = useAskFlow();
  // Wait for sessionStorage so Back from Quick check restores the form.
  return (
    <>
      <StepHeader title="Post a need" backHref="/" />
      {ready && <WriteForm initial={initialForm(state)} />}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-card p-4 shadow-[0_1px_2px_rgba(14,42,32,0.06)]">
      <h2 className="text-[15px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

function WriteForm({ initial }: { initial: Form }) {
  const router = useRouter();
  const { reset } = useAskFlow();
  const [form, setForm] = useState(initial);
  const [suggestions, setSuggestions] = useState<AssistSuggestions | null>(null);
  const [error, setError] = useState("");
  const [assisting, startAssist] = useTransition();
  const calendar = useCalendarConnection();

  const priceSuggestion = suggestPrice(form.minutes, form.helper.interests);
  const price = form.payType === "pay" ? (form.price ?? priceSuggestion.suggested) : 0;

  function set(patch: Partial<Form>) {
    setForm((f) => ({ ...f, ...patch }));
    setError("");
  }

  // A set time is also when the ask comes down.
  function setTime(value: string) {
    set(form.when ? { when: value, deadline: value } : { deadline: value });
  }

  function setMode(setTimeMode: boolean) {
    if (setTimeMode === Boolean(form.when)) return;
    set(setTimeMode ? { when: form.deadline } : { when: "" });
  }

  // The second entry point: free text, and AI suggests the ask.
  function letAiHelp() {
    const need = [form.what.trim(), form.details.trim()].filter(Boolean).join(". ");
    reset({ mode: "ai", need });
    router.push("/describe");
  }

  function getSuggestions() {
    startAssist(async () => {
      const result = await assistAsk({
        what: form.what,
        details: form.details,
        when: form.when ? formatWhen(form.when) : undefined,
        where: form.where || undefined,
        minutes: form.minutes,
      });
      if ("redirect" in result) return router.push(`/resources?type=${result.redirect}`);
      setSuggestions(result.suggestions);
    });
  }

  function applyAll(s: AssistSuggestions) {
    set({ details: s.text, minutes: s.minutes, helper: s.helper });
    setSuggestions(null);
  }

  function validate(): string | null {
    if (!form.what.trim()) return "Add what you need.";
    if (!form.details.trim()) return "Add a few details.";
    const deadline = Date.parse(form.deadline);
    if (Number.isNaN(deadline)) return "Pick a day and time.";
    if (deadline <= Date.now()) return "Pick a time that hasn't passed yet.";
    return null;
  }

  // The form as one ask part; Continue and "See when you're free" save it.
  function saveDraft() {
    const what = form.what.trim();
    const details = form.details.trim();
    const part: AskPart = {
      what,
      when: form.when ? formatWhen(form.when) : undefined,
      startsAt: form.when ? new Date(form.when).toISOString() : undefined,
      where: form.where.trim() || undefined,
      deadline: new Date(form.deadline).toISOString(),
      minutes: form.minutes,
      helper: form.helper,
      price: priceSuggestion,
      priceSet: price,
      text: details,
      // Quick check fills this in.
      category: "none",
      askCategory: form.category.trim()
        ? normalizeCategory(form.category)
        : form.helper.interests[0]
          ? categoryForInterest(form.helper.interests[0])
          : guessCategoryFromText(`${what} ${details}`),
      payType: form.payType,
    };
    reset({
      mode: "form",
      need: [what, details].filter(Boolean).join(". "),
      parts: [part],
      activePart: 0,
      ask: details,
    });
  }

  function submit() {
    const problem = validate();
    if (problem) return setError(problem);
    saveDraft();
    router.push("/check");
  }

  return (
    <>
      <button
        type="button"
        onClick={letAiHelp}
        className="-mt-2 flex items-center gap-2 self-start rounded-full bg-pay px-3.5 py-2 text-sm font-semibold text-secondary-foreground"
      >
        <Sparkles className="size-4" /> Not sure how to put it? Let AI help
      </button>

      <Section title="The need">
        <Field label="What do you need?" id="write-what">
          <Input
            id="write-what"
            value={form.what}
            maxLength={80}
            placeholder="Ride to Lebanon airport"
            onChange={(e) => set({ what: e.target.value })}
          />
        </Field>
        <Field label="Details" id={FIELD_IDS.details} hint="This is what helpers will read.">
          <Textarea
            id={FIELD_IDS.details}
            value={form.details}
            maxLength={1000}
            placeholder="Pick me up at Baker Library at 1:45 pm and drop me at the airport by 2:30 pm. One carry-on."
            onChange={(e) => set({ details: e.target.value })}
            className="min-h-28 text-base"
          />
        </Field>
      </Section>

      <Section title="Pay">
        <div className="flex gap-2">
          {PAY_CHOICES.map((c) => (
            <ToggleChip
              key={c.value}
              label={c.label}
              pressed={form.payType === c.value}
              onClick={() => set({ payType: c.value })}
            />
          ))}
        </div>
        {form.payType === "pay" ? (
          <PriceField
            price={priceSuggestion}
            value={price}
            fits={form.helper.fits}
            fitsPaid={form.helper.fitsPaid}
            onChange={(value) => set({ price: value, payType: value === 0 ? "free" : "pay" })}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {form.payType === "trade"
              ? "No money changes hands. Say what you can trade in the details."
              : "A favor. It reaches every helper who fits."}
          </p>
        )}
      </Section>

      <Section title="When and where">
        <div className="flex flex-col gap-3">
          <span id="write-when-label" className="text-[13px] font-semibold text-muted-foreground">
            When do you need help?
          </span>
          <div className="flex gap-2" role="group" aria-labelledby="write-when-label">
            <ToggleChip
              label="At a set time"
              pressed={Boolean(form.when)}
              onClick={() => setMode(true)}
            />
            <ToggleChip
              label="Any time before"
              pressed={!form.when}
              onClick={() => setMode(false)}
            />
          </div>
          {/* In both modes: a free time picked here is a set time. */}
          <CalendarSlots
            connected={calendar.connected}
            onConnectInMe={() => {
              saveDraft();
              router.push("/me?next=/ask");
            }}
            minutes={form.minutes}
            interests={form.helper.interests}
            value={form.when}
            onPick={(value) => set({ when: value, deadline: value })}
          />
          <TimePicker
            id={FIELD_IDS.when}
            label={form.when ? "Date and time" : "Any time before"}
            value={form.when || form.deadline}
            onChange={setTime}
            busy={form.when ? calendar.busy : undefined}
          />
          <span className="text-xs text-muted-foreground">
            {form.when
              ? "Your ask comes down at this time if nobody has said yes."
              : "Your ask comes down after this if nobody has said yes."}
          </span>
        </div>
        <Field label="Where" id={FIELD_IDS.where}>
          <Input
            id={FIELD_IDS.where}
            value={form.where}
            maxLength={80}
            placeholder="From Baker Library"
            onChange={(e) => set({ where: e.target.value })}
          />
        </Field>
        <Field label="How long it takes" id="write-minutes">
          <DurationField
            id="write-minutes"
            value={form.minutes}
            onChange={(minutes) => set({ minutes })}
          />
        </Field>
      </Section>

      <section className="rounded-3xl bg-card p-4">
        <WhoToAsk
          helper={form.helper}
          onChange={(helper) => set({ helper })}
          pickInterests={{
            askText: `${form.what} ${form.details}`,
            custom: form.category,
            onCustom: (category) => set({ category }),
          }}
        />
      </section>

      {suggestions ? (
        <SuggestionsPanel
          form={form}
          suggestions={suggestions}
          onUse={set}
          onUseAll={() => applyAll(suggestions)}
          onDismiss={() => setSuggestions(null)}
        />
      ) : (
        <Button
          variant="outline"
          className="h-11"
          disabled={assisting || (!form.what.trim() && !form.details.trim())}
          onClick={getSuggestions}
        >
          {assisting ? "Thinking…" : "Get suggestions"}
        </Button>
      )}

      <div className="mt-auto flex flex-col gap-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button size="lg" className="h-12 text-base" onClick={submit}>
          Continue
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Only verified .edu accounts can post or claim. Nothing is sent without your OK.
        </p>
      </div>
    </>
  );
}

function SuggestionsPanel({
  form,
  suggestions: s,
  onUse,
  onUseAll,
  onDismiss,
}: {
  form: Form;
  suggestions: AssistSuggestions;
  onUse: (patch: Partial<Form>) => void;
  onUseAll: () => void;
  onDismiss: () => void;
}) {
  const sameHelper =
    s.helper.interests.join() === form.helper.interests.join() &&
    s.helper.needs.join() === form.helper.needs.join();
  const helperLabel = [
    ...s.helper.interests.map((i) => INTEREST_LABELS[i]),
    ...s.helper.needs.map((n) => `needs ${n}`),
  ].join(", ");

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-dashed border-input bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Suggestions</h3>
        <div className="flex gap-3 text-sm">
          <button type="button" className="underline" onClick={onUseAll}>
            Use all
          </button>
          <button type="button" className="text-muted-foreground underline" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
      {s.text !== form.details.trim() && (
        <Suggestion label="Wording" onUse={() => onUse({ details: s.text })}>
          <p className="rounded-lg bg-muted px-3 py-2">{s.text}</p>
        </Suggestion>
      )}
      {s.minutes !== form.minutes && (
        <Suggestion label="Time needed" onUse={() => onUse({ minutes: s.minutes })}>
          About {s.minutes} min
        </Suggestion>
      )}
      {!sameHelper && helperLabel && (
        <Suggestion label="Who to ask" onUse={() => onUse({ helper: s.helper })}>
          {s.helper.why ? `${s.helper.why} (${helperLabel})` : helperLabel}
        </Suggestion>
      )}
      {s.missing.map((m) => (
        <button
          key={m.field}
          type="button"
          className="text-left text-sm text-muted-foreground underline"
          onClick={() => document.getElementById(FIELD_IDS[m.field])?.focus()}
        >
          {m.hint}
        </button>
      ))}
    </section>
  );
}

function Suggestion({
  label,
  onUse,
  children,
}: {
  label: string;
  onUse: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {children}
      </div>
      <Button size="sm" variant="outline" onClick={onUse}>
        Use
      </Button>
    </div>
  );
}
