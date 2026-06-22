from app.classifiers.base_classifier import BaseActivityClassifier


class StayClassifier(BaseActivityClassifier):
    activity_id = "stay"

    def analyze_pose_sequence(self, request, pose_summary):
        return self.build_unavailable_result(request)
