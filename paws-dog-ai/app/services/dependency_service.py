import importlib
import importlib.metadata


def get_package_version(package_name: str, import_name: str | None = None) -> str | None:
    module_name = import_name or package_name
    try:
        module = importlib.import_module(module_name)
    except Exception:
        return None

    version = getattr(module, "__version__", None)
    if isinstance(version, str):
        return version

    try:
        return importlib.metadata.version(package_name)
    except importlib.metadata.PackageNotFoundError:
        return "installed"


def dependency_report() -> dict:
    torch_version = get_package_version("torch")
    dlc_version = get_package_version("deeplabcut")
    cv2_version = get_package_version("opencv-python", "cv2")
    gpu_available = False

    if torch_version:
        try:
            import torch

            gpu_available = bool(torch.cuda.is_available() or getattr(torch.backends, "mps", None) and torch.backends.mps.is_available())
        except Exception:
            gpu_available = False

    return {
        "deeplabcut_version": dlc_version,
        "torch_version": torch_version,
        "opencv_version": cv2_version,
        "gpu_available": gpu_available,
        "pose_dependencies_ready": bool(torch_version and dlc_version),
    }
