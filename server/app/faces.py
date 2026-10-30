"""Face detection with Apple's Vision framework (OS built-in, not an AI model call per hackathon rules).

Fast (a few ms) — used for the presence trigger so SAM only runs when someone is actually there.
"""

import Quartz
import Vision
from Foundation import NSData


def detect(jpeg: bytes) -> list[dict]:
    """Return faces as [{score, box: [x0, y0, x1, y1]}] in normalized top-left coordinates."""
    data = NSData.dataWithBytes_length_(jpeg, len(jpeg))
    source = Quartz.CGImageSourceCreateWithData(data, None)
    cg = Quartz.CGImageSourceCreateImageAtIndex(source, 0, None)
    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg, None)
    request = Vision.VNDetectFaceRectanglesRequest.alloc().init()
    ok, err = handler.performRequests_error_([request], None)
    if not ok:
        raise RuntimeError(str(err))
    faces = []
    for obs in request.results() or []:
        bb = obs.boundingBox()  # normalized, origin bottom-left
        x0, y0 = bb.origin.x, 1 - (bb.origin.y + bb.size.height)
        faces.append({"score": round(float(obs.confidence()), 3),
                      "box": [x0, y0, x0 + bb.size.width, y0 + bb.size.height]})
    return faces


def hands(jpeg: bytes, min_conf: float = 0.3) -> list[dict]:
    """Hands via Apple Vision hand pose: [{score, box}] in normalized top-left coordinates."""
    data = NSData.dataWithBytes_length_(jpeg, len(jpeg))
    source = Quartz.CGImageSourceCreateWithData(data, None)
    cg = Quartz.CGImageSourceCreateImageAtIndex(source, 0, None)
    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg, None)
    request = Vision.VNDetectHumanHandPoseRequest.alloc().init()
    request.setMaximumHandCount_(2)
    ok, err = handler.performRequests_error_([request], None)
    if not ok:
        raise RuntimeError(str(err))
    out = []
    for obs in request.results() or []:
        points, _ = obs.recognizedPointsForGroupKey_error_(Vision.VNHumanHandPoseObservationJointsGroupNameAll, None)
        pts = [p for p in (points or {}).values() if p.confidence() > min_conf]
        if len(pts) < 5:
            continue
        xs = [p.location().x for p in pts]
        ys = [1 - p.location().y for p in pts]
        out.append({"score": round(float(obs.confidence()), 3), "box": [min(xs), min(ys), max(xs), max(ys)]})
    return out
