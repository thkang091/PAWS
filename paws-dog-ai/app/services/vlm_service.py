"""
VLM-based activity verifier using Google Gemini 2.5 Flash.

Samples frames directly from the video (no DLC required) and asks the
vision-language model whether the dog performed the requested activity.

Free tier limit: 10 requests/minute for gemini-2.5-flash.
This is experimental -- not certified for production use.
"""

from __future__ import annotations

import base64
import json
import os
import re
import time

import cv2


_MODEL = "gemini-2.5-flash"
_MAX_FRAMES = 8
_JPEG_QUALITY = 80


def _sample_frames(video_path: str, n: int = _MAX_FRAMES) -> tuple[list[bytes], list[str]]:
    """
    Return n evenly-spaced frames as (raw_bytes, base64_strings).
    raw_bytes goes to the VLM; base64_strings goes back to the client for display.
    """
    cap = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        cap.release()
        return [], []

    indices = [int(i * total / n) for i in range(n)]
    raw: list[bytes] = []
    b64: list[str] = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = cap.read()
        if not ok:
            continue
        h, w = frame.shape[:2]
        long_edge = max(h, w)
        if long_edge > 768:
            scale = 768 / long_edge
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)))
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, _JPEG_QUALITY])
        jpeg = buf.tobytes()
        raw.append(jpeg)
        b64.append(base64.b64encode(jpeg).decode())
    cap.release()
    return raw, b64


_SYSTEM_PROMPT = """\
You are an expert dog trainer and animal behavior analyst.
You will receive a sequence of video frames showing a dog, and a description of an activity to verify.
Your task: determine whether the dog successfully performed the activity by the end of the clip.

Reply ONLY with a JSON object (no markdown, no code block):
{
  "verdict": "pass" | "fail",
  "confidence": <float 0.0-1.0>,
  "reasoning": "<one or two sentences — be specific about what you observed in the frames>"
}

Rules:
- "pass" means the dog clearly performed the activity as described in at least the last portion of the clip.
- "fail" means the dog did not perform it, or the video is too unclear to judge.
- confidence is how certain you are (0.0 = total guess, 1.0 = certain).
- Be specific: mention what you actually saw (e.g. "the dog's belly is touching the ground in frames 6-8" or "the dog is sitting upright with hips raised in all frames").
"""


def verify_with_vlm(
    video_path: str,
    activity_prompt: str,
) -> dict:
    """
    Run Gemini 2.5 Flash on sampled frames of the video.

    Returns a dict with keys:
        verdict: "pass" | "fail" | "error"
        confidence: float
        reasoning: str
        model: str
        latency_ms: int
        frame_count: int
        preview_frames: list[str]  base64 JPEGs
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return {
            "verdict": "error",
            "confidence": 0.0,
            "reasoning": "GEMINI_API_KEY is not set in the backend environment.",
            "model": _MODEL,
            "latency_ms": 0,
            "frame_count": 0,
            "preview_frames": [],
        }

    from google import genai                        # noqa: PLC0415
    from google.genai import types as genai_types   # noqa: PLC0415

    client = genai.Client(api_key=api_key)

    raw_frames, b64_frames = _sample_frames(video_path, _MAX_FRAMES)
    if not raw_frames:
        return {
            "verdict": "error",
            "confidence": 0.0,
            "reasoning": "Could not extract frames from the video.",
            "model": _MODEL,
            "latency_ms": 0,
            "frame_count": 0,
            "preview_frames": [],
        }

    # Build content list: text description + inline image parts.
    parts: list = [
        genai_types.Part.from_text(
            text=(
                f"Activity to verify: {activity_prompt}\n\n"
                f"Below are {len(raw_frames)} frames sampled evenly from the video clip "
                f"(left to right = start to end of recording)."
            )
        )
    ]
    for jpeg_bytes in raw_frames:
        parts.append(
            genai_types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg")
        )

    try:
        t0 = time.time()
        response = client.models.generate_content(
            model=_MODEL,
            contents=parts,
            config=genai_types.GenerateContentConfig(
                system_instruction=_SYSTEM_PROMPT,
                temperature=0.1,
                max_output_tokens=256,
            ),
        )
        latency_ms = int((time.time() - t0) * 1000)
    except Exception as exc:
        err = str(exc)
        # Surface rate-limit errors clearly instead of crashing.
        if "RESOURCE_EXHAUSTED" in err or "429" in err or "quota" in err.lower():
            return {
                "verdict": "error",
                "confidence": 0.0,
                "reasoning": (
                    "Gemini free tier rate limit hit (5 requests/minute). "
                    "Wait about 60 seconds and try again, or add billing at "
                    "console.cloud.google.com to raise the limit."
                ),
                "model": _MODEL,
                "latency_ms": 0,
                "frame_count": len(raw_frames),
                "preview_frames": b64_frames,
            }
        return {
            "verdict": "error",
            "confidence": 0.0,
            "reasoning": f"Gemini API error: {err[:200]}",
            "model": _MODEL,
            "latency_ms": 0,
            "frame_count": len(raw_frames),
            "preview_frames": b64_frames,
        }

    raw = response.text.strip()

    # Strip markdown code fences.
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    # Extract the first JSON object anywhere in the response.
    json_match = re.search(r"\{.*\}", raw, re.DOTALL)
    if json_match:
        raw = json_match.group(0)

    try:
        parsed = json.loads(raw)
        return {
            "verdict":        parsed.get("verdict", "fail"),
            "confidence":     float(parsed.get("confidence", 0.5)),
            "reasoning":      parsed.get("reasoning", ""),
            "model":          _MODEL,
            "latency_ms":     latency_ms,
            "frame_count":    len(raw_frames),
            "preview_frames": b64_frames,
        }
    except (json.JSONDecodeError, ValueError):
        verdict = "pass" if "pass" in raw.lower() else "fail"
        return {
            "verdict":        verdict,
            "confidence":     0.5,
            "reasoning":      raw[:300],
            "model":          _MODEL,
            "latency_ms":     latency_ms,
            "frame_count":    len(raw_frames),
            "preview_frames": b64_frames,
        }
