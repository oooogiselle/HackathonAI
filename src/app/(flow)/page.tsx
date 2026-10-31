"use client";

// Step 1: Home is a plain form. AI only helps when asked ("Get suggestions",
// or "Let AI help" for the breakdown path), and nothing it suggests is applied
// without a tap. Safety runs on Continue, before anything else happens.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { type AskFlowState, useAskFlow } from "@/components/ask/flow-provider";
import { Field, ToggleChip } from "@/components/ask/form-bits";
import { PriceField } from "@/components/ask/price-field";
import { StepHeader } from "@/components/ask/step-header";
import { WhoToAsk } from "@/components/ask/who-to-ask";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { INTEREST_LABELS, toHelperPrefs } from "@/lib/ask/helper-fit";
import { suggestPrice } from "@/lib/ask/price";
import type { AskPart, AssistField, AssistSuggestions, HelperPrefs } from "@/lib/ask/types";
import { assistAsk, checkSafety } from "@/server/actions/ask";

const DAY_MS = 24 * 60 * 60 * 1000;
const FIELD_IDS: Record<AssistField, string> = {
  when: "write-when",
  where: "write-where",
  details: "write-details",
};

// <input type="datetime-local"> works in local time without a zone.
function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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
  details: string;
  when: string; // datetime-local value, "" = flexible
  deadline: string; // datetime-local value
  deadlineTouched: boolean;
  where: string;
  minutes: number;
  helper: HelperPrefs;
  // null = follow the suggested price.
  price: number | null;
};

function initialForm(state: AskFlowState): Form {
  const part = state.mode === "form" ? state.parts[0] : undefined;
  if (part) {
    return {
      what: part.what,
      details: part.text,
      when: part.startsAt ? toLocalInput(new Date(part.startsAt)) : "",
      deadline: part.deadline ? toLocalInput(new Date(part.deadline)) : "",
      deadlineTouched: true,
      where: part.where ?? "",
      minutes: part.minutes,
      helper: part.helper,
      price: part.priceSet,
    };
  }
  return {
    what: "",
    // Carried over from the AI path's "I'd rather fill in a form".
    details: state.mode === "form" ? state.need : "",
    when: "",
    deadline: toLocalInput(new Date(Date.now() + DAY_MS)),
    deadlineTouched: false,
    where: "",
    minutes: 30,
    helper: toHelperPrefs({ interests: [], needs: [], nice: [], why: "" }),
    price: null,
  };
}

export default function Home() {
  const { state, ready } = useAskFlow();
  // Wait for sessionStorage so Back from Where restores the form.
  return (
    <>
      <StepHeader
        step={1}
        title="What do you need help with?"
        subtitle="Fill it in. AI can suggest things, only if you ask."
      />
      {ready && <WriteForm initial={initialForm(state)} />}
      <p className="text-center text-xs text-muted-foreground">
        Real people do the helping. Nothing is sent without your OK.
      </p>
    </>
  );
}

