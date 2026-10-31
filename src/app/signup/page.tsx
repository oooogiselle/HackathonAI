// Create account, then Verify school and phone (step 2 of 2). Mocked tonight:
// no codes are sent and any 6 digits work; the password and phone never leave
// the browser. The account itself is the mocked sign-in (username + school
// email). TODO(auth): real school-email and phone verification.
import { Brand } from "@/components/ask/brand";
import { safeNext } from "@/lib/safe-next";

import { SignUpFlow } from "./sign-up-flow";

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <Brand />
      <SignUpFlow next={safeNext(next)} />
    </main>
  );
}
