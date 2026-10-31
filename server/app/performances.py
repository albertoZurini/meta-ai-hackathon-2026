"""Hand-written performances used in mock mode (and as fallbacks in live mode).

Format: see DUCK-STYLE.md section 6.
"""

import copy


def _kf(**kw):
    return kw


LIBRARY: dict[str, dict] = {
    "dance": {
        "title": "Happy dance",
        "duration_ms": 4000,
        "props": [],
        "tracks": [
            {"target": "duck", "keyframes": [
                _kf(t=0, translateX=0, rotate=0), _kf(t=0.25, translateX=-8, rotate=-10),
                _kf(t=0.5, translateX=0, rotate=0), _kf(t=0.75, translateX=8, rotate=10),
                _kf(t=1, translateX=0, rotate=0)], "easing": "ease-in-out", "iterations": 2},
            {"target": "wing", "keyframes": [
                _kf(t=0, rotate=0), _kf(t=0.5, rotate=-35), _kf(t=1, rotate=0)], "iterations": 4},
            {"target": "beak", "keyframes": [
                _kf(t=0, rotate=0), _kf(t=0.5, rotate=-12), _kf(t=1, rotate=0)], "iterations": 6},
        ],
        "bubble": [{"t": 0.05, "text": "Party time! 🎉"}],
    },
    "jump": {
        "title": "Jump for joy",
        "duration_ms": 3000,
        "props": [],
        "tracks": [
            {"target": "duck", "keyframes": [
                _kf(t=0, translateY=0, scaleY=1), _kf(t=0.15, translateY=0, scaleY=0.85),
                _kf(t=0.4, translateY=-50, scaleY=1.08), _kf(t=0.7, translateY=0, scaleY=1),
                _kf(t=0.8, translateY=0, scaleY=0.9), _kf(t=1, translateY=0, scaleY=1)],
             "easing": "ease-out", "iterations": 2},
            {"target": "wing", "keyframes": [_kf(t=0, rotate=0), _kf(t=0.4, rotate=-50), _kf(t=1, rotate=0)],
             "iterations": 2},
        ],
        "bubble": [{"t": 0.1, "text": "Woohoo!"}],
    },
    "spin": {
        "title": "Spin",
        "duration_ms": 3000,
        "props": [],
        "tracks": [
            {"target": "duck", "keyframes": [_kf(t=0, rotate=0), _kf(t=1, rotate=360)],
             "easing": "ease-in-out", "iterations": 2},
        ],
        "bubble": [{"t": 0.1, "text": "Wheee!"}],
    },
    "wave": {
        "title": "Wave hello",
        "duration_ms": 3000,
        "props": [],
        "tracks": [
            {"target": "wing", "keyframes": [
                _kf(t=0, rotate=0), _kf(t=0.25, rotate=-45), _kf(t=0.5, rotate=-20), _kf(t=0.75, rotate=-45),
                _kf(t=1, rotate=0)], "iterations": 2},
            {"target": "head", "keyframes": [_kf(t=0, rotate=0), _kf(t=0.5, rotate=6), _kf(t=1, rotate=0)],
             "iterations": 2},
        ],
        "bubble": [{"t": 0.05, "text": "Hi there! 👋"}],
    },
    "sleep": {
        "title": "Nap",
        "duration_ms": 4000,
        "props": [{"id": "zzz", "slot": "world", "x": 150, "y": 20,
                   "svg": '<text font-size="28" font-weight="700" fill="#1F2430">Z z z</text>'}],
        "tracks": [
            {"target": "eye", "keyframes": [_kf(t=0, scaleY=1), _kf(t=0.1, scaleY=0.1), _kf(t=1, scaleY=0.1)]},
            {"target": "head", "keyframes": [_kf(t=0, rotate=0), _kf(t=0.5, rotate=12), _kf(t=1, rotate=8)]},
            {"target": "zzz", "keyframes": [_kf(t=0, opacity=0, translateY=10), _kf(t=0.3, opacity=1, translateY=0),
                                            _kf(t=1, opacity=1, translateY=-20)]},
        ],
        "bubble": [],
    },
    "fly": {
        "title": "Try to fly",
        "duration_ms": 4000,
        "props": [],
        "tracks": [
            {"target": "wing", "keyframes": [_kf(t=0, rotate=0), _kf(t=0.5, rotate=-60), _kf(t=1, rotate=0)],
             "iterations": 10},
            {"target": "duck", "keyframes": [
                _kf(t=0, translateY=0), _kf(t=0.5, translateY=-30, rotate=-8), _kf(t=0.8, translateY=-20),
                _kf(t=1, translateY=0)], "easing": "ease-in-out"},
        ],
        "bubble": [{"t": 0.1, "text": "I believe I can fly!"}],
    },
    "love": {
        "title": "Love",
        "duration_ms": 3500,
        "props": [{"id": "heart", "slot": "world", "x": 40, "y": 30,
                   "svg": '<path d="M20 34 C-6 14 6 -4 20 8 C34 -4 46 14 20 34 Z" fill="#EC4899" '
                          'stroke="#1F2430" stroke-width="3" stroke-linejoin="round"/>'}],
        "tracks": [
            {"target": "heart", "keyframes": [_kf(t=0, scale=0.2, opacity=0), _kf(t=0.3, scale=1.3, opacity=1),
                                              _kf(t=0.5, scale=1), _kf(t=0.7, scale=1.3), _kf(t=1, scale=1)]},
            {"target": "duck", "keyframes": [_kf(t=0, rotate=0), _kf(t=0.5, rotate=-6), _kf(t=1, rotate=0)],
             "iterations": 2},
        ],
        "bubble": [{"t": 0.1, "text": "Sending love ❤️"}],
    },
    "wiggle": {
        "title": "Wiggle",
        "duration_ms": 3000,
        "props": [],
        "tracks": [
            {"target": "duck", "keyframes": [_kf(t=0, rotate=0), _kf(t=0.25, rotate=-6), _kf(t=0.75, rotate=6),
                                             _kf(t=1, rotate=0)], "iterations": 3},
        ],
        "bubble": [],
    },
}

