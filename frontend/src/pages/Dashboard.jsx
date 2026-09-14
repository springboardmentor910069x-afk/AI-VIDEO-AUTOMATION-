import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import "./Dashboard.css";
import VideoChatbot from "../components/VideoChatbot";

function Dashboard() {
 const [video, setVideo] = useState(null);
const [title, setTitle] = useState("");
const [youtubeUrl, setYoutubeUrl] = useState("");
const [transcript, setTranscript] = useState("");
const [chatQuestion, setChatQuestion] = useState("");
const [chatMessages, setChatMessages] = useState([]);
const [chatLoading, setChatLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [timestamps, setTimestamps] = useState([]);
  const [keyMoments, setKeyMoments] = useState([]);
  const [youtubeMetadata, setYoutubeMetadata] = useState({});
  const [duration, setDuration] = useState(0);
  const [wordCount, setWordCount] = useState(0);

  const [savedVideos, setSavedVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null);

  const [searchText, setSearchText] = useState("");

  const [selectedVideoFilename, setSelectedVideoFilename] =
    useState(null);

  const [selectedVideoId, setSelectedVideoId] = useState(null);

  const [editingTranscript, setEditingTranscript] =
    useState(false);

  const [editedTranscript, setEditedTranscript] = useState("");

  const [savingTranscript, setSavingTranscript] =
    useState(false);

  const [dragActive, setDragActive] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const BACKEND_URL = "http://127.0.0.1:8000";

  // =========================================================
  // KEY MOMENTS DETECTION
  // =========================================================

  const detectKeyMoments = (
    segments,
    extractedKeywords = []
  ) => {
    if (!segments || segments.length === 0) {
      return [];
    }

    const keywordSet = extractedKeywords.map((keyword) =>
      keyword.toLowerCase()
    );

    const importantWords = [
      "important",
      "main",
      "key",
      "important point",
      "important points",
      "conclusion",
      "finally",
      "remember",
      "note",
      "problem",
      "solution",
      "result",
      "because",
      "therefore",
      "benefit",
      "advantage",
      "disadvantage",
      "future",
      "learn",
      "learning",
      "decision",
      "example",
    ];

    const scoredSegments = segments.map(
      (segment, index) => {
        const text = (segment.text || "").trim();
        const lowerText = text.toLowerCase();

        let score = 0;

        score += Math.min(text.length / 40, 3);

        keywordSet.forEach((keyword) => {
          if (
            keyword &&
            lowerText.includes(keyword)
          ) {
            score += 2;
          }
        });

        importantWords.forEach((word) => {
          if (lowerText.includes(word)) {
            score += 2;
          }
        });

        if (/[.!?]$/.test(text)) {
          score += 0.5;
        }

        return {
          ...segment,
          index,
          score,
        };
      }
    );

    scoredSegments.sort(
      (a, b) => b.score - a.score
    );

    const selected = [];

    for (const segment of scoredSegments) {
      const tooClose = selected.some(
        (existing) =>
          Math.abs(
            Number(existing.start) -
              Number(segment.start)
          ) < 4
      );

      if (!tooClose) {
        selected.push(segment);
      }

      if (selected.length >= 5) {
        break;
      }
    }

    return selected
      .sort(
        (a, b) =>
          Number(a.start) - Number(b.start)
      )
      .map((segment, index) => ({
        ...segment,
        rank: index + 1,
      }));
  };

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/";
      return;
    }

    loadVideos();
  }, []);

  // =========================================================
  // LOAD SAVED VIDEOS
  // =========================================================

  const loadVideos = async () => {
    setHistoryLoading(true);

    try {
      const res = await api.get("/videos");
      setSavedVideos(res.data || []);
    } catch (err) {
      console.error(
        "Error loading videos:",
        err
      );
    }

    setHistoryLoading(false);
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  // =========================================================
  // FILE CHANGE
  // =========================================================

  const processSelectedFile = (selectedFile) => {
    if (!selectedFile) return;

    if (
      !selectedFile.type.startsWith("video/")
    ) {
      alert("Please select a valid video file.");
      return;
    }

   setVideo(selectedFile);
setTitle("");

setSelectedVideoFilename(null);
    setSelectedVideoId(null);

    setTranscript("");
    setSummary("");
    setKeywords([]);
    setTimestamps([]);
    setKeyMoments([]);
    setDuration(0);
    setWordCount(0);

    setEditingTranscript(false);
    setEditedTranscript("");
  };

  const handleFileChange = (e) => {
    const selectedFile =
      e.target.files[0];

    processSelectedFile(selectedFile);
  };

  // =========================================================
  // DRAG & DROP
  // =========================================================

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);

    const droppedFile =
      e.dataTransfer.files[0];

    if (droppedFile) {
      processSelectedFile(droppedFile);
    }
  };

  // =========================================================
  // UPLOAD VIDEO
  // =========================================================

  const handleUpload = async () => {
   if (!video) {
  alert("Please select a video first.");
  return;
}

if (!title.trim()) {
  alert("Please enter a title for the video.");
  return;
}

    setLoading(true);

   const formData = new FormData();

formData.append("file", video);
formData.append("title", title.trim());

    try {
      const res = await api.post(
        "/upload",
        formData
      );

      const receivedTranscript =
        res.data.transcript || "";

      const receivedSummary =
        res.data.summary || "";

      const receivedKeywords =
        res.data.keywords || [];

      const receivedTimestamps =
        res.data.timestamps || [];

      const receivedKeyMoments =
        res.data.key_moments || [];

      setTranscript(receivedTranscript);
      setSummary(receivedSummary);
      setKeywords(receivedKeywords);
      setTimestamps(receivedTimestamps);

      /*
       * Use key moments returned by the backend.
       * If the backend does not return them,
       * fall back to the frontend detector.
       */
      setKeyMoments(
  receivedKeyMoments.map(
    (moment, index) => ({
      ...moment,
      rank: index + 1,
    })
  )
);

      setDuration(
        res.data.duration || 0
      );

      setWordCount(
        res.data.word_count || 0
      );

      setSelectedVideoFilename(
        res.data.filename ||
          video.name
      );

      setSelectedVideoId(
        res.data.id || null
      );

      setEditingTranscript(false);

      setEditedTranscript(
        receivedTranscript
      );

      await loadVideos();

      setTimeout(() => {
        window.scrollTo({
          top:
            document.body.scrollHeight,
          behavior: "smooth",
        });
      }, 300);
    } catch (err) {
      console.error(
        "Upload error:",
        err
      );

      alert(
        err.response?.data?.detail ||
          "Something went wrong while analyzing the video."
      );
    }

    setLoading(false);
  };
  // =========================================================
  // ANALYZE YOUTUBE VIDEO
  // =========================================================

  const handleYouTubeAnalyze = async () => {
  if (!title.trim()) {
    alert("Please enter a title for the YouTube video.");
    return;
  }

  if (!youtubeUrl.trim()) {
    alert("Please enter a YouTube URL.");
    return;
  }

  setLoading(true);

  // Clear previous local video
  setVideo(null);

  // Clear previous analysis
  setTranscript("");
  setSummary("");
  setKeywords([]);
  setTimestamps([]);
  setKeyMoments([]);
  setDuration(0);
  setWordCount(0);

  setSelectedVideoFilename(null);
  setSelectedVideoId(null);

  setEditingTranscript(false);
  setEditedTranscript("");

  try {
    const res = await api.post(
      "/youtube",
      {
        title: title.trim(),
        url: youtubeUrl.trim(),
      }
    );

    const receivedTranscript =
      res.data.transcript || "";

    const receivedSummary =
      res.data.summary || "";

    const receivedKeywords =
      res.data.keywords || [];

    const receivedTimestamps =
      res.data.timestamps || [];

    const receivedKeyMoments =
      res.data.key_moments || [];
    
    const receivedMetadata =
      res.data.youtube_metadata || {};

    console.log("YOUTUBE METADATA:", receivedMetadata);

    setTranscript(
      receivedTranscript
    );

    setSummary(
      receivedSummary
    );
    
    setYoutubeMetadata(
      receivedMetadata
    );

    setKeywords(
      receivedKeywords
    );

    setTimestamps(
      receivedTimestamps
    );

    setKeyMoments(
      receivedKeyMoments.map(
        (moment, index) => ({
          ...moment,
          rank: index + 1,
        })
      )
    );

    setDuration(
      res.data.duration || 0
    );

    setWordCount(
      res.data.word_count || 0
    );

    setSelectedVideoFilename(
      res.data.filename || null
    );

    setSelectedVideoId(
      res.data.id || null
    );

    setEditedTranscript(
      receivedTranscript
    );

    setEditingTranscript(false);

    await loadVideos();

    setTimeout(() => {
      const resultsSection =
        document.getElementById(
          "results-section"
        );

      if (resultsSection) {
        const sectionPosition =
          resultsSection.getBoundingClientRect().top +
          window.scrollY -
          90;

        window.scrollTo({
          top: sectionPosition,
          behavior: "smooth",
        });
      }
    }, 500);

  } catch (err) {
    console.error(
      "YouTube analysis error:",
      err
    );

    alert(
      err.response?.data?.detail ||
        "Something went wrong while analyzing the YouTube video."
    );
  }

  setLoading(false);
};
  // =========================================================
  // CHAT WITH VIDEO
  // =========================================================

  const handleChatSubmit = async () => {
    if (!chatQuestion.trim()) {
      return;
    }

    if (!transcript.trim()) {
      alert("No transcript is available for this video.");
      return;
    }

    const question = chatQuestion.trim();

    setChatMessages((previousMessages) => [
      ...previousMessages,
      {
        type: "user",
        text: question,
      },
    ]);

    setChatQuestion("");
    setChatLoading(true);

    try {
      const res = await api.post(
        "/chat",
        {
          question: question,
          transcript: transcript,
          title: title || "Current Video",
        }
      );

      setChatMessages((previousMessages) => [
        ...previousMessages,
        {
          type: "bot",
          text:
            res.data.answer ||
            "I could not find an answer in this video.",
        },
      ]);
    } catch (err) {
      console.error(
        "Chat error:",
        err
      );

      setChatMessages((previousMessages) => [
        ...previousMessages,
        {
          type: "bot",
          text:
            err.response?.data?.detail ||
            "Something went wrong while answering your question.",
        },
      ]);
    }

    setChatLoading(false);
  };

  // =========================================================
  // RESET
  // =========================================================

  const resetResults = () => {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.removeAttribute(
          "src"
        );
        videoRef.current.load();
      } catch (error) {
        console.error(
          "Error releasing video:",
          error
        );
      }
    }

    setVideo(null);
