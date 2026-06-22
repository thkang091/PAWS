from app.classifiers.base_classifier import BaseActivityClassifier


class StandClassifier(BaseActivityClassifier):
    activity_id = "stand"

    def analyze_pose_sequence(self, request, pose_summary):
        return self.build_unavailable_result(request)