KEYWORDS = {
    "dance": ["danc", "party", "celebrat", "groove", "job", "won", "win"],
    "jump": ["jump", "hop", "bounce", "excit", "yay"],
    "spin": ["spin", "turn", "twirl", "round"],
    "wave": ["wave", "hello", "hi ", "hey", "greet", "bye"],
    "sleep": ["sleep", "nap", "tired", "night", "bed"],
    "fly": ["fly", "flap", "plane", "travel", "trip"],
    "love": ["love", "miss", "heart", "kiss", "hug", "❤"],
}


def pick(prompt: str) -> dict:
    p = f" {prompt.lower()} "
    for name, words in KEYWORDS.items():
        if any(w in p for w in words):
            return copy.deepcopy(LIBRARY[name])
    return copy.deepcopy(LIBRARY["wiggle"])


def show_and_tell(label: str) -> dict:
    """Generic 'play with the held object' gag."""
    return {
        "title": f"Playing with a {label}",
        "duration_ms": 4500,
        "props": [],
        "tracks": [
            {"target": "hand-r", "keyframes": [_kf(t=0, opacity=1, rotate=0, translateY=0),
                                               _kf(t=0.3, opacity=1, rotate=-30, translateY=-20),
                                               _kf(t=0.6, opacity=1, rotate=10, translateY=-10),
                                               _kf(t=1, opacity=1, rotate=0, translateY=0)], "iterations": 2},
            {"target": "head", "keyframes": [_kf(t=0, rotate=0), _kf(t=0.3, rotate=-10), _kf(t=1, rotate=0)],
             "iterations": 2},
            {"target": "eye", "keyframes": [_kf(t=0, scaleY=1), _kf(t=0.45, scaleY=1), _kf(t=0.5, scaleY=0.1),
                                            _kf(t=0.55, scaleY=1), _kf(t=1, scaleY=1)], "iterations": 2},
        ],
        "bubble": [{"t": 0.05, "text": f"Ooh, a {label}!"}],
    }


CSS_PARTS = {"duck", "body", "head", "beak", "eye", "wing", "feet", "hand-l", "hand-r"}


def _transform(kf: dict) -> str:
    out = []
    if "translateX" in kf or "translateY" in kf:
        out.append(f"translate({kf.get('translateX', 0)}px, {kf.get('translateY', 0)}px)")
    if "rotate" in kf:
        out.append(f"rotate({kf['rotate']}deg)")
    if "scale" in kf:
        out.append(f"scale({kf['scale']})")
    if "scaleY" in kf:
        out.append(f"scaleY({kf['scaleY']})")
    return " ".join(out)


def to_css(name: str, perf: dict) -> str:
    """CSS version of a library performance (props are skipped: the animator can't add props)."""
    lines, rules = [], []
    for track in perf["tracks"]:
        if track["target"] not in CSS_PARTS:
            continue
        kname = f"dk-{name}-{track['target']}"
        frames = []
        for kf in track["keyframes"]:
            decl = [f"transform: {t}" for t in [_transform(kf)] if t]
            if "opacity" in kf:
                decl.append(f"opacity: {kf['opacity']}")
            frames.append(f"{round(kf['t'] * 100)}% {{ {'; '.join(decl)} }}")
        lines.append(f"@keyframes {kname} {{ {' '.join(frames)} }}")
        n = track.get("iterations", 1)
        dur = perf["duration_ms"] / n / 1000
        fill = " forwards" if n == 1 else ""
        rules.append(f'[data-part="{track["target"]}"] {{ animation: {kname} {dur:.3g}s '
                     f'{track.get("easing", "ease-in-out")} {n}{fill} }}')
    return "\n".join(lines + rules)


def prompt_examples() -> str:
    """The whole library as CSS, so the animator learns which moves look good on this rig."""
    out = []
    for name, perf in LIBRARY.items():
        css = to_css(name, perf)
        if css:
            bubble = perf["bubble"][0]["text"] if perf["bubble"] else ""
            out.append(f"{perf['title']} ({perf['duration_ms']} ms){f', bubble: {bubble!r}' if bubble else ''}:"
                       f"\n```css\n{css}\n```")
    return "\n\n".join(out)
