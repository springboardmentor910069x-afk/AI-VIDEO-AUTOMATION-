"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bookmark,
  Bot,
  Download,
  FileText,
  GraduationCap,
  History,
  Link,
  LogOut,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Share2,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  Video as VideoIcon,
  X
} from "lucide-react";
import { AdminMetrics, api, Role, TutorMessage, User, Video } from "@/lib/api";
import { Button } from "@/components/Button";

type Detail = {
  transcript?: { full_text: string; segments: { start: number; end: number; text: string }[] };
  summary?: { short_summary: string; detailed_summary: string };
  moments?: { timestamp: number; title: string; importance_score: number }[];
  analytics?: { watch_time: number; engagement_score: number; topics: string[]; sentiment: string };
};

const roles: Role[] = ["creator", "learner", "educator", "admin"];
type SummaryLanguage = "english" | "hindi" | "hinglish";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/[\\/:*?"<>|]+/g, "-");
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<Detail>({});
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"summary" | "transcript" | "moments" | "analytics">("summary");
  const [summaryView, setSummaryView] = useState<"brief" | "detailed">("detailed");
  const [summaryLanguage, setSummaryLanguage] = useState<SummaryLanguage>("english");
  const [translatedSummary, setTranslatedSummary] = useState<Detail["summary"]>();
  const [translatingSummary, setTranslatingSummary] = useState(false);
  const [fileName, setFileName] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [adminMetrics, setAdminMetrics] = useState<AdminMetrics | null>(null);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  const [tutorInput, setTutorInput] = useState("");
  const [tutorBusy, setTutorBusy] = useState(false);
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([
    {
      role: "assistant",
      content: "Hey! Main AI Tutor hoon. Tum mujhse is video ke baare me Hindi, English, Hinglish ya mixed language me kuch bhi pooch sakte ho."
    }
  ]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("clipmind_token");
    if (stored) {
      setToken(stored);
      api.me(stored).then(setUser).catch(() => localStorage.removeItem("clipmind_token"));
      api.videos(stored).then(setVideos).catch(() => null);
    }
    setBookmarks(JSON.parse(localStorage.getItem("clipmind_bookmarks") ?? "[]"));
  }, []);

  const activeVideo = useMemo(() => videos.find((video) => video.id === selected) ?? videos[0], [selected, videos]);
  const isProcessing = Boolean(activeVideo && ["queued", "processing", "uploaded"].includes(activeVideo.status));

  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(() => {
      api.videos(token).then(setVideos).catch(() => null);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [token]);

  useEffect(() => {
    if (!token || !activeVideo || activeVideo.status !== "completed") {
      setDetail({});
      return;
    }
    Promise.allSettled([
      api.transcript(token, activeVideo.id),
      api.summary(token, activeVideo.id),
      api.moments(token, activeVideo.id),
      api.analytics(token, activeVideo.id)
    ]).then(([transcript, summary, moments, analytics]) => {
      setDetail({
        transcript: transcript.status === "fulfilled" ? transcript.value : undefined,
        summary: summary.status === "fulfilled" ? summary.value : undefined,
        moments: moments.status === "fulfilled" ? moments.value : [],
        analytics: analytics.status === "fulfilled" ? analytics.value : undefined
      });
      setTranslatedSummary(undefined);
      setSummaryLanguage("english");
    });
  }, [activeVideo?.id, activeVideo?.status, token]);

  async function handleSummaryLanguage(language: SummaryLanguage) {
    setSummaryLanguage(language);
    if (!token || !activeVideo) {
      return;
    }
    setTranslatingSummary(true);
    setMessage("");
    try {
      const translated = await api.translateSummary(token, activeVideo.id, language);
      setTranslatedSummary(translated);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Summary translation failed");
    } finally {
      setTranslatingSummary(false);
    }
  }

  useEffect(() => {
    if (!token || !activeVideo || activeVideo.status !== "completed" || !detail.summary) return;
    handleSummaryLanguage(summaryLanguage);
  }, [activeVideo?.id, detail.summary?.short_summary]);

  useEffect(() => {
    if (!token || user?.role !== "admin") return;
    Promise.allSettled([api.adminMetrics(token), api.adminUsers(token)]).then(([metrics, users]) => {
      if (metrics.status === "fulfilled") setAdminMetrics(metrics.value);
      if (users.status === "fulfilled") setAdminUsers(users.value);
    });
  }, [token, user?.role, videos.length]);

  async function handleAuth(formData: FormData) {
    setBusy(true);
    setMessage("");
    try {
      const password = String(formData.get("password"));
      if (password.length > 128) {
        setMessage("Password 128 characters se chhota rakho. Simple password try karo: password123");
        return;
      }
      if (mode === "register") {
        await api.register({
          name: String(formData.get("name")),
          email: String(formData.get("email")),
          password,
          role: String(formData.get("role")) as Role
        });
      }
      const session = await api.login({ email: String(formData.get("email")), password });
      localStorage.setItem("clipmind_token", session.access_token);
      setToken(session.access_token);
      const profile = await api.me(session.access_token);
      setUser(profile);
      setVideos(await api.videos(session.access_token));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(formData: FormData) {
    if (!token) return;
    setBusy(true);
    setMessage("");
    try {
      const uploadedFile = formData.get("file");
      const hasFile = uploadedFile instanceof File && uploadedFile.name.length > 0 && uploadedFile.size > 0;
      const cleanVideoLink = String(formData.get("video_url") ?? "").trim();
      if (!hasFile) formData.delete("file");
      if (cleanVideoLink) formData.set("video_url", cleanVideoLink);
      if (hasFile && cleanVideoLink) {
        setMessage("File ya video link me se ek hi choose karo.");
        return;
      }
      if (!hasFile && !cleanVideoLink) {
        setMessage("Video file upload karo ya video link paste karo.");
        return;
      }
      const uploaded = await api.upload(token, formData);
      const nextVideos = await api.videos(token);
      setVideos(nextVideos);
      setSelected(uploaded.id);
      setTab("summary");
      setMessage("Video queued. ClipMind is listening, scanning, and building your summary.");
      setFileName("");
      setVideoLink("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleReprocess(video: Video) {
    if (!token) return;
    setBusy(true);
    setMessage("");
    try {
      await api.reprocess(token, video.id);
      setVideos(await api.videos(token));
      setSelected(video.id);
      setMessage("Reprocessing queued with the latest video analyzer.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reprocess failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteVideo(video: Video) {
    if (!token) return;
    setBusy(true);
    setMessage("");
    try {
      await api.deleteVideo(token, video.id);
      const nextVideos = await api.videos(token);
      setVideos(nextVideos);
      setSelected(nextVideos[0]?.id ?? "");
      setMessage("Video deleted from the workspace.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(format: "txt" | "pdf") {
    if (!token || !activeVideo) return;
    setBusy(true);
    setMessage("");
    try {
      if (format === "txt") {
        const text = await api.exportTxt(token, activeVideo.id);
        downloadBlob(new Blob([text], { type: "text/plain" }), `${activeVideo.title || "clipmind"}-summary.txt`);
      } else {
        const blob = await api.exportPdf(token, activeVideo.id);
        downloadBlob(blob, `${activeVideo.title || "clipmind"}-summary.pdf`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(userId: string, role: Role) {
    if (!token) return;
    try {
      const updated = await api.updateUserRole(token, userId, role);
      setAdminUsers((current) => current.map((item) => (item.id === userId ? updated : item)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Role update failed");
    }
  }

  function toggleBookmark(videoId: string) {
    setBookmarks((current) => {
      const next = current.includes(videoId) ? current.filter((id) => id !== videoId) : [...current, videoId];
      localStorage.setItem("clipmind_bookmarks", JSON.stringify(next));
      return next;
    });
  }

  async function handleTutorSend() {
    if (!token || !activeVideo) {
      setTutorMessages((current) => [
        ...current,
        { role: "assistant", content: "Pehle koi completed video select karo, phir main uske basis par answer dunga." }
      ]);
      return;
    }
    const question = tutorInput.trim();
    if (!question) return;

    const nextMessages: TutorMessage[] = [...tutorMessages, { role: "user", content: question }];
    setTutorMessages(nextMessages);
    setTutorInput("");
    setTutorBusy(true);
    try {
      const reply = await api.tutor(token, activeVideo.id, {
        question,
        chat_history: nextMessages.slice(-8)
      });
      setTutorMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `${reply.answer}\n\nSource: ${reply.citations.join(", ") || "video context"}`
        }
      ]);
    } catch (error) {
      setTutorMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Tutor reply nahi aa paaya."
        }
      ]);
    } finally {
      setTutorBusy(false);
    }
  }

  if (!mounted) return <Shell><HeroSkeleton /></Shell>;

  if (!user) {
    return (
      <Shell>
        <main className="landing-stage min-h-screen text-[#f6fff7]">
            <section className="relative min-h-screen overflow-hidden px-5 py-6 sm:px-8 lg:px-12">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(74,173,141,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(74,173,141,0.09)_1px,transparent_1px)] bg-[size:34px_34px]" />
              <div className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full border border-[#8ff0c7]/35" />
              <div className="pointer-events-none absolute left-[32%] top-[23%] h-px w-[34rem] bg-[#8ff0c7]/40" />
              <div className="relative z-10">
                <nav className="flex items-center justify-between">
                  <Brand light />
                </nav>

                <div className="landing-marquee -mx-12 mt-10 border-y border-[#8ff0c7]/25 py-3">
                  <div className="landing-marquee-track">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <span key={index}>CLIPMIND AI</span>
                    ))}
                  </div>
                </div>

                <div className="grid min-h-[calc(100vh-220px)] items-center gap-12 py-14 lg:grid-cols-[1.08fr_0.92fr]">
                  <div>
                    <p className="font-mono text-sm font-bold uppercase tracking-[0.36em] text-[#8ff0c7]">Video intelligence system</p>
                    <h1 className="landing-headline mt-8 max-w-5xl text-[clamp(4rem,10vw,9.6rem)] font-black uppercase leading-[0.92]">
                      <span className="block">Turn Videos</span>
                      <span className="block">Into Summary</span>
                    </h1>
                    <p className="mt-8 max-w-xl font-mono text-sm leading-7 text-white/78">
                      ClipMind listens to your videos, creates accurate transcripts, extracts key moments, generates structured summaries, and lets you question the content with an AI tutor.
                    </p>
                    <div className="mt-10 grid max-w-2xl gap-4 sm:grid-cols-3">
                      <LandingStat value="01" label="Upload any lesson, meeting, lecture or clip." />
                      <LandingStat value="02" label="Get transcript, takeaways and timestamps." />
                      <LandingStat value="03" label="Ask the AI tutor what matters most." />
                    </div>
                  </div>

                  <div className="relative min-h-[620px]">
                    <div className="landing-visual landing-visual-main absolute right-0 top-8 h-[420px] w-[76%] overflow-hidden border border-[#8ff0c7]/30 bg-[#dff8ea]">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgba(255,255,255,0.9),transparent_18%),radial-gradient(circle_at_65%_38%,rgba(31,81,73,0.85),transparent_26%),linear-gradient(135deg,#effff5,#4ab58e_54%,#102523)] grayscale-[0.25]" />
                      <div className="absolute inset-x-8 bottom-8 space-y-3 font-mono text-[#102523]">
                        <div className="h-3 w-3/4 bg-[#102523]/80" />
                        <div className="h-3 w-1/2 bg-[#102523]/55" />
                        <div className="mt-7 grid grid-cols-3 gap-2">
                          <span className="h-12 border border-[#102523]/30" />
                          <span className="h-12 border border-[#102523]/30" />
                          <span className="h-12 border border-[#102523]/30" />
                        </div>
                      </div>
                    </div>
                    <div className="landing-visual absolute left-0 top-60 h-[260px] w-[58%] overflow-hidden border border-[#8ff0c7]/30 bg-[#f7fff8]">
                      <div className="absolute inset-0 bg-[linear-gradient(140deg,#f7fff8_0%,#9fe7c8_45%,#163431_100%)]" />
                      <div className="absolute left-8 top-8">
                        <Brand />
                      </div>
                      <div className="absolute bottom-7 left-8 right-8 font-mono text-xs uppercase tracking-[0.2em] text-[#132b29]">Transcript / Summary / Tutor</div>
                    </div>
                    <form action={handleAuth} className="absolute bottom-0 right-4 w-full max-w-[430px] border border-[#8ff0c7]/55 bg-[#071312]/95 p-5 shadow-2xl shadow-black/40 backdrop-blur">
                      <div className="mb-5 grid grid-cols-2 border border-[#8ff0c7]/25">
                        {(["login", "register"] as const).map((item) => (
                          <button key={item} type="button" onClick={() => setMode(item)} className={`h-12 font-mono text-xs font-black uppercase tracking-[0.2em] ${mode === item ? "bg-[#f7fff8] text-[#132b29]" : "bg-[#163431] text-[#d8fff0]"}`}>
                            {item}
                          </button>
                        ))}
                      </div>
                      {mode === "register" ? <LandingField name="name" placeholder="Name" /> : null}
                      <LandingField name="email" placeholder="Email" type="email" />
                      <LandingField name="password" placeholder="Password" type="password" minLength={8} maxLength={128} />
                      {mode === "register" ? (
                        <select name="role" className="mb-3 h-12 w-full border border-[#8ff0c7]/45 bg-[#102523] px-4 font-mono text-sm font-semibold text-[#f7fff8] outline-none focus:border-[#8ff0c7]">
                          {roles.map((role) => <option key={role}>{role}</option>)}
                        </select>
                      ) : null}
                      <button className="h-12 w-full border border-[#8ff0c7] bg-[#f7fff8] font-mono text-xs font-black uppercase tracking-[0.2em] text-[#132b29] transition hover:bg-[#8ff0c7]">
                        {busy ? "Working..." : mode === "login" ? "Enter dashboard" : "Create workspace"}
                      </button>
                      {message ? <p className="mt-4 font-mono text-xs leading-5 text-[#ff8f8f]">{message}</p> : null}
                    </form>
                  </div>
                </div>

                <div className="grid gap-6 border-t border-[#8ff0c7]/20 py-10 md:grid-cols-3">
                  <LandingInfo title="AI Transcript" copy="Groq Whisper converts speech into searchable, time-aligned text." />
                  <LandingInfo title="Key Moments" copy="Important clips are scored and surfaced with timestamps." />
                  <LandingInfo title="Smart Summary" copy="Every video gets structured context, takeaways, keywords and actions." />
                </div>
              </div>
            </section>
          <LandingFooter />
        </main>
      </Shell>
    );
  }

  return (
    <Shell>
      <main className="dashboard-stage min-h-screen">
        <header className="relative z-10 border-b border-[#8ff0c7]/20 bg-[#08201d]/72 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
            <div>
              <Brand light />
              <p className="mt-1 font-mono text-sm text-[#a7d9cb]">{user.name} / {user.role}</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#8ff0c7]/30 bg-[#0d302b]/70 px-4 text-sm font-bold text-[#f5fff7] backdrop-blur transition hover:border-[#8ff0c7] hover:bg-[#0fa071]" onClick={() => { localStorage.removeItem("clipmind_token"); location.reload(); }}>
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          </div>
        </header>

        <section className="relative z-10 mx-auto max-w-7xl px-5 py-8">
          <RolePortal
            user={user}
            videos={videos}
            activeVideo={activeVideo}
            detail={detail}
            bookmarks={bookmarks}
            adminMetrics={adminMetrics}
            adminUsers={adminUsers}
            busy={busy}
            onDownload={handleDownload}
            onBookmark={toggleBookmark}
            onDelete={handleDeleteVideo}
            onReprocess={handleReprocess}
            onRoleChange={handleRoleChange}
            onSelectTab={setTab}
            onOpenTutor={() => setIsTutorOpen(true)}
          />

          <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
            <aside className="space-y-6">
              {user.role !== "learner" ? (
                <form action={handleUpload} className="glass-panel rounded-[22px] p-6">
                  <p className="mb-5 flex items-center gap-2 text-xl font-black text-[#f5fff7]"><Upload className="h-5 w-5 text-[#0fd196]" /> Upload video</p>
                  <input name="title" placeholder="Video title" className="mb-4 h-13 w-full rounded-lg border border-[#8ff0c7]/25 bg-[#071a17]/58 px-4 py-4 text-[#f5fff7] outline-none placeholder:text-[#a7d9cb] focus:border-[#8ff0c7]" required />
                  <button type="button" onClick={() => fileRef.current?.click()} className="group mb-4 flex min-h-44 w-full flex-col items-center justify-center rounded-[18px] border-2 border-dashed border-[#0fa071]/60 bg-[#09312a]/40 text-center transition hover:border-[#8ff0c7] hover:bg-[#0e4a3e]/55">
                    <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#0fa071]/40 text-[#c9ffed] transition group-hover:scale-105 group-hover:bg-[#0fa071]">
                      <Upload className="h-8 w-8" />
                    </span>
                    <span className="mt-4 text-lg font-bold text-[#f5fff7]">Drag & drop your video or browse</span>
                    <span className="mt-2 text-sm font-semibold text-[#93caba]">MP4, WEBM, MOV, MKV</span>
                    {fileName ? <span className="mt-3 rounded-full bg-[#eafff4] px-3 py-1 text-sm font-bold text-[#08201d]">{fileName}</span> : null}
                  </button>
                  <input ref={fileRef} name="file" type="file" accept="video/*" className="hidden" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")} />
                  <div className="mb-4 flex items-center gap-3">
                    <span className="h-px flex-1 bg-[#8ff0c7]/20" />
                    <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#93caba]">or paste link</span>
                    <span className="h-px flex-1 bg-[#8ff0c7]/20" />
                  </div>
                  <label className="mb-4 flex min-h-13 items-center gap-3 rounded-lg border border-[#8ff0c7]/25 bg-[#071a17]/58 px-4 text-[#f5fff7] transition focus-within:border-[#8ff0c7]">
                    <Link className="h-5 w-5 shrink-0 text-[#0fd196]" />
                    <input
                      name="video_url"
                      type="url"
                      value={videoLink}
                      onChange={(event) => setVideoLink(event.target.value)}
                      placeholder="Paste YouTube or direct video link"
                      className="min-w-0 flex-1 bg-transparent py-4 outline-none placeholder:text-[#a7d9cb]"
                    />
                  </label>
                  <Button busy={busy} className="h-13 w-full bg-[#10233c] text-white hover:bg-[#0fa071]">Generate Summary</Button>
                  {message ? <p className="mt-4 text-sm font-medium leading-6 text-[#b9e7dc]">{message}</p> : null}
                </form>
              ) : null}

              <Panel>
                <p className="mb-4 flex items-center gap-2 text-xl font-black text-[#f5fff7]"><VideoIcon className="h-5 w-5 text-[#0fd196]" /> Library</p>
                <div className="space-y-3">
                  {videos.map((video) => (
                    <button key={video.id} onClick={() => setSelected(video.id)} className={`w-full rounded-xl border px-4 py-3 text-left transition hover:-translate-y-0.5 ${activeVideo?.id === video.id ? "border-[#13e3a4] bg-[#003f31]/82 text-[#f5fff7]" : "border-[#8ff0c7]/25 bg-[#071a17]/48 text-[#dff8ea] hover:border-[#8ff0c7]/55"}`}>
                      <span className="block font-bold">{video.title}</span>
                      <span className="mt-1 block text-sm text-[#99d5c5]">{video.status} / {Math.round(video.duration)}s</span>
                    </button>
                  ))}
                  {!videos.length ? <p className="text-sm text-[#99d5c5]">Upload a video to start.</p> : null}
                </div>
              </Panel>
            </aside>

            <section className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Metric label="Videos" value={String(videos.length)} icon={VideoIcon} />
                <Metric label="Watch Time" value={`${Math.round(detail.analytics?.watch_time ?? activeVideo?.duration ?? 0)}s`} icon={VideoIcon} />
                <Metric label="Engagement" value={`${detail.analytics?.engagement_score ?? (isProcessing ? 42 : 0)}%`} icon={BarChart3} />
                <Metric label="Topics" value={detail.analytics?.topics?.[0] ?? "Ready"} icon={Sparkles} />
              </div>

              {!activeVideo ? <EmptyState /> : isProcessing ? <ProcessingCard title={activeVideo.title} /> : (
                <Results
                  activeVideo={activeVideo}
                  detail={detail}
                  tab={tab}
                  setTab={setTab}
                  summaryView={summaryView}
                  setSummaryView={setSummaryView}
                  summaryLanguage={summaryLanguage}
                  setSummaryLanguage={handleSummaryLanguage}
                  displayedSummary={translatedSummary ?? detail.summary}
                  translatingSummary={translatingSummary}
                  onReprocess={handleReprocess}
                  onDownload={handleDownload}
                  transcriptSearch={transcriptSearch}
                  setTranscriptSearch={setTranscriptSearch}
                  busy={busy}
                  isBookmarked={bookmarks.includes(activeVideo.id)}
                  onBookmark={toggleBookmark}
                />
              )}
            </section>
          </div>
        </section>

        <button
          type="button"
          onClick={() => setIsTutorOpen(true)}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-3 rounded-full bg-[#0fa071] px-5 py-4 text-sm font-black text-white shadow-2xl shadow-[#0fa071]/35 transition hover:-translate-y-1 hover:bg-[#13c891]"
        >
          <MessageCircle className="h-5 w-5" />
          AI Tutor
        </button>

        {isTutorOpen ? (
          <TutorPopup
            title={activeVideo?.title}
            messages={tutorMessages}
            value={tutorInput}
            busy={tutorBusy}
            setValue={setTutorInput}
            onSend={handleTutorSend}
            onClose={() => setIsTutorOpen(false)}
          />
        ) : null}
      </main>
    </Shell>
  );
}

function RolePortal({
  user,
  videos,
  activeVideo,
  detail,
  bookmarks,
  adminMetrics,
  adminUsers,
  busy,
  onDownload,
  onBookmark,
  onDelete,
  onReprocess,
  onRoleChange,
  onSelectTab,
  onOpenTutor
}: {
  user: User;
  videos: Video[];
  activeVideo?: Video;
  detail: Detail;
  bookmarks: string[];
  adminMetrics: AdminMetrics | null;
  adminUsers: User[];
  busy: boolean;
  onDownload: (format: "txt" | "pdf") => void;
  onBookmark: (videoId: string) => void;
  onDelete: (video: Video) => void;
  onReprocess: (video: Video) => void;
  onRoleChange: (userId: string, role: Role) => void;
  onSelectTab: (value: "summary" | "transcript" | "moments" | "analytics") => void;
  onOpenTutor: () => void;
}) {
  const completedVideos = videos.filter((video) => video.status === "completed");
  const processingVideos = videos.filter((video) => ["queued", "processing", "uploaded"].includes(video.status));

  if (user.role === "creator") {
    return (
      <PortalShell
        eyebrow="Content Creator Portal"
        title="Create, manage, and ship audience-ready summaries."
        copy="Upload videos, regenerate AI outputs, export transcripts, review analytics, and keep your content history organized."
        icon={VideoIcon}
      >
        <PortalAction icon={Download} title="Download Pack" copy="Export transcript and summary for your audience." disabled={!activeVideo || activeVideo.status !== "completed"} onClick={() => onDownload("txt")} />
        <PortalAction icon={RefreshCw} title="Regenerate AI" copy="Run the latest transcript and summary pipeline again." disabled={!activeVideo || busy} onClick={() => activeVideo && onReprocess(activeVideo)} />
        <PortalAction icon={Trash2} title="Manage Content" copy="Remove old uploads from your workspace." disabled={!activeVideo || busy} onClick={() => activeVideo && onDelete(activeVideo)} />
        <PortalMini label="Completed" value={String(completedVideos.length)} />
        <PortalMini label="Processing" value={String(processingVideos.length)} />
        <PortalMini label="Bookmarks" value={String(bookmarks.length)} />
      </PortalShell>
    );
  }

  if (user.role === "learner") {
    return (
      <PortalShell
        eyebrow="Learner Portal"
        title="Study faster with summaries, transcripts, highlights, and tutor help."
        copy="Open uploaded videos, search inside transcripts, bookmark useful summaries, and keep your learning history in one place."
        icon={GraduationCap}
      >
        <PortalAction icon={Search} title="Search Transcript" copy="Open transcript search for the selected video." disabled={!activeVideo} onClick={() => onSelectTab("transcript")} />
        <PortalAction icon={Bookmark} title={activeVideo && bookmarks.includes(activeVideo.id) ? "Saved" : "Bookmark"} copy="Save this video summary and highlights." disabled={!activeVideo} onClick={() => activeVideo && onBookmark(activeVideo.id)} />
        <PortalAction icon={Bot} title="Ask AI Tutor" copy="Question the selected video in simple language." disabled={!activeVideo} onClick={onOpenTutor} />
        <PortalMini label="History" value={String(videos.length)} />
        <PortalMini label="Saved" value={String(bookmarks.length)} />
        <PortalMini label="Moments" value={String(detail.moments?.length ?? 0)} />
      </PortalShell>
    );
  }

  if (user.role === "educator") {
    return (
      <PortalShell
        eyebrow="Educator Portal"
        title="Turn lectures into concise learning resources."
        copy="Upload lecture videos, create summaries for students, review transcripts, share exports, and monitor engagement."
        icon={GraduationCap}
      >
        <PortalAction icon={Download} title="Share TXT" copy="Download notes-ready transcript and summary." disabled={!activeVideo || activeVideo.status !== "completed"} onClick={() => onDownload("txt")} />
        <PortalAction icon={Share2} title="Share PDF" copy="Generate a PDF handout for students." disabled={!activeVideo || activeVideo.status !== "completed"} onClick={() => onDownload("pdf")} />
        <PortalAction icon={FileText} title="Review Transcript" copy="Open the lecture transcript for review." disabled={!activeVideo || activeVideo.status !== "completed"} onClick={() => onSelectTab("transcript")} />
        <PortalMini label="Lectures" value={String(videos.length)} />
        <PortalMini label="Engagement" value={`${detail.analytics?.engagement_score ?? 0}%`} />
        <PortalMini label="Topics" value={String(detail.analytics?.topics?.length ?? 0)} />
      </PortalShell>
    );
  }

  return (
    <PortalShell
      eyebrow="Administrator Portal"
      title="Operate users, roles, content, jobs, and platform health."
      copy="Monitor activity, manage roles, review uploaded content, and keep processing resources visible."
      icon={Shield}
    >
      <PortalAction icon={Trash2} title="Delete Saved Video" copy="Remove the selected uploaded video and saved AI results." disabled={!activeVideo || busy} onClick={() => activeVideo && onDelete(activeVideo)} />
      <PortalAction icon={RefreshCw} title="Monitor Jobs" copy="Re-run the selected processing job if output needs repair." disabled={!activeVideo || busy} onClick={() => activeVideo && onReprocess(activeVideo)} />
      <PortalAction icon={BarChart3} title="System Analytics" copy="Open the selected video's platform analytics." disabled={!activeVideo} onClick={() => onSelectTab("analytics")} />
      <PortalMini label="Users" value={String(adminMetrics?.users ?? adminUsers.length)} />
      <PortalMini label="Videos" value={String(adminMetrics?.videos ?? videos.length)} />
      <PortalMini label="Audit Logs" value={String(adminMetrics?.audit_logs ?? 0)} />
      <PortalMini label="Jobs" value={String(processingVideos.length)} />
      <div className="col-span-full grid gap-3 lg:grid-cols-2">
        {adminUsers.slice(0, 4).map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#8ff0c7]/20 bg-[#071a17]/48 p-3">
            <div className="min-w-0">
              <p className="truncate font-black text-[#f5fff7]">{item.name}</p>
              <p className="truncate text-xs text-[#9ed7c7]">{item.email}</p>
            </div>
            <select
              value={item.role}
              onChange={(event) => onRoleChange(item.id, event.target.value as Role)}
              className="h-10 rounded-lg border border-[#8ff0c7]/25 bg-[#102523] px-3 text-sm font-bold text-[#f5fff7] outline-none"
            >
              {roles.map((role) => <option key={role}>{role}</option>)}
            </select>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}

function PortalShell({
  eyebrow,
  title,
  copy,
  icon: Icon,
  children
}: {
  eyebrow: string;
  title: string;
  copy: string;
  icon: typeof VideoIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-panel mb-8 rounded-[24px] p-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_1.25fr]">
        <div>
          <p className="flex items-center gap-2 font-mono text-xs font-black uppercase tracking-[0.24em] text-[#8ff0c7]">
            <Icon className="h-5 w-5" /> {eyebrow}
          </p>
          <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight text-[#f5fff7] md:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#b9e7dc]">{copy}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">{children}</div>
      </div>
    </section>
  );
}

function PortalAction({
  icon: Icon,
  title,
  copy,
  disabled,
  onClick
}: {
  icon: typeof VideoIcon;
  title: string;
  copy: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-32 rounded-xl border border-[#8ff0c7]/20 bg-[#071a17]/48 p-4 text-left transition hover:-translate-y-0.5 hover:border-[#8ff0c7]/55 hover:bg-[#0e4a3e]/55 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Icon className="h-5 w-5 text-[#0fd196]" />
      <p className="mt-4 font-black text-[#f5fff7]">{title}</p>
      <p className="mt-2 text-sm leading-5 text-[#9ed7c7]">{copy}</p>
    </button>
  );
}

function PortalMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#8ff0c7]/20 bg-[#071a17]/48 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9ed7c7]">{label}</p>
      <p className="mt-3 truncate text-3xl font-black text-[#f5fff7]">{value}</p>
    </div>
  );
}

function Results({
  activeVideo,
  detail,
  tab,
  setTab,
  summaryView,
  setSummaryView,
  summaryLanguage,
  setSummaryLanguage,
  displayedSummary,
  translatingSummary,
  onReprocess,
  onDownload,
  transcriptSearch,
  setTranscriptSearch,
  busy
  ,
  isBookmarked,
  onBookmark
}: {
  activeVideo: Video;
  detail: Detail;
  tab: string;
  setTab: (value: "summary" | "transcript" | "moments" | "analytics") => void;
  summaryView: "brief" | "detailed";
  setSummaryView: (value: "brief" | "detailed") => void;
  summaryLanguage: SummaryLanguage;
  setSummaryLanguage: (value: SummaryLanguage) => void;
  displayedSummary?: Detail["summary"];
  translatingSummary: boolean;
  onReprocess: (video: Video) => void;
  onDownload: (format: "txt" | "pdf") => void;
  transcriptSearch: string;
  setTranscriptSearch: (value: string) => void;
  busy: boolean;
  isBookmarked: boolean;
  onBookmark: (videoId: string) => void;
}) {
  return (
    <div>
      <Panel className="min-h-[560px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#8ff0c7]/20 pb-6">
          <div className="flex flex-wrap gap-3">
            {[
              ["summary", "Summary"],
              ["transcript", "Original Content"],
              ["moments", "Key Moments"],
              ["analytics", "Analytics"]
            ].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id as "summary" | "transcript" | "moments" | "analytics")} className={`h-12 rounded-lg px-5 text-sm font-black transition ${tab === id ? "bg-[#0fa071] text-white shadow-lg shadow-[#0fa071]/20" : "bg-[#163b35]/70 text-[#dff8ea] hover:bg-[#205049]"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => onBookmark(activeVideo.id)} className="inline-flex h-12 items-center gap-2 rounded-lg border border-[#0fa071]/70 px-4 text-sm font-black text-[#c9ffed] transition hover:border-[#8ff0c7] hover:bg-[#0fa071]/20">
              <Bookmark className="h-4 w-4" /> {isBookmarked ? "Saved" : "Save"}
            </button>
            <button onClick={() => onDownload("txt")} disabled={busy} className="inline-flex h-12 items-center gap-2 rounded-lg border border-[#0fa071]/70 px-4 text-sm font-black text-[#c9ffed] transition hover:border-[#8ff0c7] hover:bg-[#0fa071]/20 disabled:opacity-50">
              <Download className="h-4 w-4" /> TXT
            </button>
            <button onClick={() => onDownload("pdf")} disabled={busy} className="inline-flex h-12 items-center gap-2 rounded-lg border border-[#0fa071]/70 px-4 text-sm font-black text-[#c9ffed] transition hover:border-[#8ff0c7] hover:bg-[#0fa071]/20 disabled:opacity-50">
              <Download className="h-4 w-4" /> PDF
            </button>
            <button onClick={() => onReprocess(activeVideo)} disabled={busy} className="h-12 rounded-lg border border-[#0fa071]/70 px-4 text-sm font-black text-[#c9ffed] transition hover:border-[#8ff0c7] hover:bg-[#0fa071]/20 disabled:opacity-50">
              Regenerate
            </button>
          </div>
        </div>
        {tab === "summary" ? (
          <div className="max-h-[560px] overflow-auto pr-2">
            <div className="mb-6 flex flex-col gap-4 rounded-xl bg-[#071a17]/60 p-4 md:flex-row md:items-center md:justify-between">
              <p className="flex items-center gap-2 text-lg font-black text-[#f5fff7]"><FileText className="h-5 w-5 text-[#c9ffed]" /> Summary</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="grid grid-cols-2 rounded-lg border border-[#8ff0c7]/20 bg-[#102523] p-1">
                  {(["brief", "detailed"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSummaryView(item)}
                      className={`h-10 px-4 text-sm font-black capitalize transition ${summaryView === item ? "rounded-md bg-[#0fa071] text-white" : "text-[#b9e7dc] hover:text-white"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 rounded-lg border border-[#8ff0c7]/20 bg-[#102523] p-1">
                  {(["english", "hindi", "hinglish"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSummaryLanguage(item)}
                      disabled={translatingSummary}
                      className={`h-10 px-3 text-sm font-black capitalize transition disabled:opacity-60 ${summaryLanguage === item ? "rounded-md bg-[#eafff4] text-[#08201d]" : "text-[#b9e7dc] hover:text-white"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <h2 className="text-3xl font-black text-[#f5fff7]">Summary of {activeVideo.title}</h2>
            {translatingSummary ? <p className="mt-4 text-sm font-bold text-[#8ff0c7]">Converting summary language...</p> : null}
            {summaryView === "brief" ? (
              <p className="mt-5 text-xl leading-9 text-[#dff8ea]">{displayedSummary?.short_summary ?? "Brief summary is loading."}</p>
            ) : (
              <div className="mt-8 whitespace-pre-line text-lg leading-9 text-[#dff8ea]">{displayedSummary?.detailed_summary ?? "Detailed summary is loading."}</div>
            )}
          </div>
        ) : null}
        {tab === "transcript" ? <Transcript detail={detail} search={transcriptSearch} setSearch={setTranscriptSearch} /> : null}
        {tab === "moments" ? <Moments detail={detail} /> : null}
        {tab === "analytics" ? <Analytics detail={detail} /> : null}
      </Panel>
    </div>
  );
}

function TutorPopup({
  title,
  messages,
  value,
  busy,
  setValue,
  onSend,
  onClose
}: {
  title?: string;
  messages: TutorMessage[];
  value: string;
  busy: boolean;
  setValue: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-[#03110f]/60 p-4 backdrop-blur-sm sm:p-6">
      <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-[#8ff0c7]/25 bg-[#0d2824]/92 text-[#f5fff7] shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex items-start justify-between border-b border-[#8ff0c7]/20 p-6">
          <div>
            <p className="flex items-center gap-2 text-xl font-bold">
              <span className="h-3 w-3 rounded-full bg-emerald-600" /> AI Tutor
            </p>
            <p className="mt-2 text-sm text-[#9ed7c7]">
              {title ? `Ask anything about "${title}"` : "Ask anything about your uploaded video"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full border border-[#8ff0c7]/25 text-[#dff8ea] transition hover:bg-[#0fa071]/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[420px] space-y-4 overflow-auto px-6 py-6">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-7 ${
                  message.role === "user"
                    ? "bg-emerald-600 text-white"
                    : "bg-[#14352f] text-[#dff8ea]"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {busy ? (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-[#14352f] px-4 py-3 text-sm text-[#b9e7dc]">
                AI Tutor is thinking...
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-[#8ff0c7]/20 p-4">
          <div className="flex min-h-14 items-center gap-3 rounded-[20px] border border-[#8ff0c7]/25 bg-[#071a17]/64 px-4">
            <input
              placeholder="Ask AI assistant..."
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!busy) onSend();
                }
              }}
              className="min-w-0 flex-1 bg-transparent py-3 text-[#f5fff7] outline-none placeholder:text-[#9ed7c7]"
            />
            <button
              type="button"
              disabled={busy || !value.trim()}
              onClick={onSend}
              className="grid h-10 w-10 place-items-center rounded-full bg-[#0fa071] text-white disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Transcript({ detail, search, setSearch }: { detail: Detail; search: string; setSearch: (value: string) => void }) {
  const query = search.trim().toLowerCase();
  const segments = (detail.transcript?.segments ?? []).filter((segment) => !query || segment.text.toLowerCase().includes(query));
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-3xl font-black text-[#f5fff7]">Original Content</h2>
        <label className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-[#8ff0c7]/25 bg-[#071a17]/60 px-4 text-[#dff8ea] md:max-w-sm">
          <Search className="h-4 w-4 text-[#0fd196]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search transcript..."
            className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-[#8fb4aa]"
          />
        </label>
      </div>
      {segments.map((segment) => (
        <p key={`${segment.start}-${segment.end}`} className="rounded-xl bg-[#071a17]/60 p-4 leading-7 text-[#dff8ea]">
          <span className="mr-3 rounded-md bg-[#eafff4] px-2 py-1 text-sm font-bold text-[#08201d]">{Math.round(segment.start)}s</span>
          {segment.text}
        </p>
      ))}
      {!segments.length ? <p className="rounded-xl bg-[#071a17]/60 p-4 text-[#9ed7c7]">No transcript matches found.</p> : null}
    </div>
  );
}

function Moments({ detail }: { detail: Detail }) {
  return (
    <div>
      <h2 className="mb-5 text-3xl font-black text-[#f5fff7]">Key Moments</h2>
      <div className="space-y-4">
        {(detail.moments ?? []).map((moment) => (
          <div key={`${moment.timestamp}-${moment.title}`} className="rounded-xl border border-[#8ff0c7]/25 bg-[#071a17]/36 p-4 text-[#dff8ea]">
            <p className="font-bold">{Math.round(moment.timestamp)}s / {moment.title}</p>
            <div className="mt-3 h-3 rounded-full bg-[#173b35]">
              <div className="h-3 rounded-full bg-[#0fd196]" style={{ width: `${moment.importance_score * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Analytics({ detail }: { detail: Detail }) {
  return (
    <div>
      <h2 className="mb-5 text-3xl font-black text-[#f5fff7]">Content Analytics</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Metric label="Watch time" value={`${Math.round(detail.analytics?.watch_time ?? 0)}s`} icon={VideoIcon} />
        <Metric label="Engagement" value={`${detail.analytics?.engagement_score ?? 0}%`} icon={BarChart3} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {(detail.analytics?.topics ?? []).map((topic) => <span key={topic} className="rounded-full bg-[#eafff4] px-4 py-2 font-bold text-[#08201d]">{topic}</span>)}
      </div>
    </div>
  );
}

function ProcessingCard({ title }: { title: string }) {
  return (
    <Panel className="grid min-h-[560px] place-items-center text-center">
      <div>
        <div className="mx-auto grid h-28 w-28 place-items-center rounded-full border-8 border-[#8ff0c7]/25 border-t-[#0fd196]">
          <Sparkles className="h-10 w-10 text-[#c9ffed]" />
        </div>
        <h2 className="mt-10 text-3xl font-black text-[#f5fff7]">Generating Summary</h2>
        <p className="mt-4 text-lg text-[#b9e7dc]">Listening to {title}, extracting main ideas, and finding key moments...</p>
        <div className="mx-auto mt-10 h-3 w-80 overflow-hidden rounded-full bg-[#173b35]">
          <div className="h-full w-1/2 rounded-full bg-[#0fd196]" />
        </div>
        <p className="mt-10 text-[#9ed7c7]">Tip: Add GROQ_API_KEY for full speech transcription with Whisper.</p>
      </div>
    </Panel>
  );
}

function EmptyState() {
  return (
    <Panel className="grid min-h-[520px] place-items-center text-center">
      <div>
        <Upload className="mx-auto h-16 w-16 text-[#0fd196]" />
        <h2 className="mt-6 text-3xl font-black text-[#f5fff7]">Upload a video to begin</h2>
        <p className="mt-4 max-w-xl text-lg text-[#b9e7dc]">ClipMind will generate a transcript, summary, key moments, and analytics.</p>
      </div>
    </Panel>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="clipmind-shell min-h-screen text-[#f5fff7] transition-colors">{children}</div>;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`glass-panel rounded-[22px] p-6 ${className}`}>{children}</div>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof VideoIcon }) {
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#9ed7c7]">{label}</p>
        <Icon className="h-5 w-5 text-[#0fd196]" />
      </div>
      <p className="mt-4 truncate text-3xl font-black text-[#f5fff7]">{value}</p>
    </Panel>
  );
}

function LandingField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="mb-3 h-12 w-full border border-[#8ff0c7]/45 bg-[#102523] px-4 font-mono text-sm font-semibold text-[#f7fff8] outline-none placeholder:text-[#bdd8cf] focus:border-[#8ff0c7]" required />;
}

function LandingStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-[#8ff0c7]/25 bg-[#0b1817]/55 p-4">
      <p className="landing-headline text-4xl font-black text-[#8ff0c7]">{value}</p>
      <p className="mt-3 font-mono text-xs leading-5 text-white/70">{label}</p>
    </div>
  );
}

function LandingInfo({ title, copy }: { title: string; copy: string }) {
  return (
    <article className="group border border-[#8ff0c7]/20 bg-[#0d1d1c]/45 p-6 transition hover:border-[#8ff0c7]/55 hover:bg-[#8ff0c7]/5">
      <p className="landing-headline text-3xl font-black uppercase text-[#dff8ea]">{title}</p>
      <p className="mt-5 font-mono text-sm leading-6 text-[#abcac0]">{copy}</p>
    </article>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-[#8ff0c7]/15 bg-[#071110] px-6 py-16 text-[#dff8ea] sm:px-10">
      <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-[1.35fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <Brand light />
          <p className="mt-7 max-w-sm font-mono text-sm leading-7 text-[#8fb4aa]">
            AI video intelligence platform for creators, students and educators. Turn long videos into transcripts, summaries, moments and answers.
          </p>
          <div className="mt-8 flex gap-3">
            {[VideoIcon, FileText, Bot].map((Icon, index) => (
              <span key={index} className="grid h-11 w-11 place-items-center border border-[#8ff0c7]/20 bg-[#102523] text-[#8ff0c7]">
                <Icon className="h-5 w-5" />
              </span>
            ))}
          </div>
        </div>
        <FooterColumn title="Platform" links={["Features", "Upload Video", "AI Tutor", "Dashboard"]} />
        <FooterColumn title="AI Tools" links={["Transcript", "Key Moments", "Smart Summary", "Analytics"]} />
        <FooterColumn title="Company" links={["Privacy Policy", "Terms of Service", "Project Report", "Contact"]} />
      </div>
      <div className="mx-auto mt-14 flex max-w-7xl flex-col justify-between gap-5 border-t border-[#8ff0c7]/15 pt-8 font-mono text-sm text-[#70978d] md:flex-row">
        <p>© 2026 ClipMind AI. All rights reserved.</p>
        <p>Available via Web Browser</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <p className="font-black text-[#f7fff8]">{title}</p>
      <div className="mt-6 space-y-4 font-mono text-sm text-[#8fb4aa]">
        {links.map((link) => <p key={link}>{link}</p>)}
      </div>
    </div>
  );
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 96 76" className="h-14 w-16 shrink-0 drop-shadow-[0_6px_10px_rgba(64,180,145,0.25)]" aria-hidden="true">
        <path
          d="M18 43c-8-1-13-6-13-13 0-7 5-12 12-13 3-8 11-13 21-13 7 0 13 2 18 7 4-2 8-3 13-3 12 0 21 8 21 19 0 4-1 7-3 10 3 3 5 7 5 12 0 9-8 16-18 16H35c-9 0-17-5-17-14Z"
          fill="#f7fff8"
          stroke="#47b894"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M31 14c5 4 10 5 16 4M55 12c3 7 2 12-3 17M18 28c8 1 14 4 18 10M40 38c8-1 14 2 18 8M66 28c7 2 12 5 15 10M49 62v9c0 7-3 11-10 15M25 48c7 1 12 4 16 10M57 51c5-1 9 1 13 5"
          fill="none"
          stroke="#47b894"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className={`font-black uppercase tracking-[0.06em] drop-shadow-[0_2px_0_rgba(0,0,0,0.14)] ${light ? "text-[#f5fff7]" : "text-[#183936]"}`}>
        <span className="text-[30px] leading-none md:text-[34px]">CLIPMIND</span>
      </p>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <main className="min-h-screen px-5 py-8">
      <section className="mx-auto flex min-h-[560px] max-w-7xl items-center">
        <div>
          <Brand />
          <h1 className="mt-5 text-6xl font-extrabold">AI Video Summarizer</h1>
        </div>
      </section>
    </main>
  );
}


