import os
import ssl
import time

# Point Python's SSL context at certifi's CA bundle before any network calls.
# Required on macOS where the system Python cert store is not auto-populated.
try:
    import certifi
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
    ssl._create_default_https_context = ssl.create_default_context  # noqa: SLF001
except ImportError:
    pass

from fastapi import FastAPI, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.classifiers.sit_classifier import SitClassifier
from app.classifiers.trick_classifier import TrickClassifier
from app.classifiers.trick_combo_classifier import COMBO_PREFIX, TrickComboClassifier
from app.models.hybrid_models import HybridVerificationInput, VerificationTier
from app.models.request_models import ActivityAnalysisRequest
from app.models.response_models import ActivityAnalysisResponse
from app.routers.activity_definitions import router as activity_definitions_router
from app.routers.admin import router as admin_router
from app.routers.anti_cheat import router as anti_cheat_router
from app.routers.dev_tools import router as dev_router
from app.routers.review import router as review_router
from app.services.dependency_service import dependency_report
from app.services.hybrid_verification_service import (
    decide_routing,
    hybrid_result_to_response,
    run_hybrid_verification,
)
from app.services.pose_inference_service import PoseInferenceService
from app.services.verification_persistence_service import persist_verification
from app.services.video_validation_service import VideoValidationService
from app.utils.logging import log_info, log_warn

