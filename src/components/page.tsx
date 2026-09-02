import type { PropsWithChildren } from "react";

export function PageHeader({ title, kicker, actions }: { title: string; kicker?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker && <div className="text-[11px] uppercase tracking-[0.16em] text-subtle">{kicker}</div>}
        <h1 className="text-xl font-medium tracking-tight">{title}</h1>
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-line px-4 py-10 text-center">
      <div className="text-sm font-medium">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
    </div>
  );
}

export function Page({ children }: PropsWithChildren) {
  return <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5">{children}</div>;
}
