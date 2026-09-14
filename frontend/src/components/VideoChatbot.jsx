import { useState } from "react";
import api from "../services/api";


function VideoChatbot({
  transcript,
  title,
  summary,
  metadata,
  videoId
}) {

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);


  const askQuestion = async () => {

    if (!question.trim()) {
      return;
    }

    if (!transcript?.trim()) {
      return;
    }

    const userQuestion =
      question.trim();

    setMessages((previous) => [
      ...previous,
      {
        type: "user",
        text: userQuestion
      }
    ]);

    setQuestion("");
    setLoading(true);


    try {

      const response = await api.post(
        "/chat",
        {
          question: userQuestion,
          transcript: transcript,
          title: title || "Current Video",
          summary: summary || "",
          metadata: metadata || {},
          video_id: videoId || 0
        }
      );


      setMessages((previous) => [
        ...previous,
        {
          type: "bot",
          text:
            response.data.answer ||
            "I could not find an answer in this video."
        }
      ]);

    } catch (error) {

      console.error(
        "Chatbot error:",
        error
      );

      setMessages((previous) => [
        ...previous,
        {
          type: "bot",
          text:
            error.response?.data?.detail ||
            "Sorry, I could not answer that question."
        }
      ]);

    } finally {

      setLoading(false);

    }
  };


  return (

    <div
      style={{
        marginTop: "32px",
        padding: "28px",
        borderRadius: "18px",
        border:
          "1px solid rgba(255,255,255,0.08)",
        background:
          "rgba(255,255,255,0.02)"
      }}
    >

      <div className="section-heading">

        <div>

          <span className="section-eyebrow">
            AI ASSISTANT
          </span>

          <h2>
            Ask about this video
          </h2>

          <p>
            Ask questions and get answers
            from the analyzed video.
          </p>

        </div>

      </div>


      <div
        style={{
          marginTop: "20px",
          minHeight: "100px",
          maxHeight: "none",
          overflowY: "visible",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}
      >

        {messages.length === 0 && (

          <div
            style={{
              padding: "18px",
              borderRadius: "12px",
              background:
                "rgba(255,255,255,0.03)",
              color: "#9ca3af",
              lineHeight: "1.7"
            }}
          >

            Try asking:

            <br />

            • What is this video about?

            <br />

            • What are the main points?

            <br />

            • What information is mentioned?

          </div>

        )}


        {messages.map(
          (message, index) => (

            <div
              key={index}
              style={{
                alignSelf:
                  message.type === "user"
                    ? "flex-end"
                    : "flex-start",

                maxWidth: "80%",

                padding:
                  "12px 16px",

                borderRadius:
                  "14px",

                background:
                  message.type === "user"
                    ? "rgba(99,102,241,0.18)"
                    : "rgba(255,255,255,0.05)",

                color: "#e5e7eb",

                lineHeight: "1.5"
              }}
            >

              <strong>

                {message.type === "user"
                  ? "You"
                  : "ClipMind AI"}

              </strong>


              <div
                style={{
                  marginTop: "5px"
                }}
              >

                {message.text}

              </div>

            </div>

          )
        )}


        {loading && (

          <div
            style={{
              alignSelf: "flex-start",
              padding: "12px 16px",
              borderRadius: "14px",
              background:
                "rgba(255,255,255,0.05)",
              color: "#9ca3af"
            }}
          >

            ClipMind AI is thinking...

          </div>

        )}

      </div>


      <div
        style={{
          display: "flex",
          gap: "10px",
          marginTop: "18px"
        }}
      >

        <input
          type="text"
          value={question}
          onChange={(event) =>
            setQuestion(
              event.target.value
            )
          }
          onKeyDown={(event) => {

            if (
              event.key === "Enter"
            ) {
              askQuestion();
            }

          }}
          placeholder=
            "Ask something about this video..."
          disabled={loading}
          style={{
            flex: 1
          }}
        />


        <button
          className="primary-button"
          onClick={askQuestion}
          disabled={
            loading ||
            !question.trim()
          }
        >

          {loading
            ? "Thinking..."
            : "Ask AI"}

        </button>

      </div>

    </div>

  );
}


export default VideoChatbot;