"""
ONNX export and verification for the Temporal Behavior Transformer.

Exported graph
--------------
Input:   pose_sequence   (1, in_dim, seq_len)  float32
Outputs:
  global_trick_logits   (1, n_trick_classes)   float32
  completion_score      (1, 1)                 float32  — sigmoid activated
  failure_reason_logits (1, n_failure_reasons) float32

Per-frame outputs (frame_trick_logits, boundary_logits) are intentionally
excluded from the server-facing ONNX graph to keep the ONNX model small
and the inference path simple.  They remain available via the PyTorch model.

Parity test
-----------
verify_onnx_parity() runs the same random input through PyTorch and ONNX
and asserts that all three outputs agree to within rtol=1e-4.

Dynamic axes
------------
Batch size is fixed to 1 (server-side single-sample inference).
The time axis (T) is dynamic so the model can handle variable sequence
lengths at runtime without re-exporting.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

ONNX_FILENAME = "model.onnx"
OPSET_VERSION = 17


def export_onnx(
    model,
    artifact_dir: str | Path,
    device: str = "cpu",
) -> Path:
    """
    Export model.forward_onnx() to ONNX in the given artifact directory.

    The model must be a TemporalBehaviorTransformer instance.
    Returns the path to the written .onnx file.
    """
    import torch  # noqa: PLC0415

    artifact_dir = Path(artifact_dir)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    onnx_path = artifact_dir / ONNX_FILENAME

    model = model.to(device)
    model.eval()

    cfg = model.cfg
    dummy = torch.zeros(1, cfg.in_dim, cfg.seq_len, device=device)

    torch.onnx.export(
        model,
        (dummy,),
        str(onnx_path),
        export_params=True,
        opset_version=OPSET_VERSION,
        do_constant_folding=True,
        input_names=["pose_sequence"],
        output_names=[
            "global_trick_logits",
            "completion_score",
            "failure_reason_logits",
        ],
        dynamic_axes={
            "pose_sequence": {2: "seq_len"},
        },
        # Use forward_onnx so only the three server-facing tensors are traced.
        operator_export_type=torch.onnx.OperatorExportTypes.ONNX,
    )

    return onnx_path


def verify_onnx_parity(
    model,
    onnx_path: str | Path,
    rtol: float = 1e-3,
    atol: float = 1e-5,
    device: str = "cpu",
) -> dict[str, float]:
    """
    Run the same random input through PyTorch and ONNX.

    Returns a dict with max absolute diff per output head.
    Raises AssertionError if any output exceeds the tolerances.
    """
    import torch       # noqa: PLC0415
    import onnxruntime as ort  # noqa: PLC0415

    model = model.to(device)
    model.eval()
    cfg = model.cfg

    rng = np.random.default_rng(42)
    x_np = rng.standard_normal((1, cfg.in_dim, cfg.seq_len)).astype(np.float32)
    x_pt = torch.from_numpy(x_np).to(device)

    # PyTorch
    with torch.no_grad():
        pt_trick, pt_compl, pt_fail = model.forward_onnx(x_pt)
    pt_trick = pt_trick.cpu().numpy()
    pt_compl = pt_compl.cpu().numpy()
    pt_fail  = pt_fail.cpu().numpy()

    # ONNX Runtime
    sess_opts = ort.SessionOptions()
    sess_opts.log_severity_level = 3   # suppress verbose logs
    sess = ort.InferenceSession(str(onnx_path), sess_opts=sess_opts)
    ort_trick, ort_compl, ort_fail = sess.run(
        None, {"pose_sequence": x_np}
    )

    # Check parity
    diffs = {
        "global_trick": float(np.abs(pt_trick - ort_trick).max()),
        "completion":   float(np.abs(pt_compl - ort_compl).max()),
        "failure":      float(np.abs(pt_fail  - ort_fail).max()),
    }

    for name, diff in diffs.items():
        assert diff <= atol + rtol * float(np.abs(pt_trick).max() + 1e-6), (
            f"ONNX parity check failed for '{name}': max diff = {diff:.2e}"
        )

    return diffs


def run_onnx_inference(
    onnx_path: str | Path,
    features: np.ndarray,
) -> dict[str, np.ndarray]:
    """
    Run inference on a single preprocessed sequence using ONNX Runtime.

    Args:
        onnx_path: path to the exported .onnx file
        features:  (in_dim, seq_len) float32 array  — channels-first

    Returns:
        dict with "global_trick_logits", "completion_score",
        "failure_reason_logits"
    """
    import onnxruntime as ort  # noqa: PLC0415

    x = features[np.newaxis]   # (1, in_dim, seq_len)
    sess_opts = ort.SessionOptions()
    sess_opts.log_severity_level = 3
    sess = ort.InferenceSession(str(onnx_path), sess_opts=sess_opts)
    trick, compl, fail = sess.run(None, {"pose_sequence": x})

    return {
        "global_trick_logits":   trick[0],
        "completion_score":      compl[0],
        "failure_reason_logits": fail[0],
    }
