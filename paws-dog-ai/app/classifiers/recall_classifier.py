from app.classifiers.base_classifier import BaseActivityClassifier


class RecallClassifier(BaseActivityClassifier):
    activity_id = "recall"

    def analyze_pose_sequence(self, request, pose_summary):
        return self.build_unavailable_result(request)
