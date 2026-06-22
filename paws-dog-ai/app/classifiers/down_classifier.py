from app.classifiers.base_classifier import BaseActivityClassifier


class DownClassifier(BaseActivityClassifier):
    activity_id = "down"

    def analyze_pose_sequence(self, request, pose_summary):
        return self.build_unavailable_result(request)
