"use client";

/**
 * Client-side form wrapper that asks for a confirm() before letting the
 * native form submit propagate. Server Actions cannot have `onSubmit` —
 * the React 19 form runtime swallows the event handler when `action` is
 * a server function unless the form lives in a client component.
 *
 * Use this whenever a destructive Server Action needs a confirmation
 * step. The Server Action is passed in via the `action` prop (Next 15+
 * accepts a server function passed as prop into a client component).
 */
import { ReactNode } from "react";

export function ConfirmForm({
  action,
  message,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