function WriteForm({ initial }: { initial: Form }) {
  const router = useRouter();
  const { reset } = useAskFlow();
  const [form, setForm] = useState(initial);
  const [suggestions, setSuggestions] = useState<AssistSuggestions | null>(null);
  const [error, setError] = useState("");
  const [assisting, startAssist] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const priceSuggestion = suggestPrice(form.minutes, form.helper.interests);
  const price = form.price ?? priceSuggestion.suggested;

  function set(patch: Partial<Form>) {
    setForm((f) => ({ ...f, ...patch }));
    setError("");
  }

  function setWhen(when: string) {
    // The deadline follows When until the student sets it themselves.
    setForm((f) => ({ ...f, when, deadline: f.deadlineTouched || !when ? f.deadline : when }));
    setError("");
  }

  // The AI breakdown path; whatever is typed so far carries over.
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
    if (!form.what.trim()) return "Add a title.";
    if (!form.details.trim()) return "Add a few details.";
    const deadline = Date.parse(form.deadline);
    if (Number.isNaN(deadline)) return "Add a deadline.";
    if (deadline <= Date.now()) return "The deadline has to be in the future.";
    if (form.when && deadline > Date.parse(form.when)) {
      return "The deadline can't be after the time you need help.";
    }
    return null;
  }

  function submit() {
    const problem = validate();
    if (problem) return setError(problem);
    const what = form.what.trim();
    const details = form.details.trim();
    startSubmit(async () => {
      const need = `${what}. ${details}`;
      const safety = await checkSafety(need);
      if (safety.category === "crisis") return router.push("/resources?type=crisis");
      if (safety.category === "academic") return router.push("/resources?type=tutoring");
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
        category: safety.category,
      };
      reset({
        mode: "form",
        need,
        category: safety.category,
        parts: [part],
        activePart: 0,
        ask: details,
      });
      router.push("/where");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={letAiHelp}
        className="-mt-3 self-start text-sm text-muted-foreground underline"
      >
        Not sure how to put it? Let AI help
      </button>
      <div className="flex flex-col gap-4">
        <Field label="Title" id="write-what">
          <Input
            id="write-what"
            value={form.what}
            maxLength={80}
            placeholder="Ride to BTV airport"
            onChange={(e) => set({ what: e.target.value })}
          />
        </Field>
        <Field label="Details" id={FIELD_IDS.details} hint="This is what helpers will read.">
          <Textarea
            id={FIELD_IDS.details}
            value={form.details}
            maxLength={1000}
            placeholder="I have two suitcases and my flight is at 10am."
            onChange={(e) => set({ details: e.target.value })}
            className="min-h-28 text-base"
          />
        </Field>
        <Field label="When" id={FIELD_IDS.when}>
          <div className="flex items-center gap-2">
            <Input
              id={FIELD_IDS.when}
              type="datetime-local"
              value={form.when}
              onChange={(e) => setWhen(e.target.value)}
            />
            <ToggleChip label="Flexible" pressed={!form.when} onClick={() => setWhen("")} />
          </div>
        </Field>
        <Field
          label="Deadline"
          id="write-deadline"
          hint="Your ask comes down after this if nobody's said yes."
        >
          <Input
            id="write-deadline"
            type="datetime-local"
            value={form.deadline}
            onChange={(e) => set({ deadline: e.target.value, deadlineTouched: true })}
          />
        </Field>
        <Field label="Where" id={FIELD_IDS.where}>
          <Input
            id={FIELD_IDS.where}
            value={form.where}
            maxLength={80}
            placeholder="From East Hall"
            onChange={(e) => set({ where: e.target.value })}
          />
        </Field>
        <Field label="Time needed (min)" id="write-minutes">
          <Input
            id="write-minutes"
            type="number"
            inputMode="numeric"
            min={5}
            max={240}
            step={5}
            value={form.minutes}
            onChange={(e) =>
              set({ minutes: Math.min(240, Math.max(5, Number(e.target.value) || 5)) })
            }
          />
        </Field>
        <WhoToAsk helper={form.helper} onChange={(helper) => set({ helper })} pickInterests />
        <PriceField
          price={priceSuggestion}
          value={price}
          fits={form.helper.fits}
          fitsPaid={form.helper.fitsPaid}
          onChange={(value) => set({ price: value })}
        />
      </div>

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
          disabled={assisting || (!form.what.trim() && !form.details.trim())}
          onClick={getSuggestions}
        >
          {assisting ? "Thinking…" : "Get suggestions"}
        </Button>
      )}

      <div className="mt-auto flex flex-col gap-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button size="lg" className="h-12 text-base" disabled={submitting} onClick={submit}>
          {submitting ? "Checking…" : "Continue"}
        </Button>
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
    <section className="flex flex-col gap-3 rounded-2xl border border-dashed p-4">
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
