import json
import sys
import time
from typing import Any


def structured_log(level: str, service: str, event: str, **fields: Any) -> None:
    record = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "level": level,
        "service": service,
        "event": event,
        **fields,
    }
    print(json.dumps(record), file=sys.stderr, flush=True)


def log_info(service: str, event: str, **fields: Any) -> None:
    structured_log("INFO", service, event, **fields)


def log_warn(service: str, event: str, **fields: Any) -> None:
    structured_log("WARN", service, event, **fields)


def log_error(service: str, event: str, **fields: Any) -> None:
    structured_log("ERROR", service, event, **fields)


# Legacy shim — callers that use safe_log() continue to work.
def safe_log(message: str) -> None:
    log_info("legacy", "safe_log", message=message)
