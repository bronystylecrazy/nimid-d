from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np


LLM_MAIN_PANEL_SIZE = (760, 760)
LLM_SMALL_PANEL_SIZE = (493, 360)
LLM_PANEL_GAP = 20


def crop_rect(value: str) -> tuple[int, int, int, int]:
    parts = value.split(",")
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("must be x,y,width,height")

    try:
        x, y, width, height = [int(part.strip()) for part in parts]
    except ValueError as exc:
        raise argparse.ArgumentTypeError("crop values must be integers") from exc

    if width <= 0 or height <= 0:
        raise argparse.ArgumentTypeError("width and height must be > 0")

    return x, y, width, height


def odd_int(value: str) -> int:
    number = int(value)
    if number < 3 or number % 2 == 0:
        raise argparse.ArgumentTypeError("must be an odd integer >= 3")
    return number


def build_ellipse_mask(shape: tuple[int, int], center: tuple[float, float], axes: tuple[float, float]) -> np.ndarray:
    height, width = shape
    mask = np.zeros((height, width), dtype=np.uint8)
    center_px = (int(width * center[0]), int(height * center[1]))
    axes_px = (int(width * axes[0]), int(height * axes[1]))
    cv2.ellipse(mask, center_px, axes_px, 0, 0, 360, 255, -1)
    return mask


def remove_small_components(binary: np.ndarray, min_area: int) -> np.ndarray:
    if min_area <= 0:
        return binary

    foreground = (binary > 0).astype(np.uint8)
    component_count, labels, stats, _ = cv2.connectedComponentsWithStats(foreground, 8)
    filtered = np.zeros_like(binary)

    for label in range(1, component_count):
        area = stats[label, cv2.CC_STAT_AREA]
        if area >= min_area:
            filtered[labels == label] = 255

    return filtered


def clamp_crop(
    crop: tuple[int, int, int, int],
    image_shape: tuple[int, ...],
) -> tuple[int, int, int, int]:
    x, y, width, height = crop
    image_height, image_width = image_shape[:2]
    x = max(0, min(x, image_width - 1))
    y = max(0, min(y, image_height - 1))
    right = max(x + 1, min(x + width, image_width))
    bottom = max(y + 1, min(y + height, image_height))
    return x, y, right - x, bottom - y


def crop_image(image: np.ndarray, crop: tuple[int, int, int, int]) -> np.ndarray:
    x, y, width, height = clamp_crop(crop, image.shape)
    return image[y : y + height, x : x + width]


def crop_from_mask(
    mask: np.ndarray,
    image_shape: tuple[int, ...],
    padding_ratio: float,
) -> tuple[int, int, int, int] | None:
    ys, xs = np.where(mask > 0)
    if len(xs) == 0 or len(ys) == 0:
        return None

    x = int(xs.min())
    y = int(ys.min())
    width = int(xs.max() - x + 1)
    height = int(ys.max() - y + 1)
    pad = int(max(width, height) * padding_ratio)
    return clamp_crop((x - pad, y - pad, width + pad * 2, height + pad * 2), image_shape)


def build_skin_mask(image: np.ndarray) -> np.ndarray:
    ycrcb = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)
    skin_ycrcb = cv2.inRange(
        ycrcb,
        np.array([0, 133, 77], dtype=np.uint8),
        np.array([255, 180, 135], dtype=np.uint8),
    )

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    skin_hsv = cv2.inRange(
        hsv,
        np.array([0, 18, 45], dtype=np.uint8),
        np.array([25, 210, 255], dtype=np.uint8),
    )
    skin_hsv |= cv2.inRange(
        hsv,
        np.array([170, 18, 45], dtype=np.uint8),
        np.array([179, 210, 255], dtype=np.uint8),
    )

    mask = cv2.bitwise_and(skin_ycrcb, skin_hsv)
    close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))
    open_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, close_kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, open_kernel, iterations=1)
    return mask


