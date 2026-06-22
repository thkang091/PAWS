def smooth(values: list[float], window: int = 5) -> list[float]:
    if window <= 1 or len(values) <= 2:
        return values

    radius = window // 2
    smoothed: list[float] = []
    for index in range(len(values)):
        start = max(0, index - radius)
        end = min(len(values), index + radius + 1)
        chunk = values[start:end]
        smoothed.append(sum(chunk) / len(chunk))
    return smoothed
