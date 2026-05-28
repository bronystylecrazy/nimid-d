"""Shrunk prototype classifier for 4 motion conditions."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

import numpy as np

CLASSES = ["excited", "focus", "relax", "hesitate"]

PROTOTYPE_FEATURE_KEYS = [
    "mean_gyro_mag",
    "mean_jerk",
    "std_acc_motion",
    "motion_pulse_frequency",
    "peak_interval_std",
]

EPS = 1e-6
PROTOTYPE_SHRINK_ALPHA = 0.2
STD_FLOOR_K = 0.75


def parse_condition_from_source(source: str) -> str | None:
    name = Path(source).stem
    m = re.match(r"(.+?)_(excited|focus|relax|hesitate)$", name)
    return m.group(2) if m else None


def _feature_value(features: dict[str, Any], key: str) -> float:
    v = features.get(key)
    return 0.0 if v is None else float(v)


def load_labeled_sessions(aggregated_path: Path) -> list[dict[str, Any]]:
    with aggregated_path.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    rows: list[dict[str, Any]] = []
    for session in payload.get("sessions", []):
        cond = parse_condition_from_source(session.get("source", ""))
        if cond is None:
            continue
        rows.append(
            {
                "source": session.get("source"),
                "condition": cond,
                "features": session["features"],
            }
        )
    return rows


def build_prototype_rules(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Shrunk class prototypes: 5 features, std floor, blend toward global mean."""
    keys = PROTOTYPE_FEATURE_KEYS
    all_vals: dict[str, list[float]] = {k: [] for k in keys}
    for row in rows:
        for k in keys:
            all_vals[k].append(_feature_value(row["features"], k))

    global_means = {k: float(np.mean(all_vals[k])) for k in keys}
    global_stds = {
        k: max(float(np.std(all_vals[k], ddof=1)) if len(all_vals[k]) > 1 else 1.0, EPS)
        for k in keys
    }

    by_cond: dict[str, list[dict[str, Any]]] = {c: [] for c in CLASSES}
    for row in rows:
        by_cond[row["condition"]].append(row)

    prototypes: dict[str, dict[str, dict[str, float]]] = {}
    alpha = PROTOTYPE_SHRINK_ALPHA
    for cond in CLASSES:
        subset = by_cond[cond]
        means: dict[str, float] = {}
        stds: dict[str, float] = {}
        for feat in keys:
            vals = [_feature_value(r["features"], feat) for r in subset]
            arr = np.array(vals, dtype=float)
            mu_c = float(arr.mean()) if len(arr) else global_means[feat]
            sigma_c = float(arr.std(ddof=1)) if len(arr) > 1 else global_stds[feat]
            means[feat] = (1.0 - alpha) * mu_c + alpha * global_means[feat]
            stds[feat] = max(sigma_c, STD_FLOOR_K * global_stds[feat], EPS)
        prototypes[cond] = {"mean": means, "std": stds}

    return {
        "classes": CLASSES,
        "feature_names": keys,
        "prototypes": prototypes,
        "shrink_alpha": alpha,
        "std_floor_k": STD_FLOOR_K,
    }


def prototype_distance(features: dict[str, Any], rules: dict[str, Any], condition: str) -> float:
    proto = rules["prototypes"][condition]
    total = 0.0
    for name in rules["feature_names"]:
        mu = proto["mean"][name]
        sigma = proto["std"][name]
        x = _feature_value(features, name)
        z = (x - mu) / sigma
        total += z * z
    return math.sqrt(total)


def prototype_predict(
    features: dict[str, Any], rules: dict[str, Any]
) -> tuple[str, dict[str, float], float]:
    distances = {c: prototype_distance(features, rules, c) for c in CLASSES}
    sorted_items = sorted(distances.items(), key=lambda x: x[1])
    pred = sorted_items[0][0]
    d1 = sorted_items[0][1]
    d2 = sorted_items[1][1] if len(sorted_items) > 1 else d1 + 1.0
    confidence = min(1.0, max(0.0, (d2 - d1) / (d2 + EPS)))
    return pred, {k: float(v) for k, v in distances.items()}, confidence
