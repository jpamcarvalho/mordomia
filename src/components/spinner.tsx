// Decorative accent spinner (AC-2). Size via className (default size-8).
export function Spinner({ className = "size-8" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-accent/20 border-t-accent ${className}`}
    />
  );
}
