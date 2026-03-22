export default function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-card border border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{name} is typing</span>
          <div className="flex gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
