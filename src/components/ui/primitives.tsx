import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/lib/cn";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "quiet" }) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-sm px-3 text-sm font-medium transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" && "bg-accent text-accent-fg hover:opacity-90",
        variant === "ghost" && "border border-line bg-raised text-fg hover:border-line-strong",
        variant === "quiet" && "text-muted hover:text-fg",
        variant === "danger" && "border border-danger/40 text-danger hover:bg-danger/10",
        className,
      )}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      suppressHydrationWarning
      className={cn(
        "h-10 w-full rounded-sm border border-line bg-bg px-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-line-strong",
        props.className,
      )}
    />
  );
}

export function Panel({ className, children }: PropsWithChildren<{ className?: string }>) {
  return <section className={cn("rounded-lg border border-line bg-surface", className)}>{children}</section>;
}

export function Label({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn("text-[11px] font-medium uppercase tracking-[0.14em] text-subtle", className)}>{children}</div>
  );
}
