"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

// Chrome's install prompt event (not in the DOM typings yet).
type InstallPromptEvent = Event & { prompt: () => Promise<void> };

const DISMISSED_KEY = "dartask:install-hint-dismissed";

type Mode = "hidden" | "ios" | "other";

function readMode(): Mode {
  try {
    if (localStorage.getItem(DISMISSED_KEY)) return "hidden";
  } catch {
    // Storage blocked (private mode): just show the hint.
  }
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (installed) return "hidden";
  // iPhone and iPad Safari have no install prompt; people add it from Share.
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "other";
}

const noSubscribe = () => () => {};

// On the Me tab: how to put DartAsk on your home screen. Hidden once it's
// installed or dismissed. Chrome's own prompt opens only on a tap.
export function InstallHint() {
  const initial = useSyncExternalStore(noSubscribe, readMode, () => "hidden" as Mode);
  const [dismissed, setDismissed] = useState(false);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    }
    function onInstalled() {
      setPrompt(null);
      setDismissed(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Other browsers show the hint only when they offer an install prompt.
  if (dismissed || initial === "hidden" || (initial === "other" && !prompt)) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Not saved; it comes back next visit.
    }
  }

  return (
    <section
      aria-label="Add DartAsk to your home screen"
      className="relative flex flex-col gap-2 rounded-3xl bg-secondary p-4 pr-12 text-secondary-foreground"
    >
      <p className="text-[15px] font-bold">Keep DartAsk on your home screen</p>
      {initial === "ios" ? (
        <p className="text-sm">
          In Safari, tap Share, then Add to Home Screen. It opens like an app, and you sign in
          once more there.
        </p>
      ) : (
        <>
          <p className="text-sm">It opens like an app, without the browser bars.</p>
          <Button
            size="sm"
            className="w-fit"
            onClick={async () => {
              await prompt?.prompt();
              setPrompt(null);
            }}
          >
            Add to home screen
          </Button>
        </>
      )}
      <button
        type="button"
        aria-label="Hide this"
        onClick={dismiss}
        className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-full hover:bg-background/60"
      >
        <X aria-hidden className="size-4" />
      </button>
    </section>
  );
}
