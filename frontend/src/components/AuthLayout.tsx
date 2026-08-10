import { Outlet } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { FilmIcon, MoonIcon, SunIcon } from "@/components/Icons";

const FEATURES = [
  {
    title: "Automatic transcription",
    description: "Whisper generates accurate transcripts the moment your video is processed.",
  },
  {
    title: "AI-powered summaries",
    description: "BART distills long transcripts into concise, shareable summaries.",
  },
  {
    title: "Everything in one place",
    description: "Upload, transcribe, and summarize videos from a single workspace.",
  },
];

export default function AuthLayout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="grid min-h-screen bg-slate-50 dark:bg-slate-950 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-950 lg:block">
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(60% 60% at 20% 10%, rgb(99 102 241 / 0.55), transparent 60%), radial-gradient(50% 50% at 90% 90%, rgb(56 189 248 / 0.25), transparent 60%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
              <FilmIcon className="h-6 w-6" />
            </span>
            <span className="text-lg font-bold tracking-tight">ClipMind AI</span>
          </div>

          <div className="max-w-md">
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-white">
              Turn raw video into insight, automatically.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Upload a video and let ClipMind transcribe, summarize, and organize it for you — no
              manual work required.
            </p>
            <ul className="mt-8 space-y-5">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="flex gap-3">
                  <span className="mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-500/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{feature.title}</p>
                    <p className="mt-0.5 text-sm text-slate-400">{feature.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-slate-500">© {new Date().getFullYear()} ClipMind AI</p>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 sm:px-10">
          <div className="flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <FilmIcon className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              ClipMind AI
            </span>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="ml-auto rounded-lg p-2 text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          </button>
        </div>
        <main className="flex flex-1 items-center justify-center px-6 pb-12 sm:px-10">
          <div className="w-full max-w-md animate-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
