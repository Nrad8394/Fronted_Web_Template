'use client';

/**
 * Create/edit form generated from a field config.
 *
 * Built on react-hook-form and zod rather than hand-rolled state, which is
 * what the source project did across 1,507 lines of form plus 246 of
 * validation — while both libraries were already in its `package.json`.
 *
 * That file's own header listed three bugs it had fixed:
 *
 *   1. inputs missing `name`/`autoComplete`
 *   2. clicks inside nested components bubbling into an accidental submit
 *   3. a `useMemo` keyed on the entire values object, so every field
 *      re-rendered whenever any field changed
 *
 * (1) and (3) cannot occur here: `register()` supplies the native attributes,
 * and react-hook-form is uncontrolled by default, so a keystroke in one input
 * does not re-render its siblings. (2) is prevented by giving every
 * non-submit button an explicit `type="button"` — still a live hazard, so it
 * is called out at each site below.
 *
 * Validation has two tiers. Pass a zod `schema` for real rules (cross-field
 * comparisons, refinements, transforms). Omit it and a minimal schema is
 * derived from `required` and `type`, which is enough for a simple form and
 * costs the consumer nothing.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Controller,
  useForm,
  type DefaultValues,
  type Resolver,
} from 'react-hook-form';
import { z, type ZodTypeAny } from 'zod';

import { normalizeError } from '@/lib/api/errors';
import type {
  BaseEntity,
  EntityConfig,
  FieldConfig,
  SelectOption,
} from '@/lib/entity/types';

interface EntityFormProps<T extends BaseEntity> {
  config: EntityConfig<T>;
  /** Existing record. Presence switches the form to edit mode. */
  initial?: Partial<T>;
  /** Zod schema. Strongly preferred over the derived fallback for real forms. */
  schema?: ZodTypeAny;
  onSubmit: (values: Partial<T>) => Promise<unknown>;
  onCancel?: () => void;
  submitLabel?: string;
}

/**
 * Build a schema from the field config when the caller supplies none.
 *
 * Deliberately shallow — presence and shape only. It exists so a three-field
 * form does not need a schema, not so you can skip writing one for a form
 * with real rules. Anything conditional, cross-field, or business-specific
 * belongs in a zod schema you pass in.
 */
function deriveSchema<T extends BaseEntity>(fields: FieldConfig<T>[]): ZodTypeAny {
  const shape: Record<string, ZodTypeAny> = {};

  for (const field of fields) {
    let rule: ZodTypeAny;

    switch (field.type) {
      case 'number':
      case 'currency':
        // `coerce` because every input reports a string, including
        // `type="number"`. Without it a numeric field always fails.
        rule = z.coerce.number({ message: `${field.label} must be a number.` });
        break;
      case 'email':
        rule = z.string().email(`Enter a valid email address.`);
        break;
      case 'checkbox':
        rule = z.boolean();
        break;
      default:
        rule = z.string();
    }

    if (field.required) {
      if (rule instanceof z.ZodString) {
        rule = rule.min(1, `${field.label} is required.`);
      }
    } else {
      // Optional fields must tolerate the empty string an untouched input
      // reports, not just `undefined`.
      rule = rule.or(z.literal('')).optional().nullable();
    }

    shape[String(field.key)] = rule;
  }

  return z.object(shape);
}

