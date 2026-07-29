'use client';

/**
 * A labelled text input.
 *
 * Small, but it is the one place accessibility is easy to get right once and
 * easy to get wrong everywhere. The version this replaces rendered:
 *
 *     <label className="...">{label}</label>
 *     <input type={type} value={value} ... />
 *     {error && <p className="text-red-500">{error}</p>}
 *
 * Three problems, all invisible to a sighted mouse user and all blocking for
 * anyone else:
 *
 * - The label was not associated with the input. No `htmlFor`, no `id`, so
 *   clicking the label did nothing and a screen reader announced the field as
 *   unlabelled.
 * - The error was not linked to the input, so it was never announced.
 * - The error was conveyed by colour alone.
 *
 * Fixed below with a generated id, `aria-describedby`, `aria-invalid`, and a
 * live region. None of it costs anything at runtime.
 */

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Validation message. Presence marks the field invalid. */
  error?: string | null;
  /** Persistent guidance shown below the input. */
  hint?: ReactNode;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, className = '', required, ...inputProps },
  ref,
) {
  // useId is stable across server and client render, so it does not cause a
  // hydration mismatch the way Math.random() or a module counter would.
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
        {required && (
          <>
            {/* The asterisk is decorative; the input's `required` attribute
                is what a screen reader announces. Hiding it here avoids
                "label star" being read out. */}
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </label>

      <input
        {...inputProps}
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={[
          'block w-full rounded-md border px-3 py-2 text-sm',
          // ring-offset-background, not a bare offset: the offset gap is
          // painted, so without a token it renders white and haloes the
          // input in dark mode.
          'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-background',
          error
            ? 'border-destructive focus:ring-destructive'
            : 'border-input focus:ring-ring',
          'bg-transparent',
          className,
        ].join(' ')}
      />

      {hint && (
        <p id={hintId} className="mt-1 text-xs opacity-70">
          {hint}
        </p>
      )}

      {error && (
        // role="alert" announces the message when it appears, rather than
        // only when the field is next focused.
        <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
});

export default Field;
