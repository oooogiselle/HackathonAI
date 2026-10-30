export function MessagePreview({ groupName, message }: { groupName: string; message: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">Exactly what {groupName} will see</span>
      <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm whitespace-pre-wrap">
        {message}
      </div>
    </div>
  );
}