export function EntityForm<T extends BaseEntity>({
  config,
  initial,
  schema,
  onSubmit,
  onCancel,
  submitLabel,
}: EntityFormProps<T>) {
  const isEdit = Boolean(initial);

  // `editOnly` fields are omitted from the create form entirely. `createOnly`
  // fields stay visible when editing but are disabled below, so the value is
  // still shown rather than silently vanishing.
  const fields = useMemo(
    () => (config.fields ?? []).filter((field) => (isEdit ? true : !field.editOnly)),
    [config.fields, isEdit],
  );

  const resolver = useMemo(
    () => zodResolver(schema ?? deriveSchema(fields)) as Resolver<Partial<T>>,
    [schema, fields],
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Partial<T>>({
    resolver,
    defaultValues: initial as DefaultValues<Partial<T>>,
    // Validate on blur rather than on change: validating every keystroke
    // shows "invalid email" while someone is still typing the address, which
    // reads as the form arguing with you.
    mode: 'onBlur',
  });

  useEffect(() => {
    if (initial) reset(initial as DefaultValues<Partial<T>>);
  }, [initial, reset]);

  const [formError, setFormError] = useState<string | null>(null);
  const values = watch();

  const sections = useMemo(() => {
    const grouped = new Map<string, FieldConfig<T>[]>();
    for (const field of fields) {
      const key = field.section ?? '';
      const list = grouped.get(key) ?? [];
      list.push(field);
      grouped.set(key, list);
    }
    return Array.from(grouped.entries());
  }, [fields]);

  async function submit(formValues: Partial<T>) {
    setFormError(null);
    try {
      await onSubmit(formValues);
    } catch (error) {
      // The backend envelope's dotted field paths (`items.1.qty`) are already
      // react-hook-form's own path format, so they attach with no
      // translation. That is the payoff for flattening errors server-side —
      // see apps/core/exceptions.py.
      const normalized = normalizeError(error);

      for (const fieldError of normalized.fieldErrors) {
        if (fieldError.field) {
          setError(fieldError.field as never, { message: fieldError.message });
        }
      }

      const hasFieldError = normalized.fieldErrors.some((e) => e.field);
      if (!hasFieldError) setFormError(normalized.message);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-6">
      {formError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </div>
      )}

      {sections.map(([sectionName, sectionFields]) => (
        <fieldset key={sectionName} className="space-y-4">
          {sectionName && (
            <legend className="mb-2 text-sm font-semibold">{sectionName}</legend>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sectionFields.map((field) => {
              if (field.visibleWhen && !field.visibleWhen(values)) return null;

              return (
                <div
                  key={String(field.key)}
                  className={field.span === 1 ? 'sm:col-span-1' : 'sm:col-span-2'}
                >
                  <FormField
                    field={field}
                    control={control}
                    register={register}
                    error={
                      (errors as Record<string, { message?: string }>)[String(field.key)]
                        ?.message
                    }
                    disabled={Boolean(
                      isSubmitting || field.disabled || (isEdit && field.createOnly),
                    )}
                    values={values}
                  />
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {isSubmitting
            ? 'Saving…'
            : (submitLabel ?? (isEdit ? 'Save changes' : `Create ${config.name}`))}
        </button>

        {onCancel && (
          // type="button" is mandatory. A <button> inside a <form> defaults to
          // type="submit" — the source project's accidental-submit bug.
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-md border px-4 py-2 text-sm"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function FormField<T extends BaseEntity>({
  field,
  control,
  register,
  error,
  disabled,
  values,
}: {
  field: FieldConfig<T>;
  control: any;
  register: any;
  error?: string;
  disabled: boolean;
  values: Partial<T>;
}) {
  const name = String(field.key);
  const describedBy = [error ? `${name}-error` : null, field.help ? `${name}-help` : null]
    .filter(Boolean)
    .join(' ');

  const [asyncOptions, setAsyncOptions] = useState<SelectOption[] | null>(null);

  useEffect(() => {
    if (!field.loadOptions) return;
    let cancelled = false;
    field.loadOptions().then((options) => {
      if (!cancelled) setAsyncOptions(options);
    });
    return () => {
      cancelled = true;
    };
  }, [field]);

  const options = asyncOptions ?? field.options ?? [];

  const inputClass = [
    'block w-full rounded-md border bg-transparent px-3 py-2 text-sm',
    'focus:outline-none focus:ring-2 focus:ring-offset-1',
    error ? 'border-destructive focus:ring-destructive' : 'border-input',
  ].join(' ');

  const label = (
    <label htmlFor={name} className="mb-1 block text-sm font-medium">
      {field.label}
      {field.required && (
        <>
          <span aria-hidden="true" className="ml-0.5 text-destructive">
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      )}
    </label>
  );

  const messages = (
    <>
      {field.help && (
        <p id={`${name}-help`} className="mt-1 text-xs opacity-70">
          {field.help}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </>
  );

  // Custom fields go through Controller because they are not native inputs
  // and cannot be `register()`ed.
  if (field.type === 'custom' && field.render) {
    return (
      <div>
        {label}
        <Controller
          name={name}
          control={control}
          render={({ field: controlled }) => (
            <>
              {field.render!({
                value: controlled.value,
                onChange: controlled.onChange,
                onBlur: controlled.onBlur,
                error,
                disabled,
                values,
              })}
            </>
          )}
        />
        {messages}
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <div>
        <div className="flex items-center gap-2">
          <input
            id={name}
            type="checkbox"
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy || undefined}
            className="h-4 w-4"
            {...register(name)}
          />
          <label htmlFor={name} className="text-sm">
            {field.label}
          </label>
        </div>
        {messages}
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        {label}
        <textarea
          id={name}
          rows={4}
          placeholder={field.placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={inputClass}
          {...register(name)}
        />
        {messages}
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        {label}
        <select
          id={name}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={inputClass}
          {...register(name)}
        >
          <option value="">{field.placeholder ?? 'Select…'}</option>
          {options.map((option) => (
            <option key={String(option.value)} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {messages}
      </div>
    );
  }

  if (field.type === 'file') {
    return <FileField field={field} control={control} error={error} disabled={disabled} />;
  }

  const inputType =
    field.type === 'currency' || field.type === 'number'
      ? 'number'
      : field.type === 'datetime'
        ? 'datetime-local'
        : (field.type ?? 'text');

  return (
    <div>
      {label}
      <input
        id={name}
        type={inputType}
        placeholder={field.placeholder}
        disabled={disabled}
        step={field.type === 'currency' ? '0.01' : undefined}
        // register() supplies name + onChange + onBlur + ref; the browser
        // infers autocomplete from the name and type. This is what the
        // hand-rolled version had to patch in manually.
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={inputClass}
        {...register(name)}
      />
      {messages}
    </div>
  );
}

/**
 * File input.
 *
 * Not a plain `register()` call, for three reasons:
 *
 * 1. **A file input reports a `FileList`, not a `File`.** Registering it
 *    directly puts a `FileList` in the form values, and `FileList` has no
 *    array methods, does not survive a spread, and is not what any API
 *    expects. This unwraps to a single `File` (or an array when `multiple`).
 * 2. **Uncontrolled file inputs cannot be reset.** Assigning to
 *    `input.value` is forbidden for security, so clearing a selection needs
 *    the ref, which `Controller` gives us.
 * 3. **Existing values are URLs, not files.** Editing a record whose
 *    `avatar` is `"https://…/a.png"` must show the current image, not an
 *    empty picker — otherwise saving the form silently clears it.
 *
 * The selected value flows into `maybeFormData` (lib/api/form-data.ts),
 * which switches the request to multipart automatically.
 */
function FileField<T extends BaseEntity>({
  field,
  control,
  error,
  disabled,
}: {
  field: FieldConfig<T>;
  // `control` is RHF's opaque form controller; it has no useful public type
  // that survives being passed through a generic component boundary.
  control: any;
  error?: string;
  disabled: boolean;
}) {
  const name = String(field.key);
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {field.label}
        {field.required && (
          <>
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </label>

      <Controller
        name={name}
        control={control}
        render={({ field: controlled }) => {
          const value = controlled.value;
          const isExistingUrl = typeof value === 'string' && value !== '';
          const selectedFile = value instanceof File ? value : null;

          return (
            <div className="space-y-2">
              {(isExistingUrl || selectedFile) && (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      selectedFile ? URL.createObjectURL(selectedFile) : String(value)
                    }
                    alt=""
                    className="h-16 w-16 rounded border object-cover"
                  />
                  <div className="text-xs">
                    <p className="opacity-70">
                      {selectedFile ? selectedFile.name : 'Current file'}
                    </p>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        controlled.onChange(null);
                        // The DOM input keeps its own selection independently
                        // of form state; without this the picker still shows
                        // the old filename after "Remove".
                        if (inputRef.current) inputRef.current.value = '';
                      }}
                      className="mt-0.5 underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              <input
                id={name}
                type="file"
                disabled={disabled}
                aria-invalid={error ? true : undefined}
                aria-describedby={
                  [error ? `${name}-error` : null, field.help ? `${name}-help` : null]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                ref={(node) => {
                  inputRef.current = node;
                  controlled.ref(node);
                }}
                onBlur={controlled.onBlur}
                onChange={(event) => {
                  // Unwrap FileList -> File. See note 1.
                  const files = event.target.files;
                  controlled.onChange(files && files.length > 0 ? files[0] : null);
                }}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-transparent file:px-3 file:py-1.5 file:text-sm"
              />
            </div>
          );
        }}
      />

      {field.help && (
        <p id={`${name}-help`} className="mt-1 text-xs opacity-70">
          {field.help}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
