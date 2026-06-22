from app.classifiers.base_classifier import BaseActivityClassifier


class PawClassifier(BaseActivityClassifier):
    activity_id = "paw"

    def analyze_pose_sequence(self, request, pose_summary):
        return self.build_unavailable_result(request)
