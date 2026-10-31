import Image from "next/image";

// The DartAsk wordmark: logo + "Dart" in ink, "Ask" in the light brand green.
export function Brand({ place }: { place?: string }) {
  return (
    <span className="flex items-center gap-2">
      <Image src="/dartask-logo.png" alt="" width={26} height={26} className="rounded-md" />
      <span className="text-[17px] font-extrabold tracking-tight">
        Dart<span className="text-brand-light">Ask</span>
      </span>
      {place && <span className="text-[13px] font-semibold text-muted-foreground">· {place}</span>}
    </span>
  );
}
