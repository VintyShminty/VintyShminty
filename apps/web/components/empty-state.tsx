import type { ReactNode } from "react";

/** The centred "nothing here" block used under the grids: a title, a note and an optional action. */
export function EmptyState({
  title,
  message,
  action,
  heading = false,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
  /** True when this is the main title of the page (a not found page), so it is the page's one heading. */
  heading?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-sm px-lg py-2xl text-center">
      {heading ? (
        <h1 className="text-heading font-semibold text-text-1">{title}</h1>
      ) : (
        <p className="text-heading font-semibold text-text-1">{title}</p>
      )}
      {message ? <p className="text-subtitle text-text-3">{message}</p> : null}
      {action}
    </div>
  );
}
