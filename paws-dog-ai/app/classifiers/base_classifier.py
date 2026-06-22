from abc import ABC, abstractmethod

from app.models.request_models import ActivityAnalysisRequest
from app.models.response_models import ActivityAnalysisResponse


class BaseActivityClassifier(ABC):
    activity_id: str

    def validate_input(self, request: ActivityAnalysisRequest) -> tuple[bool, str | None]:
        if request.activity_id != self.activity_id:
            return False, f"Classifier {self.activity_id} cannot analyze {request.activity_id}."
        return True, None

    def run_quality_checks(self, pose_summary: dict) -> dict:
        return {"ready": False, "reason": "Quality gate not implemented for this classifier."}

    @abstractmethod
    def analyze_pose_sequence(self, request: ActivityAnalysisRequest, pose_summary: dict) -> ActivityAnalysisResponse:
        raise NotImplementedError

    def calculate_confidence(self, pose_summary: dict) -> float:
        return float(pose_summary.get("average_confidence", 0) or 0)

    def calculate_score(self, pose_summary: dict) -> dict:
        return {}

    def build_unavailable_result(self, request: ActivityAnalysisRequest) -> ActivityAnalysisResponse:
        return ActivityAnalysisResponse(
            verification_id=request.verification_id,
            activity_id=request.activity_id,
            status="unsupported_activity",
            confidence_score=None,
            model_name="superanimal_quadruped_hrnet_w32",
            analysis_summary={"implemented": False, "classifier": self.activity_id},
            failure_reason="This activity classifier is not production-ready yet.",
            retry_guidance="Try the sit verifier first while PAWS collects validation data for this activity.",
        )
