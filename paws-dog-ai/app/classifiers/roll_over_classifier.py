from app.classifiers.base_classifier import BaseActivityClassifier


class RollOverClassifier(BaseActivityClassifier):
    activity_id = "roll_over"

    def analyze_pose_sequence(self, request, pose_summary):
        return self.build_unavailable_result(request)
