"""
OpenCV Asimetri Motoru — Hızlı Test Scripti
Kullanım:
    cd ai-service
    python test_opencv.py                        # webcam'den anlık kare
    python test_opencv.py --image foto.jpg       # dosyadan
    python test_opencv.py --image foto.jpg --save # annotated görüntüyü kaydet
"""

import argparse
import sys
from pathlib import Path

# Proje kökünü sys.path'e ekle
sys.path.insert(0, str(Path(__file__).parent))

from app.services.opencv_engine import AsymmetryEngine


def test_from_file(image_path: str, save: bool = False) -> None:
    print(f"\n📷  Görüntü: {image_path}")

    with AsymmetryEngine() as engine:
        img = engine.load_image(image_path)
        print(f"   Boyut  : {img.shape[1]}×{img.shape[0]} px")

        metrics, annotated = engine.analyze(img)

    # ── Sonuçları yazdır ──────────────────────────────────────────────────── #
    print("\n" + "─" * 50)
    print(f"  Simetri Skoru    : {metrics.symmetry_score:.1f} / 100")
    print(f"  Kalibrasyon      : {metrics.px_per_mm:.3f} px/mm")
    print("─" * 50)
    print(f"  Kaş  Δ           : {metrics.eyebrow_delta_mm:+.2f} mm")
    print(f"  Göz  Δ           : {metrics.eye_delta_mm:+.2f} mm")
    print(f"  Dudak Δ          : {metrics.lip_delta_mm:+.2f} mm")
    print(f"  Burun sapması    : {metrics.nose_deviation_mm:+.2f} mm")
    print(f"  Orta hat sapması : {metrics.midline_deviation_mm:+.2f} mm")
    print("─" * 50)

    if save:
        out_path = Path(image_path).stem + "_annotated.jpg"
        annotated_bytes = engine.image_to_bytes(annotated)
        Path(out_path).write_bytes(annotated_bytes)
        print(f"\n✅  Annotated görüntü kaydedildi: {out_path}")

    # OpenCV penceresi (GUI varsa)
    try:
        import cv2
        cv2.imshow("Asimetri Analizi  (herhangi bir tuşa bas)", annotated)
        cv2.waitKey(0)
        cv2.destroyAllWindows()
    except Exception:
        print("   (GUI gösterimi atlandı — headless ortam)")


def test_from_webcam() -> None:
    import cv2

    print("\n📹  Webcam'den kare alınıyor... (q = çık)")
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("❌  Webcam açılamadı. --image ile dosya belirtin.")
        return

    with AsymmetryEngine() as engine:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            try:
                metrics, annotated = engine.analyze(frame)
                cv2.imshow("AI Asimetri — q=çık", annotated)
            except ValueError:
                cv2.putText(frame, "Yuz tespit edilemedi", (20, 40),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
                cv2.imshow("AI Asimetri — q=çık", frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OpenCV Asimetri Motor Testi")
    parser.add_argument("--image", "-i", help="Test edilecek JPG/PNG dosyası")
    parser.add_argument("--save",  "-s", action="store_true", help="Annotated görüntüyü kaydet")
    args = parser.parse_args()

    if args.image:
        test_from_file(args.image, save=args.save)
    else:
        test_from_webcam()