setTitle("");
setYoutubeUrl("");
setTranscript("");
setSummary("");
setYoutubeMetadata({});
    setKeywords([]);
    setTimestamps([]);
    setKeyMoments([]);
    setDuration(0);
    setWordCount(0);

    setSelectedVideoFilename(null);
    setSelectedVideoId(null);

    setEditingTranscript(false);
    setEditedTranscript("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // =========================================================
  // SHOW SAVED VIDEO
  // =========================================================

  const showSavedVideo = (savedVideo) => {
    setVideo(null);

    setSelectedVideoId(
      savedVideo.id
    );

    setSelectedVideoFilename(
      savedVideo.filename
    );

    const savedTranscript =
      savedVideo.transcript || "";

    setTranscript(
      savedTranscript
    );

    setEditedTranscript(
      savedTranscript
    );

    setEditingTranscript(false);

    setSummary(
      savedVideo.summary || ""
    );

    let parsedKeywords = [];

    if (savedVideo.keywords) {
      parsedKeywords =
        savedVideo.keywords
          .split(",")
          .map((keyword) =>
            keyword.trim()
          )
          .filter(
            (keyword) => keyword
          );

      setKeywords(
        parsedKeywords
      );
    } else {
      setKeywords([]);
    }

    setDuration(
      savedVideo.duration || 0
    );

    setWordCount(
      savedVideo.word_count || 0
    );

    let parsedTimestamps = [];

    if (
      savedVideo.transcript_timestamps
    ) {
      try {
        parsedTimestamps =
          typeof savedVideo.transcript_timestamps ===
          "string"
            ? JSON.parse(
                savedVideo.transcript_timestamps
              )
            : savedVideo.transcript_timestamps;

        parsedTimestamps =
          parsedTimestamps || [];

        setTimestamps(
          parsedTimestamps
        );
      } catch (error) {
        console.error(
          "Could not read timestamps:",
          error
        );

        setTimestamps([]);
        parsedTimestamps = [];
      }
    } else {
      setTimestamps([]);
    }

    const detectedMoments =
      detectKeyMoments(
        parsedTimestamps,
        parsedKeywords
      );

    setKeyMoments(
      detectedMoments
    );

    setTimeout(() => {
  const resultsSection =
    document.getElementById("results-section");

  if (resultsSection) {
    const sectionPosition =
      resultsSection.getBoundingClientRect().top +
      window.scrollY -
      90;

    window.scrollTo({
      top: sectionPosition,
      behavior: "smooth",
    });
  }
}, 500);
  };

  // =========================================================
  // TRANSCRIPT EDITING
  // =========================================================

  const startTranscriptEditing =
    () => {
      setEditedTranscript(
        transcript
      );

      setEditingTranscript(true);
    };

  const cancelTranscriptEditing =
    () => {
      setEditedTranscript(
        transcript
      );

      setEditingTranscript(false);
    };

  // =========================================================
  // SAVE EDITED TRANSCRIPT
  // =========================================================

  const saveTranscript =
    async () => {
      if (!selectedVideoId) {
        alert(
          "This video has not been saved with a valid ID."
        );

        return;
      }

      setSavingTranscript(true);

      try {
        const res = await api.put(
          `/videos/${selectedVideoId}/transcript`,
          {
            transcript:
              editedTranscript,
          }
        );

        setTranscript(
          res.data.transcript
        );

        setEditedTranscript(
          res.data.transcript
        );

        setWordCount(
          res.data.word_count
        );

        setEditingTranscript(
          false
        );

        setSavedVideos(
          (previousVideos) =>
            previousVideos.map(
              (savedVideo) =>
                savedVideo.id ===
                selectedVideoId
                  ? {
                      ...savedVideo,
                      transcript:
                        res.data
                          .transcript,
                      word_count:
                        res.data
                          .word_count,
                    }
                  : savedVideo
            )
        );

        alert(
          "Transcript saved successfully."
        );
      } catch (err) {
        console.error(
          "Error saving transcript:",
          err
        );

        alert(
          err.response?.data?.detail ||
            "Failed to save transcript."
        );
      }

      setSavingTranscript(false);
    };

  // =========================================================
  // DELETE VIDEO
  // =========================================================

  const handleDeleteVideo =
    async (
      videoId,
      filename
    ) => {
      const confirmed =
        window.confirm(
          `Are you sure you want to delete "${filename}"?\n\nThis will delete the video and its analysis permanently.`
        );

      if (!confirmed) return;

      setDeleteLoading(videoId);

      try {
        if (
          selectedVideoId ===
            videoId &&
          videoRef.current
        ) {
          try {
            videoRef.current.pause();

            videoRef.current.removeAttribute(
              "src"
            );

            videoRef.current.load();
          } catch (error) {
            console.error(
              "Error releasing video:",
              error
            );
          }

          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                300
              )
          );
        }

        await api.delete(
          `/videos/${videoId}`
        );

        if (
          selectedVideoId ===
          videoId
        ) {
          setVideo(null);
          setTranscript("");
          setSummary("");
          setKeywords([]);
          setTimestamps([]);
          setKeyMoments([]);
          setDuration(0);
          setWordCount(0);

          setSelectedVideoFilename(
            null
          );

          setSelectedVideoId(
            null
          );

          setEditingTranscript(
            false
          );

          setEditedTranscript("");
        }

        setSavedVideos(
          (prevVideos) =>
            prevVideos.filter(
              (savedVideo) =>
                savedVideo.id !==
                videoId
            )
        );

        alert(
          "Video deleted successfully."
        );
      } catch (err) {
        console.error(
          "Error deleting video:",
          err
        );

        alert(
          err.response?.data?.detail ||
            "Failed to delete the video."
        );
      }

      setDeleteLoading(null);
    };

  // =========================================================
  // TIMESTAMP CLICK
  // =========================================================

  const handleTimestampClick =
    (startTime) => {
      if (!videoRef.current)
        return;

      const time = Number(
        startTime
      );

      if (Number.isNaN(time))
        return;

      // Jump to selected timestamp
      videoRef.current.currentTime =
        time;

      // Scroll to video player
      videoRef.current.scrollIntoView(
        {
          behavior: "smooth",
          block: "center",
        }
      );

      // Start playback
      const playPromise =
        videoRef.current.play();

      if (
        playPromise !==
        undefined
      ) {
        playPromise.catch(
          (error) => {
            console.error(
              "Video playback could not start:",
              error
            );
          }
        );
      }
    };

  // =========================================================
  // FORMAT TIME
  // =========================================================

  const formatTime = (
    seconds
  ) => {
    const numericSeconds =
      Number(seconds) || 0;

    const mins = Math.floor(
      numericSeconds / 60
    );

    const secs = Math.floor(
      numericSeconds % 60
    );

    return `${mins}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // =========================================================
  // VIDEO URL
  // =========================================================

  const getVideoUrl = (
    filename
  ) => {
    if (!filename) return "";

    return `${BACKEND_URL}/uploads/${encodeURIComponent(
      filename
    )}`;
  };

  // =========================================================
  // SEARCH
  // =========================================================

  const filteredVideos =
  savedVideos.filter((savedVideo) => {
    const search = searchText.toLowerCase();

    return (
      savedVideo.title
        ?.toLowerCase()
        .includes(search) ||
      savedVideo.filename
        ?.toLowerCase()
        .includes(search)
    );
  });

  const hasResults =
    transcript ||
    summary ||
    keywords.length > 0;

  // =========================================================
  // REPORT CALCULATIONS
  // =========================================================

  const totalVideos =
    savedVideos.length;

  const totalDuration =
    savedVideos.reduce(
      (total, item) =>
        total +
        (Number(
          item.duration
        ) || 0),
      0
    );

  const totalWords =
    savedVideos.reduce(
      (total, item) =>
        total +
        (Number(
          item.word_count
        ) || 0),
      0
    );

  const totalKeywords =
    savedVideos.reduce(
      (total, item) => {
        if (!item.keywords) {
          return total;
        }

        return (
          total +
          item.keywords
            .split(",")
            .map(
              (keyword) =>
                keyword.trim()
            )
            .filter(
              (keyword) =>
                keyword
            ).length
        );
      },
      0
    );

  const totalTranscriptSegments =
    savedVideos.reduce(
      (total, item) => {
        if (
          !item.transcript_timestamps
        ) {
          return total;
        }

        try {
          const parsed =
            typeof item.transcript_timestamps ===
            "string"
              ? JSON.parse(
                  item.transcript_timestamps
                )
              : item.transcript_timestamps;

          return (
            total +
            (Array.isArray(parsed)
              ? parsed.length
              : 0)
          );
        } catch {
          return total;
        }
      },
      0
    );

  const averageWordsPerMinute =
    duration > 0
      ? Math.round(
          wordCount /
            (duration / 60)
        )
      : 0;

  const highlightCoverage =
    duration > 0
      ? Math.round(
          (keyMoments.length /
            Math.max(
              timestamps.length,
              1
            )) *
            100
        )
      : 0;

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="dashboard-page">

      {/* ================= SIDEBAR ================= */}

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-mark">
            C
          </div>

          <div>

            <div className="brand-name">
              ClipMind
            </div>

            <div className="brand-subtitle">
              AI Video Intelligence
            </div>

          </div>

        </div>

        <nav className="sidebar-nav">

          <div className="nav-label">
            WORKSPACE
          </div>

          <button className="nav-item active">
            <span>▣</span>
            Dashboard
          </button>

          <button
            className="nav-item"
            onClick={() =>
              document
                .getElementById(
                  "history-section"
                )
                ?.scrollIntoView({
                  behavior:
                    "smooth",
                })
            }
          >
            <span>▤</span>
            Video Library
          </button>

          <button
            className="nav-item"
            onClick={() =>
              document
                .getElementById(
                  "results-section"
                )
                ?.scrollIntoView({
                  behavior:
                    "smooth",
                })
            }
          >
            <span>✦</span>
            AI Analysis
          </button>

          <button
            className="nav-item"
            onClick={() =>
              document
                .getElementById(
                  "reports-section"
                )
                ?.scrollIntoView({
                  behavior:
                    "smooth",
                })
            }
          >
            <span>▥</span>
            Reports
          </button>

        </nav>

        <div className="sidebar-bottom">

          <div className="sidebar-tip">

            <div className="tip-icon">
              ✦
            </div>

            <div>

              <strong>
                AI powered
              </strong>

              <p>
                Transform long videos into
                searchable knowledge.
              </p>

            </div>

          </div>

          <button
            className="sidebar-logout"
            onClick={
              handleLogout
            }
          >
            <span>↪</span>
            Logout
          </button>

        </div>

      </aside>

      {/* ================= MAIN ================= */}

      <main className="dashboard-main">

        {/* TOP BAR */}

        <header className="topbar">

          <div>

            <div className="breadcrumb">
              Workspace / Dashboard
            </div>

            <h1>
              Video Intelligence
            </h1>

          </div>

          <div className="topbar-right">

            <div className="status-pill">

              <span className="status-dot">
              </span>

              System Ready

            </div>

            <button
              className="mobile-logout"
              onClick={
                handleLogout
              }
            >
              Logout
            </button>

          </div>

        </header>

        <div className="dashboard-content">

          {/* ================= HERO ================= */}

          <section className="hero-section">

            <div className="hero-copy">

              <span className="eyebrow">
                AI VIDEO WORKSPACE
              </span>

              <h2>
                Turn your videos into
                <span>
                  {" "}
                  intelligent content.
                </span>
              </h2>

              <p>
                Upload a video and let
                ClipMind automatically
                generate transcripts,
                summaries, keywords,
                searchable moments and
                content insights.
              </p>

            </div>

          </section>

          {/* ================= STATS ================= */}

          <section className="stats-grid">

            <div className="stat-card">

              <div className="stat-icon purple">
                ◈
              </div>

              <div>

                <span>
                  Total Videos
                </span>

                <strong>
                  {savedVideos.length}
                </strong>

              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon blue">
                ◷
              </div>

              <div>

                <span>
                  Analyzed Duration
                </span>

                <strong>
                  {formatTime(
                    totalDuration
                  )}
                </strong>

              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon green">
                Aa
              </div>

              <div>

                <span>
                  Words Processed
                </span>

                <strong>
                  {totalWords.toLocaleString()}
                </strong>

              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon orange">
                ✦
              </div>

              <div>

                <span>
                  AI Status
                </span>

                <strong className="ready-text">
                  Ready
                </strong>

              </div>

            </div>

          </section>

          {/* ================= UPLOAD ================= */}

          <section className="upload-section">

            <div className="section-heading">

              <div>

                <span className="section-eyebrow">
                  GET STARTED
                </span>

                <h2>
                  Analyze a new video
                </h2>

                <p>
                  Upload your video and let
                  AI handle the rest.
                </p>

              </div>

            </div>
            <div className="title-input-wrapper">
  <label htmlFor="videoTitle">
    Video Title
  </label>

  <input
    id="videoTitle"
    type="text"
    value={title}
    onChange={(e) => setTitle(e.target.value)}
    placeholder="Enter a title for your video"
    disabled={loading}
  />
</div>
            <div
              className={`upload-zone ${
                dragActive
                  ? "drag-active"
                  : ""
              }`}
              onDragOver={
                handleDragOver
              }
              onDragLeave={
                handleDragLeave
              }
              onDrop={
                handleDrop
              }
              onClick={() =>
                fileInputRef.current?.click()
              }
            >

              <input
                ref={fileInputRef}
                id="videoInput"
                type="file"
                accept="video/*"
                onChange={
                  handleFileChange
                }
                hidden
              />

              <div className="upload-circle">
                ↑
              </div>

              <h3>
                {video
                  ? video.name
                  : "Drop your video here"}
              </h3>

              <p>
                {video
                  ? `${(
                      video.size /
                      (1024 * 1024)
                    ).toFixed(
                      2
                    )} MB • Ready to analyze`
                  : "or click to browse from your computer"}
              </p>

              <div className="supported-formats">
                MP4{" "}
                <span>•</span>{" "}
                WEBM{" "}
                <span>•</span>{" "}
                MOV{" "}
                <span>•</span>{" "}
                MKV
              </div>

            </div>

            {video && (
              <div className="selected-video-bar">

                <div className="selected-video-info">

                  <div className="file-icon">
                    ▣
                  </div>

                  <div>

                    <strong>
                      {video.name}
                    </strong>

                    <span>
                      Video selected and ready
                    </span>

                  </div>

                </div>

                <button
                  className="remove-file"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetResults();
                  }}
                >
                  Remove
                </button>

              </div>
            )}

            <div className="upload-actions">

              <button
                className="primary-button"
                onClick={
                  handleUpload
                }
                disabled={
                  loading ||
                  !video
                }
              >

                {loading ? (
                  <>
                    <span className="button-spinner">
                      ◌
                    </span>

                    AI is processing...
                  </>
                ) : (
                  <>
                    ✦ Analyze Video
                  </>
                )}

              </button>

              {(video ||
                hasResults) && (
                <button
                  className="secondary-button"
                  onClick={
                    resetResults
                  }
                  disabled={
                    loading
                  }
                >
                  Reset
                </button>
              )}

            </div>

            {loading && (
              <div className="processing-card">

                <div className="processing-loader">
                  ◌
                </div>

                <div>

                  <strong>
                    ClipMind is analyzing your
                    video
                  </strong>

                  <p>
                    Whisper is generating the
                    transcript while AI processes
                    your content.
                  </p>

                </div>

              </div>
            )}

          </section>
                    {/* ================= YOUTUBE ================= */}

          <div
            style={{
              marginTop: "32px",
              paddingTop: "28px",
              borderTop: "1px solid rgba(255,255,255,0.08)"
            }}
          >

            <div className="section-heading">
              <div>
                <span className="section-eyebrow">
                  YOUTUBE
                </span>

                <h2>
                  Analyze from YouTube
                </h2>

                <p>
                  Paste a public YouTube URL and
                  let ClipMind analyze it automatically.
                </p>
              </div>
            </div>

            <div className="title-input-wrapper">

              <label htmlFor="youtubeUrl">
                YouTube URL
              </label>

              <input
                id="youtubeUrl"
                type="url"
                value={youtubeUrl}
                onChange={(e) =>
                  setYoutubeUrl(e.target.value)
                }
                placeholder="Paste YouTube video URL here"
                disabled={loading}
              />

            </div>

            <div className="upload-actions">

              <button
                className="primary-button"
                onClick={handleYouTubeAnalyze}
                disabled={
                  loading ||
                  !youtubeUrl.trim()
                }
              >

                {loading ? (
                  <>
                    <span className="button-spinner">
                      ◌
                    </span>

                    AI is processing...
                  </>
                ) : (
                  <>
                    ▶ Analyze YouTube Video
                  </>
                )}

              </button>

            </div>

          </div>
          {/* ================= HISTORY ================= */}

          <section
            id="history-section"
            className="library-section"
          >

            <div className="section-heading-row">

              <div>

                <span className="section-eyebrow">
                  YOUR LIBRARY
                </span>

                <h2>
                  Recent videos
                </h2>

              </div>

              {savedVideos.length >
                0 && (
                <span className="video-count">
                  {savedVideos.length}{" "}
                  {savedVideos.length ===
                  1
                    ? "video"
                    : "videos"}
                </span>
              )}

            </div>

            {savedVideos.length >
              0 && (
              <div className="search-wrapper">

                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search your video library..."
                  value={
                    searchText
                  }
                  onChange={(e) =>
                    setSearchText(
                      e.target.value
                    )
                  }
                />

                {searchText && (
                  <button
                    onClick={() =>
                      setSearchText(
                        ""
                      )
                    }
                  >
                    ×
                  </button>
                )}

              </div>
            )}

            {historyLoading ? (
              <div className="empty-state">

                <div className="large-loader">
                  ◌
                </div>

                <h3>
                  Loading your library...
                </h3>

              </div>
            ) : savedVideos.length ===
              0 ? (
              <div className="empty-state">

                <div className="empty-icon">
                  ▣
                </div>

                <h3>
                  Your library is empty
                </h3>

                <p>
                  Upload your first video to
                  start building your AI-powered
                  video library.
                </p>

              </div>
            ) : filteredVideos.length ===
              0 ? (
              <div className="empty-state">

                <div className="empty-icon">
                  ⌕
                </div>

                <h3>
                  No videos found
                </h3>

                <p>
                  Try searching for another
                  filename.
                </p>

              </div>
            ) : (
              <div className="video-grid">

                {filteredVideos.map(
                  (savedVideo) => (
                    <article
                      className={`library-card ${
                        selectedVideoId ===
                        savedVideo.id
                          ? "selected"
                          : ""
                      }`}
                      key={
                        savedVideo.id
                      }
                    >

                      <div className="library-card-top">

                        <div className="video-thumbnail">
                          <span>
                            ▶
                          </span>
                        </div>

                        <div className="video-card-meta">

                         <h3
  title={
    savedVideo.title ||
    savedVideo.filename
  }
>
  {savedVideo.title ||
    savedVideo.filename}
</h3>

<span className="video-filename">
  {savedVideo.filename}
</span>

                          <div className="video-details">

                            <span>
                              ◷{" "}
                              {formatTime(
                                savedVideo.duration ||
                                  0
                              )}
                            </span>

                            <span>
                              Aa{" "}
                              {savedVideo.word_count ||
                                0}{" "}
                              words
                            </span>

                          </div>

                        </div>

                      </div>

                      <div className="card-actions">

                        <button
                          className="view-analysis"
                          onClick={() =>
                            showSavedVideo(
                              savedVideo
                            )
                          }
                        >
                          View analysis
                          <span>
                            →
                          </span>
                        </button>

                        <button
                          className="delete-video"
                          onClick={() =>
                            handleDeleteVideo(
                              savedVideo.id,
                              savedVideo.filename
                            )
                          }
                          disabled={
                            deleteLoading ===
                            savedVideo.id
                          }
                        >
                          {deleteLoading ===
                          savedVideo.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>

                      </div>

                    </article>
                  )
                )}

              </div>
            )}

          </section>

          {/* ================= RESULTS ================= */}

          {hasResults && (
            <section
              id="results-section"
              className="results-section"
            >

              <div className="analysis-heading">

                <div>

                  <span className="section-eyebrow">
                    AI OUTPUT
                  </span>

                  <h2>
                    Video analysis
                  </h2>

                  <p>
                    AI-generated intelligence
                    from your selected video.
                  </p>

                </div>

                <div className="analysis-status">

                  <span>
                  </span>

                  Analysis complete

                </div>

              </div>

              {/* VIDEO */}

              {selectedVideoFilename && (
                <div className="player-card">

                  <div className="player-header">

                    <div>

                      <span className="mini-label">
                        VIDEO PREVIEW
                      </span>

                      <h3>
                        {
                          selectedVideoFilename
                        }
                      </h3>

                    </div>

                  </div>

                  <video
                    key={
                      selectedVideoFilename
                    }
                    ref={videoRef}
                    controls
                    className="video-player"
                    src={getVideoUrl(
                      selectedVideoFilename
                    )}
                  >
                    Your browser does not
                    support video playback.
                  </video>

                </div>
              )}

              {/* ANALYTICS */}

              <div className="analysis-stats">

                <div className="analysis-stat">

                  <span className="analysis-stat-icon">
                    ◷
                  </span>

                  <div>

                    <span>
                      Duration
                    </span>

                    <strong>
                      {formatTime(
                        duration
                      )}
                    </strong>

                  </div>

                </div>

                <div className="analysis-stat">

                  <span className="analysis-stat-icon">
                    Aa
                  </span>

                  <div>

                    <span>
                      Word Count
                    </span>

                    <strong>
                      {wordCount.toLocaleString()}
                    </strong>

                  </div>

                </div>

                <div className="analysis-stat">

                  <span className="analysis-stat-icon">
                    #
                  </span>

                  <div>

                    <span>
                      Keywords
                    </span>

                    <strong>
                      {keywords.length}
                    </strong>

                  </div>

                </div>

                <div className="analysis-stat">

                  <span className="analysis-stat-icon">
                    ✦
                  </span>

                  <div>

                    <span>
                      Moments
                    </span>

                    <strong>
                      {keyMoments.length}
                    </strong>

                  </div>

                </div>

              </div>

              {/* SUMMARY + KEYWORDS */}

              <div className="insight-grid">

                <div className="insight-card">

                  <div className="insight-header">

                    <div className="insight-icon purple-bg">
                      ✦
                    </div>

                    <div>

                      <span>
                        AI GENERATED
                      </span>

                      <h3>
                        Summary
                      </h3>

                    </div>

                  </div>

                  <div className="summary-content">
                    {summary ||
                      "No summary available."}
                  </div>

                </div>

                <div className="insight-card">

                  <div className="insight-header">

                    <div className="insight-icon blue-bg">
                      #
                    </div>

                    <div>

                      <span>
                        CONTENT TOPICS
                      </span>

                      <h3>
                        Keywords
                      </h3>

                    </div>

                  </div>

                  <div className="keyword-list">

                    {keywords.length >
                    0 ? (
                      keywords.map(
                        (
                          keyword,
                          index
                        ) => (
                          <span
                            key={
                              index
                            }
                            className="keyword-pill"
                          >
                            {
                              keyword
                            }
                          </span>
                        )
                      )
                    ) : (
                      <p className="muted-text">
                        No keywords available.
                      </p>
                    )}

                  </div>

                </div>

              </div>

              {/* =================================================
                  HIGHLIGHT REPORT
                  ================================================= */}

              <div className="timeline-card">

                <div className="timeline-header">

                  <div className="insight-header">

                    <div className="insight-icon purple-bg">
                      ✦
                    </div>

                    <div>

                      <span>
                        AI HIGHLIGHTS
                      </span>

                      <h3>
                        Highlight Report
                      </h3>

                    </div>

                  </div>

                  <span className="moment-count">
                    {keyMoments.length}{" "}
                    {keyMoments.length ===
                    1
                      ? "highlight"
                      : "highlights"}
                  </span>

                </div>

                {keyMoments.length >
                0 ? (
                  <div className="timeline-list">

                    {keyMoments.map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          className="timeline-item"
                          key={`highlight-${item.start}-${index}`}
                        >

                          <button
                            className="timeline-time"
                            onClick={() =>
                              handleTimestampClick(
                                item.start
                              )
                            }
                          >
                            ▶{" "}
                            {formatTime(
                              item.start
                            )}
                          </button>

                          <button
                            className="timeline-text"
                            onClick={() =>
                              handleTimestampClick(
                                item.start
                              )
                            }
                          >

                            <strong>
                              Highlight{" "}
                              {index +
                                1}
                            </strong>

                            <span>
                              {
                                item.text
                              }
                            </span>

                          </button>

                        </div>
                      )
                    )}

                  </div>
                ) : (
                  <div className="timeline-empty">
                    No key moments detected.
                  </div>
                )}

              </div>

              {/* =================================================
                  TRANSCRIPT
                  ================================================= */}

              <div className="transcript-card">

                <div className="transcript-header">

                  <div className="insight-header">

                    <div className="insight-icon green-bg">
                      Aa
                    </div>

                    <div>

                      <span>
                        SPEECH TO TEXT
                      </span>

                      <h3>
                        Transcript
                      </h3>

                    </div>

                  </div>

                  {!editingTranscript &&
                    selectedVideoId && (
                      <button
                        className="edit-button"
                        onClick={
                          startTranscriptEditing
                        }
                      >
                        ✎ Edit transcript
                      </button>
                    )}

                </div>

                {!editingTranscript ? (
                  <div className="transcript-display">
                    {transcript ||
                      "No transcript available."}
                  </div>
                ) : (
                  <div>

                    <textarea
                      value={
                        editedTranscript
                      }
                      onChange={(e) =>
                        setEditedTranscript(
                          e.target.value
                        )
                      }
                      className="transcript-editor"
                      placeholder="Edit your transcript here..."
                    />

                    <div className="transcript-actions">

                      <button
                        className="save-button"
                        onClick={
                          saveTranscript
                        }
                        disabled={
                          savingTranscript
                        }
                      >
                        {savingTranscript
                          ? "Saving..."
                          : "Save transcript"}
                      </button>

                      <button
                        className="cancel-button"
                        onClick={
                          cancelTranscriptEditing
                        }
                        disabled={
                          savingTranscript
                        }
                      >
                        Cancel
                      </button>

                    </div>

                  </div>
                )}

              </div>
              <VideoChatbot
  transcript={transcript}
  title={title}
  summary={summary}
  metadata={youtubeMetadata}
  videoId={selectedVideoId}
/>

              {/* =================================================
                  TRANSCRIPT TIMELINE
                  ================================================= */}

              <div className="timeline-card">

                <div className="timeline-header">

                  <div className="insight-header">

                    <div className="insight-icon orange-bg">
                      ◷
                    </div>

                    <div>

                      <span>
                        SEARCHABLE MOMENTS
                      </span>

                      <h3>
                        Transcript Timeline
                      </h3>

                    </div>

                  </div>

                  <span className="moment-count">
                    {timestamps.length}{" "}
                    moments
                  </span>

                </div>

                {timestamps.length >
                0 ? (
                  <div className="timeline-list">

                    {timestamps.map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          className="timeline-item"
                          key={
                            index
                          }
                        >

                          <button
                            className="timeline-time"
                            onClick={() =>
                              handleTimestampClick(
                                item.start
                              )
                            }
                          >
                            ▶{" "}
                            {formatTime(
                              item.start
                            )}
                          </button>

                          <button
                            className="timeline-text"
                            onClick={() =>
                              handleTimestampClick(
                                item.start
                              )
                            }
                          >
                            {item.text}
                          </button>

                        </div>
                      )
                    )}

                  </div>
                ) : (
                  <div className="timeline-empty">
                    No timestamps available.
                  </div>
                )}

              </div>

              {/* =================================================
                  USAGE & CONTENT INSIGHTS REPORT
                  ================================================= */}

              <section
                id="reports-section"
                className="reports-section"
              >

                <div className="analysis-heading">

                  <div>

                    <span className="section-eyebrow">
                      REPORTING
                    </span>

                    <h2>
                      Usage & Content Insights
                    </h2>

                    <p>
                      Analytics generated from
                      your video analysis workflow.
                    </p>

                  </div>

                  <div className="analysis-status">

                    <span>
                    </span>

                    Report ready

                  </div>

                </div>

                {/* USAGE REPORT */}

                <div className="report-grid">

                  <div className="report-card">

                    <div className="report-icon purple-bg">
                      ◈
                    </div>

                    <div>

                      <span>
                        VIDEOS ANALYZED
                      </span>

                      <strong>
                        {totalVideos}
                      </strong>

                      <p>
                        Total videos processed
                        in your library.
                      </p>

                    </div>

                  </div>

                  <div className="report-card">

                    <div className="report-icon blue-bg">
                      ◷
                    </div>

                    <div>

                      <span>
                        TOTAL PROCESSING TIME
                      </span>

                      <strong>
                        {formatTime(
                          totalDuration
                        )}
                      </strong>

                      <p>
                        Combined duration of
                        analyzed videos.
                      </p>

                    </div>

                  </div>

                  <div className="report-card">

                    <div className="report-icon green-bg">
                      Aa
                    </div>

                    <div>

                      <span>
                        WORDS PROCESSED
                      </span>

                      <strong>
                        {totalWords.toLocaleString()}
                      </strong>

                      <p>
                        Total transcript words
                        generated by analysis.
                      </p>

                    </div>

                  </div>

                  <div className="report-card">

                    <div className="report-icon orange-bg">
                      #
                    </div>

                    <div>

                      <span>
                        KEYWORDS EXTRACTED
                      </span>

                      <strong>
                        {totalKeywords}
                      </strong>

                      <p>
                        Content topics extracted
                        across your library.
                      </p>

                    </div>

                  </div>

                </div>

                {/* CURRENT VIDEO CONTENT INSIGHTS */}

                <div className="report-detail-grid">

                  <div className="report-detail-card">

                    <div className="report-detail-header">

                      <div>

                        <span>
                          CONTENT INTELLIGENCE
                        </span>

                        <h3>
                          Current Video Insights
                        </h3>

                      </div>

                      <div className="report-icon purple-bg">
                        ✦
                      </div>

                    </div>

                    <div className="report-metrics">

                      <div className="report-metric">

                        <span>
                          Video duration
                        </span>

                        <strong>
                          {formatTime(
                            duration
                          )}
                        </strong>

                      </div>

                      <div className="report-metric">

                        <span>
                          Transcript segments
                        </span>

                        <strong>
                          {timestamps.length}
                        </strong>

                      </div>

                      <div className="report-metric">

                        <span>
                          Keywords identified
                        </span>

                        <strong>
                          {keywords.length}
                        </strong>

                      </div>

                      <div className="report-metric">

                        <span>
                          Key highlights
                        </span>

                        <strong>
                          {keyMoments.length}
                        </strong>

                      </div>

                    </div>

                  </div>

                  <div className="report-detail-card">

                    <div className="report-detail-header">

                      <div>

                        <span>
                          CONTENT PERFORMANCE
                        </span>

                        <h3>
                          Analysis Metrics
                        </h3>

                      </div>

                      <div className="report-icon blue-bg">
                        ◇
                      </div>

                    </div>

                    <div className="report-metrics">

                      <div className="report-metric">

                        <span>
                          Words per minute
                        </span>

                        <strong>
                          {averageWordsPerMinute}
                        </strong>

                      </div>

                      <div className="report-metric">

                        <span>
                          Highlight ratio
                        </span>

                        <strong>
                          {highlightCoverage}%
                        </strong>

                      </div>

                      <div className="report-metric">

                        <span>
                          Timeline segments
                        </span>

                        <strong>
                          {timestamps.length}
                        </strong>

                      </div>

                      <div className="report-metric">

                        <span>
                          Analysis status
                        </span>

                        <strong className="ready-text">
                          Complete
                        </strong>

                      </div>

                    </div>

                  </div>

                </div>

                {/* LIBRARY USAGE SUMMARY */}

                <div className="usage-summary-card">

                  <div className="usage-summary-header">

                    <div>

                      <span>
                        LIBRARY USAGE REPORT
                      </span>

                      <h3>
                        ClipMind Processing Overview
                      </h3>

                    </div>

                    <div className="report-icon green-bg">
                      ✓
                    </div>

                  </div>

                  <div className="usage-summary-content">

                    <p>
                      ClipMind has analyzed{" "}
                      <strong>
                        {totalVideos}
                      </strong>{" "}
                      {totalVideos === 1
                        ? "video"
                        : "videos"}{" "}
                      with a combined duration of{" "}
                      <strong>
                        {formatTime(
                          totalDuration
                        )}
                      </strong>
                      .
                    </p>

                    <p>
                      The system has processed{" "}
                      <strong>
                        {totalWords.toLocaleString()}
                      </strong>{" "}
                      transcript words and generated{" "}
                      <strong>
                        {totalKeywords}
                      </strong>{" "}
                      keyword entries across the
                      video library.
                    </p>

                    <p>
                      The current video contains{" "}
                      <strong>
                        {keyMoments.length}
                      </strong>{" "}
                      AI-detected highlights and{" "}
                      <strong>
                        {timestamps.length}
                      </strong>{" "}
                      searchable transcript segments.
                    </p>

                  </div>

                </div>

              </section>

            </section>
          )}

        </div>

        {/* ================= FOOTER ================= */}

        <footer className="dashboard-footer">

          <div>

            <strong>
              ClipMind AI
            </strong>

            <span>
              Intelligent Video Analysis
            </span>

          </div>

          <span>
            Built with React • FastAPI • Whisper
          </span>

        </footer>

      </main>

    </div>
  );
}

export default Dashboard;