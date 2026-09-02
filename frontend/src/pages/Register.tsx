import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getApiErrorDetail, registerUser } from "@/api/client";
import { PUBLIC_REGISTRATION_ROLES, type PublicRegistrationRole } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { EyeIcon, EyeOffIcon } from "@/components/Icons";
import { useToast } from "@/components/ui/Toast";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const navigate = useNavigate();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<PublicRegistrationRole>("learner");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    username?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const validate = () => {
    const next: typeof errors = {};
    if (!email.trim()) {
      next.email = "Please enter your email address.";
    } else if (!EMAIL_RE.test(email.trim())) {
      next.email = "Please enter a valid email address.";
    }
    if (!username.trim()) {
      next.username = "Please choose a username.";
    } else if (username.trim().length < 3) {
      next.username = "Username must be at least 3 characters.";
    }
    if (!password) {
      next.password = "Please choose a password.";
    } else if (password.length < 8) {
      next.password = "Password must be at least 8 characters.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await registerUser({
        email: email.trim(),
        username: username.trim(),
        full_name: fullName.trim() || undefined,
        password,
        role,
      });
      toast.success("Account created. Sign in to continue.");
      navigate("/login", { replace: true });
    } catch (err) {
      setFormError(getApiErrorDetail(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
        Create your account
      </h1>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
        Start transcribing and summarizing videos in minutes.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        <Field label="Email" htmlFor="register-email" error={errors.email} required>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            placeholder="you@example.com"
            invalid={!!errors.email}
            disabled={submitting}
          />
        </Field>

        <Field label="Username" htmlFor="register-username" error={errors.username} required>
          <Input
            id="register-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
            }}
            placeholder="janedoe"
            invalid={!!errors.username}
            disabled={submitting}
          />
        </Field>

        <Field label="Full name" htmlFor="register-full-name" hint="Optional">
          <Input
            id="register-full-name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Jane Doe"
            disabled={submitting}
          />
        </Field>

        <Field label="I am a…" htmlFor="register-role" required>
          <Select
            id="register-role"
            value={role}
            onChange={(event) => setRole(event.target.value as PublicRegistrationRole)}
            disabled={submitting}
          >
            {PUBLIC_REGISTRATION_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Password" htmlFor="register-password" error={errors.password} required>
          <Input
            id="register-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            placeholder="At least 8 characters"
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
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-semibold text-brand-600 transition hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
