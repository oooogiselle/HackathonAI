import { PageTransition } from "@/components/ask/page-transition";

// The task page and its messages thread animate in like every other screen.
export default function TaskTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
