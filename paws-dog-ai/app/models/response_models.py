from pydantic import BaseModel
from pydantic import ConfigDict


class ActivityAnalysisResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    verification_id: str
    activity_id: str
    status: str
    confidence_score: float | None
    model_name: str | None
    analysis_summary: dict | None
    failure_reason: str | None
    retry_guidance: str | None
