import { PageTransition } from "@/components/ask/page-transition";

// Moves between top-level areas (board and flow, a task page, sign-in)
// animate too. Nested templates handle moves inside each area.
export default function RootTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