app = FastAPI(title="PAWS Dog AI", version=settings.service_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(admin_router)
app.include_router(activity_definitions_router)
app.include_router(dev_router)
app.include_router(review_router)
app.include_router(anti_cheat_router)

# Dedicated classifiers for tricks that have a full pose-based implementation.
# All other activity_ids are handled by the generic TrickClassifier, which
# looks up per-trick config from the trick vocabulary.
_sit_classifier = SitClassifier()
_generic_classifier = TrickClassifier()
_combo_classifier = TrickComboClassifier()


def _get_classifier(activity_id: str) -> SitClassifier | TrickClassifier | TrickComboClassifier:
    if activity_id == "sit":
        return _sit_classifier
    if activity_id.startswith(COMBO_PREFIX):
        return _combo_classifier
    return _generic_classifier


def _error_response(request: ActivityAnalysisRequest, error: str) -> ActivityAnalysisResponse:
    return ActivityAnalysisResponse(
        verification_id=request.verification_id,
        activity_id=request.activity_id,
        status="error",
        confidence_score=None,
        model_name=None,
        analysis_summary=None,
        failure_reason=error,
        retry_guidance="Record a fresh in-app video and try again.",
    )


# ---------------------------------------------------------------------------
# Anti-cheat helper
# ---------------------------------------------------------------------------

# Tiers that require anti-cheat checks before a reward can be awarded.
# Standard daily and premium challenges use lighter-weight enforcement that
# does not go through the full anti-cheat service.
_ANTI_CHEAT_TIERS = frozenset({
    VerificationTier.GOLD_COIN_REWARD,
    VerificationTier.TOURNAMENT,
})


def _maybe_apply_anti_cheat(
    request: ActivityAnalysisRequest,
    result: ActivityAnalysisResponse,
) -> ActivityAnalysisResponse:
    """
    Run anti-cheat checks for high-stakes tiers (gold_coin_reward, tournament).

    For other tiers the result passes through unchanged.

    Anti-cheat decisions:
    - proceed:       reward eligible; call award_if_eligible.
    - review:        enqueue for manual review via maybe_enqueue; reward held.
    - block_reward:  reward blocked; response status updated to indicate hold.

    All DB writes (audit, award) are fire-and-forget inside their respective
    service methods and will not raise on failure.
    """
    if request.verification_tier not in _ANTI_CHEAT_TIERS:
        return result

    # Only run anti-cheat when the attempt has a clear outcome (passed or
    # failed).  Retry and manual-review statuses should not block rewards that
    # haven't been granted yet.
    if result.status not in ("passed", "failed"):
        return result

    try:
        from app.services.anti_cheat_service import AntiCheatService  # noqa: PLC0415
        from app.services.reward_service import award_if_eligible       # noqa: PLC0415

        decision = AntiCheatService().run_checks(
            request=request,
            pose_frames=[],
            fused_confidence=result.confidence_score or 0.0,
            assistance_likelihood=0.0,
            multiple_dog_score=0.0,
            video_bytes=b"",
            selected_frame_pixel_lists=[],
        )

        if decision.decision == "proceed":
            # Award only when the pose/hybrid result was a pass.
            if result.status == "passed":
                award_if_eligible(
                    verification_id=request.verification_id,
                    reward_eligible=True,
                )
            return result

        if decision.decision == "review":
            from app.services.review_service import maybe_enqueue  # noqa: PLC0415
            maybe_enqueue(
                request,
                result,
                {},
                shadow_disagrees=True,
            )
            return result

        # block_reward: update status to reflect reward hold.
        return ActivityAnalysisResponse(
            verification_id=result.verification_id,
            activity_id=result.activity_id,
            status="pending_manual_review",
            confidence_score=result.confidence_score,
            model_name=result.model_name,
            analysis_summary=result.analysis_summary,
            failure_reason="Reward held pending anti-cheat review.",
            retry_guidance=None,
        )

    except Exception:  # noqa: BLE001
        # Anti-cheat checks must never crash the user-facing response.
        log_warn(
            "main",
            "anti_cheat_error",
            verification_id=request.verification_id,
            tier=request.verification_tier,
        )
        return result


# ---------------------------------------------------------------------------
# Metrics recording helper
# ---------------------------------------------------------------------------

def _record_metrics(
    request: ActivityAnalysisRequest,
    result: ActivityAnalysisResponse,
    inference_latency_ms: int,
    *,
    is_fallback: bool = False,
    disagreed: bool = False,
) -> None:
    """
    Fire-and-forget metrics recording.  Never raises.

    Records to both the comprehensive metrics_service (in-memory + DB) and the
    legacy sit-only metrics_service in app/ml (for rollout dashboards).

    Also records on-device telemetry when device_metadata is present.
    """
    try:
        from app.services.metrics_service import (  # noqa: PLC0415
            record_device_metrics,
            record_verification,
        )
        from app.models.monitoring_models import (  # noqa: PLC0415
            ComponentType,
            DeviceMetricsRecord,
        )

        status = result.status
        is_error        = status == "error"
        is_low_quality  = status in ("low_quality", "retry_low_quality")
        is_manual_review = status == "pending_manual_review"
        is_fraud_review = False  # set by anti-cheat; use pending_manual_review as proxy

        record_verification(
            model_version=settings.pose_model_version,
            component_type=ComponentType.POSE_CLASSIFIER,
            activity_id=request.activity_id,
            tier=request.verification_tier,
            verification_id=request.verification_id,
            status=status,
            confidence_score=result.confidence_score,
            inference_latency_ms=inference_latency_ms,
            is_error=is_error,
            is_fallback=is_fallback,
            is_low_quality=is_low_quality,
            is_manual_review=is_manual_review,
            is_fraud_review=is_fraud_review,
            disagreed=disagreed,
            used_on_device_pose=bool(request.device_metadata),
            fell_back_to_video=bool(request.device_metadata.get("fell_back_to_video")),
        )

        # On-device telemetry.
        if request.device_metadata:
            dm = request.device_metadata
            record_device_metrics(DeviceMetricsRecord(
                verification_id=request.verification_id,
                user_id=request.user_id,
                iphone_model=dm.get("iphone_model"),
                ios_version=dm.get("ios_version"),
                app_version=dm.get("app_version"),
                on_device_pose_version=dm.get("on_device_pose_version"),
                frame_inference_latency_ms=dm.get("frame_inference_latency_ms"),
                dropped_frame_rate=dm.get("dropped_frame_rate"),
                payload_size_bytes=dm.get("payload_size_bytes"),
                fell_back_to_video=bool(dm.get("fell_back_to_video")),
            ))
    except Exception:  # noqa: BLE001
        pass


# ---------------------------------------------------------------------------
# Hybrid verification helper
# ---------------------------------------------------------------------------

# Statuses that represent definitive recording-quality or capability
# diagnoses.  These bypass hybrid verification because:
#   - The classifier already gave the most specific guidance possible.
#   - RGB visual verification adds no useful signal.
#   - Overwriting these statuses degrades the user-facing retry guidance.
_DEFINITIVE_BYPASS_STATUSES = frozenset({
    "unsupported_activity",  # trick has no classifier
    "error",                 # video validation or server error
    "retry_too_short",       # recording too short — user action is clear
    "retry_dog_not_visible", # dog not in frame — user action is clear
    "low_quality",           # fundamental recording quality failure
})


def _maybe_apply_hybrid(
    request: ActivityAnalysisRequest,
    pose_result: ActivityAnalysisResponse,
    pose_summary,
    inference_latency_ms: int,
) -> ActivityAnalysisResponse:
    """
    After the pose classifier has produced a result, decide whether to route
    through the hybrid verification pipeline.

    If the routing decision is fast_pose, the pose_result is returned
    unchanged.  Otherwise run_hybrid_verification() is called and its output
    is converted to an ActivityAnalysisResponse.

    Definitively diagnostic statuses (no confidence score, recording-quality
    failures, unsupported tricks) bypass hybrid entirely so the user receives
    the most specific guidance from the classifier.

    All hybrid side-effects (audit log, review queue) happen here so the
    caller's code remains identical for both paths.
    """
    # Bypass: no confidence value or a definitive recording/capability diagnosis.
    if (
        pose_result.confidence_score is None
        or pose_result.status in _DEFINITIVE_BYPASS_STATUSES
    ):
        return pose_result
    from app.services.anomaly_service import compute_anomaly_score   # noqa: PLC0415
    from app.services.pose_quality_service import compute_quality     # noqa: PLC0415

    quality_report = compute_quality(pose_summary)
    quality_flags = quality_report.flags.model_dump()

    anomaly_report = compute_anomaly_score(
        quality_flags=quality_flags,
        multiple_dogs_detected=pose_summary.multiple_dogs_detected,
        recording_metadata=request.recording_metadata,
        verification_id=request.verification_id,
    )

    routing = decide_routing(
        tier=request.verification_tier,
        pose_confidence=pose_result.confidence_score or 0.0,
        quality_flags=quality_flags,
        multiple_dogs_detected=pose_summary.multiple_dogs_detected,
        anomaly_score=anomaly_report.score,
    )

    if routing.path == "fast_pose":
        # Standard path: use the pose result as-is and enqueue for review if
        # needed using the existing review_service logic.
        from app.services.review_service import maybe_enqueue  # noqa: PLC0415
        maybe_enqueue(
            request,
            pose_result,
            quality_flags,
            shadow_disagrees=False,
        )
        final = _maybe_apply_anti_cheat(request, pose_result)
        return final

    # Hybrid or direct_manual_review path.
    hybrid_input = HybridVerificationInput(
        verification_id=request.verification_id,
        activity_id=request.activity_id,
        tier=request.verification_tier,
        pose_confidence=pose_result.confidence_score or 0.0,
        pose_classifier_status=pose_result.status,
        quality_flags=quality_flags,
        multiple_dogs_detected=pose_summary.multiple_dogs_detected,
        recording_metadata=request.recording_metadata,
        selected_frame_paths=request.selected_frame_paths,
        dog_crop_path=request.dog_crop_path,
        requested_trick=request.activity_id,
    )

    fused = run_hybrid_verification(
        input_=hybrid_input,
        request=request,
        pose_model_version=settings.pose_model_version,
    )

    hybrid_response = hybrid_result_to_response(fused, request, settings.pose_model_version)

    # Enqueue for manual review when the hybrid pipeline decided so.
    if fused.final_status == "manual_review" and fused.enqueue_reason:
        from app.services.review_service import maybe_enqueue  # noqa: PLC0415
        # Override the review queue decision: always enqueue, pass the reason.
        # We pass shadow_disagrees=True as a lightweight way to force enqueue;
        # the enqueue_reason in the hybrid result is more precise.
        maybe_enqueue(
            request,
            hybrid_response,
            quality_flags,
            shadow_disagrees=True,
        )

    final = _maybe_apply_anti_cheat(request, hybrid_response)
    return final


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    dependencies = dependency_report()
    return {
        "status": "ok",
        "service_version": settings.service_version,
        "environment": settings.environment,
        "model_loaded": dependencies["pose_dependencies_ready"],
        "model_name": f"{settings.superanimal_name}_{settings.model_name}",
        "deeplabcut_version": dependencies["deeplabcut_version"],
        "torch_version": dependencies["torch_version"],
        "opencv_version": dependencies["opencv_version"],
        "gpu_available": dependencies["gpu_available"],
        "mock_mode": settings.dog_ai_enable_mock_mode,
        "primary_judge": "dog_pose_estimation",
        "llm_primary_judge": False,
    }


@app.post("/dev/analyze", response_model=ActivityAnalysisResponse)
def dev_analyze(request: ActivityAnalysisRequest) -> ActivityAnalysisResponse:
    """
    Developer-only endpoint. Skips video download and real inference entirely.
    Returns a realistic simulated result so the full frontend flow can be tested
    without a real video in storage or DeepLabCut installed.
    Only available when DOG_AI_ENABLE_MOCK_MODE=true.
    """
    if not settings.dog_ai_enable_mock_mode:
        from fastapi import HTTPException  # noqa: PLC0415
        raise HTTPException(status_code=403, detail="Dev analyze endpoint only available in mock mode.")

    import random  # noqa: PLC0415
    activity = request.activity_id
    confidence = round(random.uniform(0.62, 0.97), 3)
    passed = confidence >= 0.70

    return ActivityAnalysisResponse(
        verification_id=request.verification_id,
        activity_id=activity,
        status="passed" if passed else "failed",
        confidence_score=confidence,
        model_name=f"{activity}_rule_based_v1 [mock]",
        analysis_summary={
            "mock": True,
            "activity": activity,
            "tier": request.verification_tier,
            "modules": [
                {"module_name": "video_quality_gate",       "passed": True,  "confidence": 0.95, "reason_codes": ["VIDEO_QUALITY_OK"],      "latency_ms": 3,  "implementation_status": "available"},
                {"module_name": "pose_quality_gate",        "passed": True,  "confidence": 0.88, "reason_codes": ["POSE_QUALITY_OK"],        "latency_ms": 5,  "implementation_status": "available"},
                {"module_name": "pose_transition_detector", "passed": passed,"confidence": confidence, "reason_codes": ["SIT_TRANSITION_DETECTED"] if passed else ["SIT_POSITION_NOT_REACHED"], "latency_ms": 12, "implementation_status": "available"},
                {"module_name": "hold_duration_detector",   "passed": passed,"confidence": confidence, "reason_codes": ["HOLD_DURATION_SUFFICIENT"] if passed else ["HOLD_DURATION_INSUFFICIENT"], "latency_ms": 4,  "implementation_status": "available"},
            ],
        },
        failure_reason=None if passed else "The dog did not hold the sit position long enough.",
        retry_guidance=None if passed else "Make sure the dog holds the sit for at least 2 seconds before stopping the recording.",
    )


@app.post("/dev/infer", response_model=ActivityAnalysisResponse)
def dev_infer(
    video: UploadFile,
    activity_id: str = Form("sit"),
    verification_tier: str = Form("standard_daily"),
    verification_id: str | None = Form(None),
) -> ActivityAnalysisResponse:
    """
    Developer-only real inference endpoint.

    Accepts a video file as multipart/form-data and runs the full pose
    estimation + classifier pipeline without requiring Supabase storage.
    The video is saved to a temp file, analyzed, then deleted.

    Not gated behind mock mode — it IS the real inference path.
    Never used in production (no persistence, no anti-cheat, no audit log).
    """
    from fastapi import HTTPException  # noqa: PLC0415
    import tempfile, os, time  # noqa: PLC0415, E401

    vid_id = verification_id or f"dev-infer-{int(time.time() * 1000)}"

    # Save uploaded bytes to a temp file so OpenCV / DeepLabCut can open it.
    suffix = os.path.splitext(video.filename or "video.mp4")[1] or ".mp4"
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(video.file.read())
            tmp_path = tmp.name
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not save upload: {exc}") from exc

    fake_request = ActivityAnalysisRequest(
        verification_id=vid_id,
        user_id="dev-tester",
        dog_id="dev-dog",
        activity_id=activity_id,
        verification_mode="server",
        storage_path=tmp_path,
        context_type="reward",
        verification_tier=verification_tier,
        recording_metadata={},
        device_metadata={},
    )

    try:
        # Validate extension/path (reuse existing gate — tmp_path ends in .mp4/.mov).
        valid, error = VideoValidationService().validate(tmp_path)
        if not valid:
            return _error_response(fake_request, error or "Unsupported video format.")

        inference_start = time.monotonic()
        pose_summary = PoseInferenceService().analyze_video(tmp_path)
        inference_latency_ms = int((time.monotonic() - inference_start) * 1000)

        classifier = _get_classifier(activity_id)
        pose_result = classifier.analyze_pose_sequence(fake_request, pose_summary)

        log_info(
            "main",
            "dev_infer_result",
            verification_id=vid_id,
            activity_id=activity_id,
            status=pose_result.status,
            confidence=pose_result.confidence_score,
            inference_latency_ms=inference_latency_ms,
        )

        # Attach skeleton preview frames to analysis_summary for the dev UI.
        if pose_summary.preview_frames:
            existing = dict(pose_result.analysis_summary or {})
            existing["preview_frames"] = pose_summary.preview_frames
            existing["inference_latency_ms"] = inference_latency_ms
            pose_result = ActivityAnalysisResponse(
                **{**pose_result.model_dump(), "analysis_summary": existing}
            )

        return pose_result
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.post("/dev/infer-vlm")
def dev_infer_vlm(
    video: UploadFile,
    activity_prompt: str = Form(...),
    verification_id: str | None = Form(None),
) -> dict:
    """
    Developer-only VLM inference endpoint.

    Accepts a video file + natural-language description of the activity.
    Samples frames, sends them to Mistral Pixtral, and returns pass/fail
    with reasoning.  No DLC required — fast (~3-5 seconds).

    This endpoint is experimental.  Results reflect the VLM's general
    understanding of dog behavior and are not certified for production use.
    """
    import tempfile, os  # noqa: PLC0415, E401
    from app.services.vlm_service import verify_with_vlm  # noqa: PLC0415

    vid_id = verification_id or f"dev-vlm-{int(time.time() * 1000)}"

    suffix = os.path.splitext(video.filename or "video.mp4")[1] or ".mp4"
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(video.file.read())
            tmp_path = tmp.name
    except Exception as exc:
        from fastapi import HTTPException  # noqa: PLC0415
        raise HTTPException(status_code=400, detail=f"Could not save upload: {exc}") from exc

    try:
        result = verify_with_vlm(tmp_path, activity_prompt)
        result["verification_id"] = vid_id
        result["activity_prompt"] = activity_prompt
        return result
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.post("/analyze/activity", response_model=ActivityAnalysisResponse)
def analyze_activity(request: ActivityAnalysisRequest) -> ActivityAnalysisResponse:
    classifier = _get_classifier(request.activity_id)

    valid, error = VideoValidationService().validate(request.storage_path)
    if not valid:
        result = _error_response(request, error)
        persist_verification(request, result, None, None)
        return result

    inference_start = time.monotonic()
    pose_summary = PoseInferenceService().analyze_video(request.storage_path or "")
    inference_latency_ms = int((time.monotonic() - inference_start) * 1000)

    log_info(
        "main",
        "inference_latency",
        verification_id=request.verification_id,
        activity_id=request.activity_id,
        inference_latency_ms=inference_latency_ms,
        avg_confidence=pose_summary.average_confidence,
        frame_count=len(pose_summary.frames),
    )

    if request.activity_id != "sit":
        # Non-sit tricks use the TrickClassifier / TrickComboClassifier.
        pose_result = classifier.analyze_pose_sequence(request, pose_summary)

        log_info(
            "main",
            "classifier_output",
            verification_id=request.verification_id,
            activity_id=request.activity_id,
            status=pose_result.status,
            confidence=pose_result.confidence_score,
            failure_reason=pose_result.failure_reason,
        )

        # Apply hybrid routing for non-sit tricks as well.
        result = _maybe_apply_hybrid(request, pose_result, pose_summary, inference_latency_ms)
        persist_verification(request, result, pose_summary, inference_latency_ms)
        _record_metrics(request, result, inference_latency_ms)
        return result

    # --- Sit path (rule-based + learned rollout) ---

    low_conf_frames = [
        f.frame_index
        for f in pose_summary.frames
        if sum(kp.confidence for kp in f.keypoints.values()) / max(len(f.keypoints), 1)
        < settings.min_average_keypoint_confidence
    ]
    if low_conf_frames:
        log_warn(
            "main",
            "low_confidence_frames",
            verification_id=request.verification_id,
            low_confidence_frame_count=len(low_conf_frames),
            total_frames=len(pose_summary.frames),
        )

    rule_based_result = classifier.analyze_pose_sequence(request, pose_summary)

    log_info(
        "main",
        "rule_based_output",
        verification_id=request.verification_id,
        activity_id=request.activity_id,
        status=rule_based_result.status,
        confidence=rule_based_result.confidence_score,
        failure_reason=rule_based_result.failure_reason,
    )

    # Apply learned-model rollout (or shadow observation). The rollout service
    # returns the final result — for users outside the rollout, this is
    # identical to rule_based_result. For users inside the rollout the learned
    # model may override it, fall back, or return retry_uncertain.
    from app.ml.rollout_service import apply_rollout  # noqa: PLC0415
    pose_result, rollout_meta = apply_rollout(
        request=request,
        pose_summary=pose_summary,
        rule_based_result=rule_based_result,
        artifact_path=settings.ml_artifact_path,
        min_confidence=settings.learned_sit_min_confidence,
        review_threshold=settings.learned_sit_manual_review_threshold,
        rollout_percentage=settings.learned_sit_rollout_percentage,
        shadow_mode=settings.learned_sit_shadow_mode,
        fallback_enabled=settings.learned_sit_fallback_enabled,
    )

    # Run the legacy shadow path only when the new rollout system is not
    # already observing the learned model (avoids running inference twice).
    shadow_disagrees = rollout_meta.disagrees
    learned_prediction = rollout_meta.learned_prediction
    learned_confidence = rollout_meta.learned_confidence
    if settings.shadow_mode_enabled and not (
        settings.learned_sit_shadow_mode or rollout_meta.in_rollout
    ):
        from app.ml.shadow_service import run_shadow  # noqa: PLC0415
        shadow_disagrees, learned_prediction, learned_confidence = run_shadow(
            pose_summary, rule_based_result, settings.ml_artifact_path
        )

    # Apply hybrid routing.  For the sit path, the rollout result feeds in as
    # the pose_result so the hybrid pipeline sees the best available score.
    result = _maybe_apply_hybrid(request, pose_result, pose_summary, inference_latency_ms)

    # If the fast_pose path was taken, the review queue was already populated
    # inside _maybe_apply_hybrid.  For the sit path we also propagate the
    # shadow/rollout disagrees signal into the review queue.
    from app.services.pose_quality_service import compute_quality  # noqa: PLC0415
    quality_flags = compute_quality(pose_summary).flags.model_dump()

    if result.status not in ("pending_manual_review",):
        # Only call maybe_enqueue again for shadow disagreements that the
        # hybrid pipeline may not have seen.
        from app.services.review_service import maybe_enqueue  # noqa: PLC0415
        maybe_enqueue(
            request,
            result,
            quality_flags,
            shadow_disagrees,
            learned_prediction,
            learned_confidence,
        )

    persist_verification(request, result, pose_summary, inference_latency_ms)
    _record_metrics(
        request, result, inference_latency_ms,
        is_fallback=rollout_meta.classifier_used == "rule_based_fallback",
        disagreed=shadow_disagrees,
    )
    return result


@app.get("/verification/{verification_id}")
def get_verification(verification_id: str) -> dict:
    return {
        "verification_id": verification_id,
        "source": "supabase",
        "todo": "Read verification row with service-role client.",
    }


@app.post("/analyze/photo")
def analyze_photo() -> dict:
    return {
        "status": "not_implemented",
        "reason": "Object/photo confirmation model is a Phase 2 extension.",
    }


@app.post("/analyze/sensor-session")
def analyze_sensor_session() -> dict:
    return {
        "status": "not_implemented",
        "reason": "Sensor verification requires development-build permissions and anti-cheat checks.",
    }


@app.post("/games/finalize-score")
def finalize_score() -> dict:
    return {
        "status": "not_implemented",
        "reason": "Ranked game finalization requires anti-cheat and manual-review workflows.",
    }
