"use client";

// Holds one ask's state across the flow pages. Persisted to sessionStorage so
// a refresh mid-demo doesn't lose progress. TODO(db): move server-side.
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import type {
  AskPart,
  ClarifyAnswer,
  ClarifyQuestion,
  SafetyCategory,
  ScrubResult,
  WhereSuggestion,
} from "@/lib/ask/types";

export type AskFlowState = {
  // "ai": Home → Clarify → Your ask. "form": the student filled in /write.
  mode: "ai" | "form";
  need: string;
  category: SafetyCategory;
  questions?: ClarifyQuestion[];
  answers: ClarifyAnswer[];
  // Small asks the AI broke the need into; the student sends one at a time.
  parts: AskPart[];
  activePart: number;
  // Parts already sent (thank-you written); shown as done on Your ask.
  sentParts: number[];
  // The active part's text, used by Where / Share.
  ask: string;
  where?: WhereSuggestion & { category: SafetyCategory };
  groupId?: string;
  anonymous: boolean;
  name: string;
  scrub?: ScrubResult;
  token?: string;
};

const INITIAL: AskFlowState = {
  mode: "ai",
  need: "",
  category: "none",
  answers: [],
  parts: [],
  activePart: 0,
  sentParts: [],
  ask: "",
  anonymous: false,
  name: "",
};

const STORAGE_KEY = "ask-flow";

type FlowContext = {
  state: AskFlowState;
  /** False until sessionStorage has been read; pages wait for it before redirecting. */
  ready: boolean;
  update: (patch: Partial<AskFlowState>) => void;
  reset: (patch?: Partial<AskFlowState>) => void;
};

const Context = createContext<FlowContext | null>(null);

export function AskFlowProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AskFlowState>(INITIAL);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load from storage
      if (saved) setState({ ...INITIAL, ...JSON.parse(saved) });
    } catch {
      // Storage blocked or corrupt: start fresh.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore: the flow still works for this page view.
    }
  }, [state, ready]);

  const update = useCallback(
    (patch: Partial<AskFlowState>) => setState((s) => ({ ...s, ...patch })),
    [],
  );
  const reset = useCallback(
    (patch: Partial<AskFlowState> = {}) => setState({ ...INITIAL, ...patch }),
    [],
  );

  return <Context value={{ state, ready, update, reset }}>{children}</Context>;
}

export function useAskFlow() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useAskFlow must be used inside <AskFlowProvider>");
  return ctx;
}

/** Sends the user back to Home if they land mid-flow with no ask started. */
export function useRequireNeed() {
  const flow = useAskFlow();
  const router = useRouter();
  const missing = flow.ready && !flow.state.need;
  useEffect(() => {
    if (missing) router.replace("/");
  }, [missing, router]);
  return flow;
}
