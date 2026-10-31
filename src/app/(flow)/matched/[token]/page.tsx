// Old links: the asker's view of an ask now lives on the task page.
import { redirect } from "next/navigation";

export default async function MatchedRedirect({ params }: PageProps<"/matched/[token]">) {
  const { token } = await params;
  redirect(`/h/${encodeURIComponent(token)}`);
}
