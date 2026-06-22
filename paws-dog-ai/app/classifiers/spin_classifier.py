from app.classifiers.base_classifier import BaseActivityClassifier


class SpinClassifier(BaseActivityClassifier):
    activity_id = "spin"

    def analyze_pose_sequence(self, request, pose_summary):
        return self.build_unavailable_result(request)
