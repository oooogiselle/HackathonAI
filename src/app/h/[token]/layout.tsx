// Mobile-first shell for the task page and Pay to hold.
export default function TaskLayout({ children }: LayoutProps<"/h/[token]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      {children}
    </main>
  );
}
