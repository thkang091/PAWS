def combine_confidence(scores: list[float]) -> float:
    clean_scores = [score for score in scores if score is not None]
    return sum(clean_scores) / len(clean_scores) if clean_scores else 0.0


def visibility_ratio(scores: list[float], threshold: float) -> float:
    if not scores:
        return 0.0
    return len([score for score in scores if score >= threshold]) / len(scores)
