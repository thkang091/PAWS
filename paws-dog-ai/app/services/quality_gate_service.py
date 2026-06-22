class QualityGateService:
    def run(self, pose_summary: dict) -> dict:
        return {
            "dog_detected": False,
            "exactly_one_dog": None,
            "full_body_visible": None,
            "paws_visible": None,
            "ready": False,
            "reason": "Pose model integration is not complete yet.",
        }
