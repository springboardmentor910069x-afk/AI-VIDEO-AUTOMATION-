import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

const CONTROL_CLASS =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 " +
  "focus:outline-none focus:ring-2 focus:ring-brand-600/25 " +
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 " +
  "dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-800";

function borderClass(invalid?: boolean) {
  return invalid
    ? "border-red-400 focus:border-red-500 focus:ring-red-600/25 dark:border-red-500"
    : "border-slate-300 focus:border-brand-500 dark:border-slate-700 dark:focus:border-brand-500";
}

interface FieldProps {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  const autoId = useId();
  const fieldId = htmlFor ?? autoId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, leading, trailing, className, ...rest },
  ref,
) {
  return (
    <div className="relative">
      {leading && (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">
          {leading}
        </span>
      )}
      <input
        ref={ref}
        aria-invalid={invalid ? true : undefined}
        className={cn(
          CONTROL_CLASS,
          borderClass(invalid),
          leading && "pl-9",
          trailing && "pr-9",
          className,
        )}
        {...rest}
      />
      {trailing && (
        <span className="absolute inset-y-0 right-0 flex items-center pr-2.5">{trailing}</span>
      )}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid ? true : undefined}
      className={cn(CONTROL_CLASS, borderClass(invalid), className)}
      {...rest}
    />
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid ? true : undefined}
      className={cn(CONTROL_CLASS, borderClass(invalid), "pr-8", className)}
      {...rest}
    >
      {children}
    </select>
  );
});
