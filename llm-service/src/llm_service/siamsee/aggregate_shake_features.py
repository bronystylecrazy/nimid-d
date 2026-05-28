"""Aggregate shake session files into summary motion features.

Supported inputs:
- CSV with columns: t_ms, acc_motion, gyro_mag
- CSV with device detection columns: t_ms, linear_accel_magnitude_g, gyro_magnitude_dps
  (acc_motion is computed as linear_accel_magnitude_g - 1)
- JSONL with records containing: t_ms, acc_motion, gyro_mag
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from dataclasses import dataclass
from pathlib import Path
from statistics import mean, median, stdev

import numpy as np

EPS = 1e-8
DEFAULT_EXPECTED_DT_MS = 20.0
DT_WARN_TOLERANCE_RATIO = 0.10


@dataclass
class SessionSeries:
    t_ms: list[float]
    acc_motion: list[float]
    gyro_mag: list[float]


def dominant_frequency_fft(
    values: list[float],
    fs: float,
    min_freq: float = 0.3,
    max_freq: float = 8.0,
) -> float:
    if fs <= 0 or len(values) < 8:
        return 0.0

    arr = np.asarray(values, dtype=float)
    if arr.size < 8:
        return 0.0

    arr = arr - np.mean(arr)
    if not np.any(np.isfinite(arr)) or np.allclose(arr, 0.0):
        return 0.0

    window = np.hanning(arr.size)
    windowed = arr * window

    spectrum = np.fft.rfft(windowed)
    freqs = np.fft.rfftfreq(arr.size, d=1.0 / fs)
    magnitudes = np.abs(spectrum)

    band_mask = (freqs >= min_freq) & (freqs <= max_freq)
    if not np.any(band_mask):
        return 0.0

    band_freqs = freqs[band_mask]
    band_magnitudes = magnitudes[band_mask]
    if band_magnitudes.size == 0:
        return 0.0

    max_idx = int(np.argmax(band_magnitudes))
    return float(band_freqs[max_idx])


def _safe_float(value: object, field: str, index: int) -> float:
    try:
        x = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid {field} at row {index}: {value!r}") from exc
    if not math.isfinite(x):
        raise ValueError(f"Non-finite {field} at row {index}: {value!r}")
    return x


def _validate_required_columns(row: dict, required: set[str], index: int) -> None:
    missing = [k for k in required if k not in row]
    if missing:
        raise ValueError(f"Missing required columns {missing} at row {index}")


def load_csv(path: Path) -> SessionSeries:
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            raise ValueError(f"CSV has no header: {path}")
        fields = set(reader.fieldnames)
        rows = list(reader)

    if {"t_ms", "acc_motion", "gyro_mag"}.issubset(fields):
        return _rows_to_series(
            rows,
            lambda row, i: (
                _safe_float(row["t_ms"], "t_ms", i),
                _safe_float(row["acc_motion"], "acc_motion", i),
                _safe_float(row["gyro_mag"], "gyro_mag", i),
            ),
        )

    detection_required = {"t_ms", "linear_accel_magnitude_g", "gyro_magnitude_dps"}
    if detection_required.issubset(fields):
        return _rows_to_series(
            rows,
            lambda row, i: (
                _safe_float(row["t_ms"], "t_ms", i),
                _safe_float(row["linear_accel_magnitude_g"], "linear_accel_magnitude_g", i)
                - 1.0,
                _safe_float(row["gyro_magnitude_dps"], "gyro_magnitude_dps", i),
            ),
        )

    raise ValueError(
        f"Unsupported CSV columns in {path}. "
        "Need either (t_ms, acc_motion, gyro_mag) or "
        "(t_ms, linear_accel_magnitude_g, gyro_magnitude_dps)."
    )


def _rows_to_series(
    rows: list[dict],
    row_to_vals,
) -> SessionSeries:
    t_ms: list[float] = []
    acc_motion: list[float] = []
    gyro_mag: list[float] = []
    for i, row in enumerate(rows):
        if row is None:
            continue
        t, a, g = row_to_vals(row, i)
        t_ms.append(t)
        acc_motion.append(a)
        gyro_mag.append(g)
    return SessionSeries(t_ms=t_ms, acc_motion=acc_motion, gyro_mag=gyro_mag)


def load_jsonl(path: Path) -> SessionSeries:
    t_ms: list[float] = []
    acc_motion: list[float] = []
    gyro_mag: list[float] = []
    required = {"t_ms", "acc_motion", "gyro_mag"}

    with path.open("r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSONL line {i}: {line!r}") from exc
            if not isinstance(record, dict):
                raise ValueError(f"JSONL record at line {i} must be an object")
            _validate_required_columns(record, required, i)
            t_ms.append(_safe_float(record["t_ms"], "t_ms", i))
            acc_motion.append(_safe_float(record["acc_motion"], "acc_motion", i))
            gyro_mag.append(_safe_float(record["gyro_mag"], "gyro_mag", i))

    return SessionSeries(t_ms=t_ms, acc_motion=acc_motion, gyro_mag=gyro_mag)


def load_series(path: Path) -> SessionSeries:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return load_csv(path)
    if suffix == ".jsonl":
        return load_jsonl(path)
    raise ValueError(f"Unsupported input format for {path}. Use .csv or .jsonl")


def validate_series(series: SessionSeries) -> list[str]:
    warnings: list[str] = []
    n = len(series.t_ms)
    if n == 0:
        raise ValueError("Input has no rows")
    if n != len(series.acc_motion) or n != len(series.gyro_mag):
        raise ValueError("Series lengths do not match")

    for i in range(1, n):
        if series.t_ms[i] <= series.t_ms[i - 1]:
            raise ValueError(
                f"t_ms must be strictly increasing; row {i-1}={series.t_ms[i-1]}, "
                f"row {i}={series.t_ms[i]}"
            )

    dts = [series.t_ms[i] - series.t_ms[i - 1] for i in range(1, n)]
    median_dt = median(dts) if dts else DEFAULT_EXPECTED_DT_MS
    if abs(median_dt - DEFAULT_EXPECTED_DT_MS) > DEFAULT_EXPECTED_DT_MS * DT_WARN_TOLERANCE_RATIO:
        warnings.append(
            "Median dt_ms deviates more than 10% from 20 ms "
            f"(observed={median_dt:.3f})"
        )
    return warnings


def moving_average(values: list[float], window: int) -> list[float]:
    if window <= 1 or window >= len(values):
        return values[:]
    half = window // 2
    smoothed: list[float] = []
    for i in range(len(values)):
        start = max(0, i - half)
        end = min(len(values), i + half + 1)
        smoothed.append(mean(values[start:end]))
    return smoothed


def detect_peaks(values: list[float], min_distance_samples: int, min_prominence: float) -> list[int]:
    peaks: list[int] = []
    last_peak = -10_000_000
    n = len(values)
    if n < 3:
        return peaks

    for i in range(1, n - 1):
        v = values[i]
        if v <= values[i - 1] or v < values[i + 1]:
            continue
        left_base = min(values[max(0, i - min_distance_samples) : i + 1])
        right_base = min(values[i : min(n, i + min_distance_samples + 1)])
        prominence = v - max(left_base, right_base)
        if prominence < min_prominence:
            continue
        if i - last_peak < min_distance_samples:
            if peaks and v > values[peaks[-1]]:
                peaks[-1] = i
                last_peak = i
            continue
        peaks.append(i)
        last_peak = i
    return peaks


def compute_features(series: SessionSeries, save_debug_peaks: bool = False) -> tuple[dict, dict]:
    warnings = validate_series(series)
    n = len(series.t_ms)
    t_s = [t / 1000.0 for t in series.t_ms]
    duration = (series.t_ms[-1] - series.t_ms[0]) / 1000.0 if n >= 2 else 0.0

    mean_acc = mean(series.acc_motion)
    std_acc = stdev(series.acc_motion) if n >= 2 else 0.0
    cv_acc = std_acc / max(mean_acc, EPS)

    mean_gyro = mean(series.gyro_mag)
    std_gyro = stdev(series.gyro_mag) if n >= 2 else 0.0

    if n >= 2:
        jerk_values = []
        for i in range(1, n):
            dt = t_s[i] - t_s[i - 1]
            if dt <= 0:
                continue
            jerk_values.append(abs((series.acc_motion[i] - series.acc_motion[i - 1]) / dt))
        mean_jerk = mean(jerk_values) if jerk_values else 0.0
    else:
        mean_jerk = 0.0

    dts = [t_s[i] - t_s[i - 1] for i in range(1, n)]
    fs_estimate = 1.0 / median(dts) if dts and median(dts) > 0 else 0.0

    smoothed_acc = moving_average(series.acc_motion, window=5)
    min_distance_samples = max(1, int(round(0.15 * fs_estimate))) if fs_estimate > 0 else 1
    min_prominence = max(0.05, 0.5 * std_acc)
    peak_idxs = detect_peaks(smoothed_acc, min_distance_samples, min_prominence)
    peak_times = [t_s[i] for i in peak_idxs]

    if len(peak_times) >= 2 and peak_times[-1] > peak_times[0]:
        # Frequency of detected movement pulses from acc_motion peaks.
        motion_pulse_frequency = (len(peak_times) - 1) / (peak_times[-1] - peak_times[0])
    else:
        motion_pulse_frequency = 0.0
        warnings.append(
            "Insufficient valid peaks for motion_pulse_frequency; returned 0.0"
        )

    if len(peak_times) >= 3:
        intervals = [peak_times[i] - peak_times[i - 1] for i in range(1, len(peak_times))]
        peak_interval_std = stdev(intervals) if len(intervals) >= 2 else 0.0
    else:
        peak_interval_std = 0.0
        warnings.append("Insufficient valid peaks for peak_interval_std; returned 0.0")

    dominant_acc_frequency_fft = dominant_frequency_fft(series.acc_motion, fs_estimate)
    dominant_gyro_frequency_fft = dominant_frequency_fft(series.gyro_mag, fs_estimate)
    if dominant_acc_frequency_fft > 0.0 and dominant_gyro_frequency_fft > 0.0:
        fft_frequency_agreement: float | None = abs(
            dominant_acc_frequency_fft - dominant_gyro_frequency_fft
        )
    else:
        fft_frequency_agreement = None

    if dominant_acc_frequency_fft == 0.0 and dominant_gyro_frequency_fft == 0.0:
        fft_rhythm_confidence = "none"
    elif fft_frequency_agreement is not None and fft_frequency_agreement <= 0.3:
        fft_rhythm_confidence = "high"
    elif fft_frequency_agreement is not None and fft_frequency_agreement <= 0.8:
        fft_rhythm_confidence = "medium"
    else:
        fft_rhythm_confidence = "low"

    features = {
        "mean_acc_motion": mean_acc,
        "std_acc_motion": std_acc,
        "cv_acc_motion": cv_acc,
        "mean_gyro_mag": mean_gyro,
        "std_gyro_mag": std_gyro,
        "motion_pulse_frequency": motion_pulse_frequency,
        "peak_interval_std": peak_interval_std,
        "duration": duration,
        "mean_jerk": mean_jerk,
        "dominant_acc_frequency_fft": dominant_acc_frequency_fft,
        "dominant_gyro_frequency_fft": dominant_gyro_frequency_fft,
        "fft_frequency_agreement": fft_frequency_agreement,
        "fft_rhythm_confidence": fft_rhythm_confidence,
    }

    metadata = {
        "sample_count": n,
        "fs_estimate": fs_estimate,
        "peak_count": len(peak_idxs),
        "min_distance_samples": min_distance_samples,
        "min_prominence": min_prominence,
        "warnings": warnings,
    }
    if save_debug_peaks:
        metadata["peak_indices"] = peak_idxs
        metadata["peak_times_s"] = peak_times

    return features, metadata


def aggregate_path(input_path: Path, save_debug_peaks: bool) -> dict:
    series = load_series(input_path)
    features, metadata = compute_features(series, save_debug_peaks=save_debug_peaks)
    return {
        "source": str(input_path),
        "features": features,
        "metadata": metadata,
    }


def collect_input_files(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    if not path.is_dir():
        raise ValueError(f"Input path does not exist: {path}")
    files = sorted(
        [p for p in path.iterdir() if p.is_file() and p.suffix.lower() in {".csv", ".jsonl"}]
    )
    if not files:
        raise ValueError(f"No .csv or .jsonl files found in {path}")
    return files


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Aggregate shake features from mock sessions")
    parser.add_argument("--input", required=True, type=Path, help="Input file or directory")
    parser.add_argument("--output", required=True, type=Path, help="Output JSON path")
    parser.add_argument("--format", choices=["pretty", "compact"], default="pretty")
    parser.add_argument("--save-debug-peaks", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_files = collect_input_files(args.input)
    sessions = [aggregate_path(path, save_debug_peaks=args.save_debug_peaks) for path in input_files]
    payload = {"sessions": sessions}

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        if args.format == "compact":
            json.dump(payload, f, separators=(",", ":"))
        else:
            json.dump(payload, f, indent=2)
    print(f"Aggregated {len(sessions)} session(s) -> {args.output}")


if __name__ == "__main__":
    main()
