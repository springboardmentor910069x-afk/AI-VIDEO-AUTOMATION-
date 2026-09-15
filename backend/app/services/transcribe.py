import whisper

model = None


def transcribe_video(video_path):
    global model

    if model is None:
        model = whisper.load_model("small.en")

    result = model.transcribe(
        video_path,
        language="en",
        task="transcribe",
        temperature=0,
        condition_on_previous_text=True,
        fp16=False
    )

    transcript = result["text"].strip()

    timestamps = []

    for segment in result["segments"]:
        text = segment["text"].strip()

        if text:
            timestamps.append({
                "start": round(segment["start"], 2),
                "end": round(segment["end"], 2),
                "text": text
            })

    return transcript, timestamps