def build_grabcut_mask(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    grabcut_mask = np.full((height, width), cv2.GC_PR_BGD, dtype=np.uint8)
    margin_x = int(width * 0.06)
    margin_y = int(height * 0.02)
    rect = (
        margin_x,
        margin_y,
        max(1, width - margin_x * 2),
        max(1, height - margin_y * 3),
    )
    background_model = np.zeros((1, 65), np.float64)
    foreground_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(image, grabcut_mask, rect, background_model, foreground_model, 4, cv2.GC_INIT_WITH_RECT)
    return np.where(
        (grabcut_mask == cv2.GC_FGD) | (grabcut_mask == cv2.GC_PR_FGD),
        255,
        0,
    ).astype(np.uint8)


def largest_component(mask: np.ndarray, min_area_ratio: float = 0.03) -> np.ndarray | None:
    component_count, labels, stats, _ = cv2.connectedComponentsWithStats((mask > 0).astype(np.uint8), 8)
    if component_count <= 1:
        return None

    areas = stats[1:, cv2.CC_STAT_AREA]
    largest_label = int(np.argmax(areas)) + 1
    largest_area = int(stats[largest_label, cv2.CC_STAT_AREA])
    if largest_area < mask.size * min_area_ratio:
        return None

    output = np.zeros_like(mask)
    output[labels == largest_label] = 255
    return output


def build_auto_foreground_mask(image: np.ndarray) -> np.ndarray | None:
    skin = largest_component(build_skin_mask(image), min_area_ratio=0.02)
    grabcut = largest_component(build_grabcut_mask(image), min_area_ratio=0.02)

    if skin is not None and grabcut is not None:
        intersection = cv2.bitwise_and(skin, grabcut)
        intersection = largest_component(intersection, min_area_ratio=0.02)
        if intersection is not None:
            return intersection

        union = cv2.bitwise_or(skin, grabcut)
        return largest_component(union, min_area_ratio=0.02)

    return skin if skin is not None else grabcut


def auto_crop_from_mask(
    image: np.ndarray,
    mask: np.ndarray,
    padding: float,
) -> tuple[np.ndarray, np.ndarray, tuple[int, int, int, int]] | None:
    component = largest_component(mask, min_area_ratio=0.02)
    if component is None:
        return None

    contours, _ = cv2.findContours(component, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    contour = max(contours, key=cv2.contourArea)
    x, y, width, height = cv2.boundingRect(contour)
    pad_x = int(width * padding)
    pad_y = int(height * padding)
    crop = clamp_crop((x - pad_x, y - pad_y, width + pad_x * 2, height + pad_y * 2), image.shape)
    cropped_image = crop_image(image, crop)
    cropped_mask = crop_image(component, crop)
    return cropped_image, cropped_mask, crop


def build_auto_palm_mask(
    shape: tuple[int, int],
    foreground_mask: np.ndarray,
    erode_size: int,
) -> np.ndarray:
    height, width = shape
    if erode_size > 0:
        if erode_size % 2 == 0:
            erode_size += 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (erode_size, erode_size))
        foreground_mask = cv2.erode(foreground_mask, kernel, iterations=1)

    ellipse = build_ellipse_mask((height, width), center=(0.5, 0.55), axes=(0.43, 0.48))
    return cv2.bitwise_and(foreground_mask, ellipse)


def fit_to_box(
    image: np.ndarray,
    size: tuple[int, int],
    fill: tuple[int, int, int] = (0, 0, 0),
) -> np.ndarray:
    target_width, target_height = size
    height, width = image.shape[:2]
    scale = min(target_width / width, target_height / height)
    resized_width = max(1, int(width * scale))
    resized_height = max(1, int(height * scale))
    resized = cv2.resize(image, (resized_width, resized_height), interpolation=cv2.INTER_AREA)

    canvas = np.full((target_height, target_width, 3), fill, dtype=np.uint8)
    offset_x = (target_width - resized_width) // 2
    offset_y = (target_height - resized_height) // 2
    canvas[offset_y : offset_y + resized_height, offset_x : offset_x + resized_width] = resized
    return canvas


def as_bgr(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    return image


def label_panel(image: np.ndarray, label: str) -> np.ndarray:
    output = image.copy()
    cv2.rectangle(output, (0, 0), (output.shape[1], 34), (0, 0, 0), -1)
    cv2.putText(output, label, (14, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (255, 255, 255), 2, cv2.LINE_AA)
    return output


def build_transparent_overlay(image: np.ndarray, clean: np.ndarray, alpha: float = 0.55) -> np.ndarray:
    color_layer = image.copy()
    color_layer[clean > 0] = (0, 0, 255)
    return cv2.addWeighted(color_layer, alpha, image, 1 - alpha, 0)


def normalize_line_response(image: np.ndarray, signal_mask: np.ndarray | None = None) -> np.ndarray:
    gray = image.astype(np.float32)
    if signal_mask is not None and np.any(signal_mask > 0):
        values = gray[signal_mask > 0]
    else:
        values = gray[gray > 0]

    if values.size < 20:
        normalized = cv2.normalize(image, None, 0, 255, cv2.NORM_MINMAX)
        return normalized.astype(np.uint8)

    low = float(np.percentile(values, 2))
    high = float(np.percentile(values, 99.5))
    if high <= low:
        high = low + 1.0

    normalized = (gray - low) * (255.0 / (high - low))
    return np.clip(normalized, 0, 255).astype(np.uint8)


def make_soft_context(image: np.ndarray, mask: np.ndarray | None) -> np.ndarray:
    if mask is None:
        return image

    softened = cv2.GaussianBlur(image, (0, 0), 3)
    dimmed = (softened * 0.45).astype(np.uint8)
    return np.where(mask[..., None] > 0, image, dimmed)


def build_llm_panel(
    crop: np.ndarray,
    enhanced: np.ndarray,
    blackhat: np.ndarray,
    clean: np.ndarray,
    overlay: np.ndarray,
    mask: np.ndarray | None,
) -> np.ndarray:
    focus_signal = clean if np.count_nonzero(clean) > 50 else mask
    focus_crop = crop_from_mask(focus_signal, crop.shape, padding_ratio=0.18) if focus_signal is not None else None
    if focus_crop is not None:
        crop = crop_image(crop, focus_crop)
        enhanced = crop_image(enhanced, focus_crop)
        blackhat = crop_image(blackhat, focus_crop)
        clean = crop_image(clean, focus_crop)
        overlay = crop_image(overlay, focus_crop)
        mask = crop_image(mask, focus_crop) if mask is not None else None

    context = make_soft_context(crop, mask)
    overlay_context = make_soft_context(overlay, mask)
    enhanced_display = as_bgr(normalize_line_response(enhanced, mask))
    blackhat_display = as_bgr(normalize_line_response(blackhat, clean))

    crop_panel = label_panel(fit_to_box(context, LLM_MAIN_PANEL_SIZE), "palm crop")
    overlay_panel = label_panel(fit_to_box(overlay_context, LLM_MAIN_PANEL_SIZE), "line overlay")
    enhanced_panel = label_panel(fit_to_box(enhanced_display, LLM_SMALL_PANEL_SIZE), "contrast")
    blackhat_panel = label_panel(fit_to_box(blackhat_display, LLM_SMALL_PANEL_SIZE), "line response")
    clean_panel = label_panel(fit_to_box(as_bgr(clean), LLM_SMALL_PANEL_SIZE), "binary mask")

    top = np.hstack([crop_panel, np.full((LLM_MAIN_PANEL_SIZE[1], LLM_PANEL_GAP, 3), 18, dtype=np.uint8), overlay_panel])
    bottom = np.hstack(
        [
            enhanced_panel,
            np.full((LLM_SMALL_PANEL_SIZE[1], LLM_PANEL_GAP, 3), 18, dtype=np.uint8),
            blackhat_panel,
            np.full((LLM_SMALL_PANEL_SIZE[1], LLM_PANEL_GAP, 3), 18, dtype=np.uint8),
            clean_panel,
        ]
    )
    bottom_pad = (top.shape[1] - bottom.shape[1]) // 2
    bottom = cv2.copyMakeBorder(
        bottom,
        0,
        0,
        bottom_pad,
        top.shape[1] - bottom.shape[1] - bottom_pad,
        cv2.BORDER_CONSTANT,
        value=(18, 18, 18),
    )
    panel = np.vstack([top, np.full((LLM_PANEL_GAP, top.shape[1], 3), 18, dtype=np.uint8), bottom])
    return panel


def preprocess_palm(
    image_path: Path,
    output_dir: Path,
    auto: bool,
    auto_padding: float,
    palm_mask_erode: int,
    crop: tuple[int, int, int, int] | None,
    mask_mode: str,
    ellipse_center: tuple[float, float],
    ellipse_axes: tuple[float, float],
    min_component_area: int,
    clip_limit: float,
    tile_grid_size: int,
    blackhat_kernel_size: int,
    threshold_block_size: int,
    threshold_c: int,
) -> dict[str, Path]:
    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError(f"Could not read image: {image_path}")

    output_dir.mkdir(parents=True, exist_ok=True)

    auto_crop = None
    auto_foreground_mask = None
    auto_method = "manual"
    if auto:
        foreground_mask = build_auto_foreground_mask(image)
        if foreground_mask is not None:
            auto_result = auto_crop_from_mask(image, foreground_mask, auto_padding)
            if auto_result is not None:
                image, auto_foreground_mask, auto_crop = auto_result
                auto_method = "opencv-foreground"
        elif crop is not None:
            image = crop_image(image, crop)
            auto_method = "manual-crop-fallback"
    elif crop is not None:
        image = crop_image(image, crop)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    denoised = cv2.bilateralFilter(gray, d=7, sigmaColor=50, sigmaSpace=50)

    mask = None
    if auto and auto_foreground_mask is not None:
        mask = build_auto_palm_mask(gray.shape, auto_foreground_mask, palm_mask_erode)
    elif mask_mode == "ellipse":
        mask = build_ellipse_mask(gray.shape, ellipse_center, ellipse_axes)

    clahe = cv2.createCLAHE(
        clipLimit=clip_limit,
        tileGridSize=(tile_grid_size, tile_grid_size),
    )
    enhanced = clahe.apply(denoised)

    blackhat_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (blackhat_kernel_size, blackhat_kernel_size),
    )
    blackhat = cv2.morphologyEx(enhanced, cv2.MORPH_BLACKHAT, blackhat_kernel)

    visible = cv2.addWeighted(enhanced, 1.0, blackhat, 1.5, 0)

    binary = cv2.adaptiveThreshold(
        blackhat,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        threshold_block_size,
        threshold_c,
    )

    cleanup_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
    clean = cv2.morphologyEx(binary, cv2.MORPH_OPEN, cleanup_kernel)

    if mask is not None:
        enhanced = cv2.bitwise_and(enhanced, enhanced, mask=mask)
        blackhat = cv2.bitwise_and(blackhat, blackhat, mask=mask)
        visible = cv2.bitwise_and(visible, visible, mask=mask)
        binary = cv2.bitwise_and(binary, binary, mask=mask)
        clean = cv2.bitwise_and(clean, clean, mask=mask)

    clean = remove_small_components(clean, min_component_area)

    stem = image_path.stem
    outputs = {
        "crop": output_dir / f"{stem}_00_crop.png",
        "gray": output_dir / f"{stem}_01_gray.png",
        "enhanced": output_dir / f"{stem}_02_enhanced.png",
        "blackhat": output_dir / f"{stem}_03_blackhat.png",
        "visible": output_dir / f"{stem}_04_visible.png",
        "binary": output_dir / f"{stem}_05_binary.png",
        "clean": output_dir / f"{stem}_06_clean.png",
    }
    if mask is not None:
        outputs["mask"] = output_dir / f"{stem}_07_mask.png"
    outputs["overlay"] = output_dir / f"{stem}_08_overlay.png"
    outputs["llm_overlay"] = output_dir / f"{stem}_10_llm_overlay.png"
    outputs["llm_panel"] = output_dir / f"{stem}_11_llm_panel.png"
    if auto_foreground_mask is not None:
        outputs["foreground_mask"] = output_dir / f"{stem}_09_foreground_mask.png"

    cv2.imwrite(str(outputs["crop"]), image)
    cv2.imwrite(str(outputs["gray"]), gray)
    cv2.imwrite(str(outputs["enhanced"]), enhanced)
    cv2.imwrite(str(outputs["blackhat"]), blackhat)
    cv2.imwrite(str(outputs["visible"]), visible)
    cv2.imwrite(str(outputs["binary"]), binary)
    cv2.imwrite(str(outputs["clean"]), clean)
    if mask is not None:
        cv2.imwrite(str(outputs["mask"]), mask)
    overlay = image.copy()
    overlay[clean > 0] = (0, 0, 255)
    llm_overlay = build_transparent_overlay(image, clean)
    llm_panel = build_llm_panel(image, enhanced, blackhat, clean, llm_overlay, mask)
    cv2.imwrite(str(outputs["overlay"]), overlay)
    cv2.imwrite(str(outputs["llm_overlay"]), llm_overlay)
    cv2.imwrite(str(outputs["llm_panel"]), llm_panel)
    if auto_foreground_mask is not None:
        cv2.imwrite(str(outputs["foreground_mask"]), auto_foreground_mask)

    if auto:
        if auto_crop is None:
            print("Auto method: opencv-foreground not found; used full image/fallback mask settings.")
        else:
            x, y, width, height = auto_crop
            print(f"Auto method: {auto_method}; crop={x},{y},{width},{height}")

    return outputs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Enhance palm lines from a hand photo using OpenCV preprocessing.",
    )
    parser.add_argument("image", type=Path, help="Input palm image path")
    parser.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        default=Path("outputs"),
        help="Directory for generated images",
    )
    parser.add_argument(
        "--crop",
        type=crop_rect,
        help="Optional x,y,width,height crop before preprocessing",
    )
    parser.add_argument(
        "--auto",
        action="store_true",
        help="Use OpenCV foreground segmentation to auto-crop the hand and build a palm mask",
    )
    parser.add_argument(
        "--auto-padding",
        type=float,
        default=0.08,
        help="Padding around the detected hand bounding box",
    )
    parser.add_argument(
        "--palm-mask-erode",
        type=int,
        default=11,
        help="Erode the palm mask by this kernel size to reduce edge false positives",
    )
    parser.add_argument(
        "--mask",
        choices=("none", "ellipse"),
        default="none",
        help="Optional mask applied after line extraction",
    )
    parser.add_argument(
        "--ellipse-center",
        type=float,
        nargs=2,
        metavar=("X_FRAC", "Y_FRAC"),
        default=(0.54, 0.52),
        help="Ellipse mask center as width/height fractions",
    )
    parser.add_argument(
        "--ellipse-axes",
        type=float,
        nargs=2,
        metavar=("X_FRAC", "Y_FRAC"),
        default=(0.45, 0.55),
        help="Ellipse mask axes as width/height fractions",
    )
    parser.add_argument(
        "--min-component-area",
        type=int,
        default=0,
        help="Remove white connected components smaller than this pixel area",
    )
    parser.add_argument("--clip-limit", type=float, default=2.0)
    parser.add_argument("--tile-grid-size", type=int, default=8)
    parser.add_argument("--blackhat-kernel-size", type=odd_int, default=15)
    parser.add_argument("--threshold-block-size", type=odd_int, default=21)
    parser.add_argument("--threshold-c", type=int, default=-2)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    outputs = preprocess_palm(
        image_path=args.image,
        output_dir=args.output_dir,
        auto=args.auto,
        auto_padding=args.auto_padding,
        palm_mask_erode=args.palm_mask_erode,
        crop=args.crop,
        mask_mode=args.mask,
        ellipse_center=tuple(args.ellipse_center),
        ellipse_axes=tuple(args.ellipse_axes),
        min_component_area=args.min_component_area,
        clip_limit=args.clip_limit,
        tile_grid_size=args.tile_grid_size,
        blackhat_kernel_size=args.blackhat_kernel_size,
        threshold_block_size=args.threshold_block_size,
        threshold_c=args.threshold_c,
    )

    print("Generated:")
    for name, path in outputs.items():
        print(f"- {name}: {path}")


if __name__ == "__main__":
    main()
