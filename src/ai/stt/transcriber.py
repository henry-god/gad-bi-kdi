"""
Khmer Speech-to-Text Transcriber

Phase 1-3: NOT ACTIVE
Phase 4: Whisper API → raw Khmer transcript → cleaned text
Phase 6: Whisper-Khmer fine-tuned + speaker diarization

Entry point: transcribe(audio_path) → TranscriptResult

TODO (Claude Code - Phase 4):
- Accept audio file (MP3/WAV/M4A)
- Call Whisper API with language="km"
- Get raw transcript with timestamps
- Pass through cleaner for government-context cleaning
- Return cleaned transcript with speaker labels (if diarization enabled)
"""

from dataclasses import dataclass, field


@dataclass
class TranscriptSegment:
    text: str
    start: float  # seconds
    end: float
    speaker: str = "unknown"
    confidence: float = 0.0


@dataclass
class TranscriptResult:
    raw_text: str = ""
    cleaned_text: str = ""
    segments: list[TranscriptSegment] = field(default_factory=list)
    language: str = "km"
    duration_seconds: float = 0.0


def transcribe(audio_path: str) -> TranscriptResult:
    raise NotImplementedError("STT not yet implemented. Coming in Phase 4.")
