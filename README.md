# 🦆 DuckMail

**A desk aquarium where a duck in a submarine delivers messages from friends who live far away.**

Built solo, from scratch, for the **Meta Global AI Developer Hackathon** (Oct 27 – Nov 4, 2026). Every line of code, every drawing and the idea itself were made during the hackathon.

My wife and I moved from overseas to the US. Our friends are hours away. Scheduling a video call across time zones never lines up. So I built a little room where friends can drop into whenever they want, with a duck in a submarine.

## How it works

DuckMail is split into two views:

| View | Where it runs | What it does |
|---|---|---|
| **Friend view** `/friend` | any phone, just a link | draw on the duck, pick how fancy the AI should make it, write a message (or record a video), send |
| **Tank view** `/` | a portrait screen on my desk | an always-on aquarium. No buttons: it reacts when somebody looks at it |

**A friend sends a duck**

1. The friend draws something on the duck (say, a pizza) and writes "Pizza time!!!".
2. **Muse Spark** looks at the duck, the drawing and the message and **writes the animation itself as CSS keyframes**. It also decides where the drawing sits on the duck and what the speech bubble says.
3. The generated CSS goes through a **sanitizer** (tinycss2: no `url()`, no scripts, no infinite loops) before it is allowed to run.
4. In parallel, **Muse Image** redraws the scribble as a clean accessory, in the style the friend picked on a slider that goes from *"drawn by a 5-year-old"* to *"photo"*. A chroma key cuts it out.
5. A bottle floats into the aquarium and waits.

**Somebody looks at the tank**

- **Holding something up?** **SAM 3.1** (running locally) cuts the object out of the webcam frame, **Muse Spark** names it and invents a little gag and the duck plays with it ("Shake shake! Snack time!").
- **Message waiting?** The submarine pulls up, the duck performs the friend's animation wearing their drawing, holds up the message and counts down "Smile for Marco! 3-2-1". **That selfie is the reply** and it lands on the friend's page.
- **Nothing new?** "Nope, nothing new! ☝️"

Video messages are transcribed with **Muse Voice Transcribe**.

## Meta models used

| Model | Used for | Code |
|---|---|---|
| **Muse Spark 1.3** (vision + JSON schema) | writes the duck's CSS animation, places the drawing, writes the bubble; names Show & Tell objects and invents the gag | `server/app/animator.py`, `server/app/pipeline.py` |
| **Muse Image 1.0** (edit) | redraws the friend's doodle in the chosen style | `server/app/animator.py`, `server/app/pipeline.py` |
| **Muse Voice Transcribe 1.0** | transcribes video messages | `server/app/pipeline.py` |
| **SAM 3.1** (open weights, runs on the Mac) | cuts the held-up object out of the webcam frame | `server/app/sam.py` |

All Meta Model API calls go through `server/app/muse.py` (the `openai` Python package is only used as an OpenAI-compatible client pointed at `https://api.meta.ai/v1`). Face detection uses Apple's built-in Vision framework, not an AI API.

## QA tools

Generated animations can go weird, so there are two pages to catch bad ones before a friend sees them:

- **`/lab`**: re-runs and replays saved AI drafts side by side and lets me change the quality setting.
- **`/gallery`**: every visual component (duck states, performances, cards, fish, shark, aquarium) in every state, live from the real components.

`/presentation` and `/outro` are the slides and end card used in the demo video.

## Hardware

The tank runs on a bare flexible OLED panel driven by an HDMI-to-MIPI board, held up by a Lego stand. (The 3D-printed stand assumed a screen angle I hadn't settled yet and one panel didn't survive the build.)

## Running it

Requirements: macOS (Apple Vision is used for face detection), Python 3.12 with [uv](https://docs.astral.sh/uv/), Node with pnpm and a Meta Model API key.

```sh
# 1. API key: create .env in the repo root
echo 'META_DEV_API_KEY=your-key' > .env

# 2. Backend (FastAPI on :8000). AI_MODE=live calls the Meta models; the default "mock" mode doesn't.
AI_MODE=live ./scripts/dev-backend.sh

# 3. Frontend (Vite on :3000, proxies /api to the backend)
./scripts/dev-frontend.sh
```

Then open:

- `http://localhost:3000/` on the tank screen
- `http://localhost:3000/camera` on the Mac with the webcam (detection + replies)
- `http://localhost:3000/friend` on a phone (expose port 3000 with any tunnel to share it)

SAM 3.1 weights are downloaded from Hugging Face on first use. Keyboard shortcuts for testing are in [docs/KEYS.md](docs/KEYS.md) and the full interaction flow is in [docs/FLOW.md](docs/FLOW.md).

## Project layout

```
server/            FastAPI backend
  app/muse.py        Meta Model API client (Spark, Image, Voice Transcribe)
  app/animator.py    drawing + message → CSS animation + redrawn accessory
  app/pipeline.py    message processing, Show & Tell, quality styles
  app/sam.py         local SAM 3.1 segmentation
  app/faces.py       Apple Vision face detection
web/               React + TypeScript + Vite frontend
  src/pages/         Tank, Friend, Camera, Lab, Gallery, Presentation, Outro
  src/duck/          the duck (SVG) and its animation player
  src/scenes/        aquarium, fish, shark, submarine
docs/              interaction flow and keyboard shortcuts
DUCK-STYLE.md      the duck's visual style guide (also given to the model)
```
