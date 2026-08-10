import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { consumeSessionExpiredFlag, getApiErrorDetail } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { EyeIcon, EyeOffIcon, InfoIcon } from "@/components/Icons";
import { useToast } from "@/components/ui/Toast";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sessionExpired] = useState(consumeSessionExpiredFlag);

  const validate = () => {
    const next: typeof errors = {};
    if (!identifier.trim()) next.identifier = "Please enter your username or email.";
    if (!password) next.password = "Please enter your password.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await login(identifier.trim(), password);
      toast.success("Welcome back!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setFormError(getApiErrorDetail(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
        Sign in to your workspace
      </h1>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
        Welcome back — let’s pick up where you left off.
      </p>

      {sessionExpired && (
        <div
          role="status"
          className="mt-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
        >
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Your session has expired. Please sign in again to continue.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        <Field label="Username or email" htmlFor="login-identifier" error={errors.identifier} required>
          <Input
            id="login-identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              if (errors.identifier) setErrors((prev) => ({ ...prev, identifier: undefined }));
            }}
            placeholder="you@example.com"
            invalid={!!errors.identifier}
            disabled={submitting}
          />
        </Field>

        <Field label="Password" htmlFor="login-password" error={errors.password} required>
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            placeholder="Enter your password"
            invalid={!!errors.password}
            disabled={submitting}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="rounded-md p-1 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            }
          />
        </Field>

        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
          >
            {formError}
          </div>
        )}

        <Button type="submit" fullWidth size="lg" loading={submitting} className="mt-2">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Don’t have an account?{" "}
        <Link
          to="/register"
          className="font-semibold text-brand-600 transition hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
