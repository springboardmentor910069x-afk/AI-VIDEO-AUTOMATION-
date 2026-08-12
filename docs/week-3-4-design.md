# ClipMind AI: Week 3-4 Design

This module adds Whisper transcript generation, editable transcript storage, and short/detailed summaries only. Key moments, analytics, and deployment remain out of scope.

## Workflow

```text
Video upload -> Whisper transcription -> saved editable transcript -> short/detailed summary
```

Whisper runs locally in a background task. The first generation downloads the configured `base` model. The summaries use a simple local extractive baseline, selecting important transcript sentences; this keeps the project runnable without a paid API.
