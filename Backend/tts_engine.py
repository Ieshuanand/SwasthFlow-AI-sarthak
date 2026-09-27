"""SwasthFlow AI — Offline TTS Voice Note Engine (Phase 6).
Generates voice notes completely offline with ZERO cloud or external dependencies.

Primary Engine:
  - Piper Neural TTS with bundled ONNX model (hi_IN-pratham-medium).
  - Genuine Hindi Devanagari speech synthesis on CPU.

Fallback Engine:
  - Windows SAPI5 via pyttsx3 (for English / system fallback).
"""

import os
import wave
from typing import Dict, Any, Optional

AUDIO_DIR = os.path.join(os.path.dirname(__file__), "static", "audio")
PIPER_MODEL_DIR = os.path.join(os.path.dirname(__file__), "static", "piper_models")

os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(PIPER_MODEL_DIR, exist_ok=True)

PIPER_MODEL_PATH = os.path.join(PIPER_MODEL_DIR, "hi_IN-pratham-medium.onnx")
PIPER_CONFIG_PATH = os.path.join(PIPER_MODEL_DIR, "hi_IN-pratham-medium.onnx.json")

# Global singleton piper voice instance
_piper_voice = None
_piper_loaded = False


def _get_piper_voice():
    global _piper_voice, _piper_loaded
    if not _piper_loaded:
        if os.path.exists(PIPER_MODEL_PATH) and os.path.exists(PIPER_CONFIG_PATH):
            try:
                from piper.voice import PiperVoice
                _piper_voice = PiperVoice.load(PIPER_MODEL_PATH, config_path=PIPER_CONFIG_PATH)
                _piper_loaded = True
            except Exception as e:
                print(f"[TTS WARNING] Failed to load Piper model: {e}")
                _piper_voice = None
                _piper_loaded = True
        else:
            _piper_loaded = True
    return _piper_voice


def synthesize_task_audio(
    task_id: str,
    role: str,
    title_hi: str,
    reason_hi: str,
    deadline_str: str,
    title_en: Optional[str] = None
) -> Dict[str, Any]:
    """Synthesizes a voice note for a frontline staff task.
    Saves to backend/static/audio/{task_id}.wav and returns URL path."""
    wav_filename = f"{task_id}.wav"
    wav_path = os.path.join(AUDIO_DIR, wav_filename)

    # Check cache: return if already generated and non-empty
    if os.path.exists(wav_path) and os.path.getsize(wav_path) > 1000:
        return {
            "task_id": task_id,
            "filename": wav_filename,
            "audio_url": f"/static/audio/{wav_filename}",
            "file_size": os.path.getsize(wav_path),
            "cached": True,
            "engine": "cached"
        }

    # Role translation to Hindi
    role_map_hi = {
        "PHLEBOTOMY": "फ्लेबोटोमी टीम",
        "BILLING": "बिलिंग डेस्क",
        "CLEANING": "हाउसकीपिंग स्टाफ",
        "HOUSEKEEPING": "हाउसकीपिंग स्टाफ",
        "PORTER": "वार्ड अटेंडेंट और पोर्टर",
        "NURSE": "नर्सिंग इन-चार्ज"
    }
    role_hi = role_map_hi.get(role.upper(), role)

    # Clean Devanagari text for speech synthesis
    hindi_speech_text = (
        f"नमस्ते। स्वास्थ्यफ्लो कार्य सूचना: {role_hi} के लिए। "
        f"{title_hi}। {reason_hi}। "
        f"समय सीमा: {deadline_str}। "
        f"कृपया कार्य पूरा होने पर व्हाट्सएप पर पुष्टि करें।"
    )

    voice = _get_piper_voice()
    engine_used = "piper_onnx_hindi"

    if voice is not None:
        try:
            with wave.open(wav_path, "wb") as wav_file:
                voice.synthesize_wav(hindi_speech_text, wav_file)
        except Exception as e:
            print(f"[TTS ERROR] Piper synthesis failed, falling back to pyttsx3: {e}")
            engine_used = _fallback_pyttsx3(wav_path, title_en or title_hi, role, deadline_str)
    else:
        engine_used = _fallback_pyttsx3(wav_path, title_en or title_hi, role, deadline_str)

    file_size = os.path.getsize(wav_path) if os.path.exists(wav_path) else 0

    return {
        "task_id": task_id,
        "filename": wav_filename,
        "audio_url": f"/static/audio/{wav_filename}",
        "file_size": file_size,
        "cached": False,
        "engine": engine_used
    }


def _fallback_pyttsx3(wav_path: str, title: str, role: str, deadline_str: str) -> str:
    """Fallback synthesis using Windows SAPI5 in English."""
    try:
        import pyttsx3
        engine = pyttsx3.init()
        speech_text = f"SwasthFlow Task Alert for {role}. {title}. Scheduled deadline {deadline_str}. Please confirm upon completion."
        engine.save_to_file(speech_text, wav_path)
        engine.runAndWait()
        return "pyttsx3_sapi5"
    except Exception as ex:
        print(f"[TTS SAPI5 ERROR] pyttsx3 fallback failed: {ex}")
        # Create a minimal empty valid wav file so endpoints don't 404
        with wave.open(wav_path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(b"\x00" * 3200)
        return "dummy_wav"
