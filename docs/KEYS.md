# Keyboard shortcuts

## Pages

| URL | Runs on | What it is |
|---|---|---|
| `/` | External portrait OLED screen | The aquarium (display only, no camera) |
| `/camera` | This Mac | Webcam, face/object detection, reply recording, debug panel |
| `/friend` | Friends' phones (`https://[public-link]/friend`) | Draw on the duck + send a message |

The tank and the camera page talk through the backend event bus (`/api/bus`), so they can run in different windows or on different screens.

## Tank (`/`)

### Normal flow

The tank needs no input: looking at the camera starts everything (see [FLOW.md](FLOW.md)). These keys are for testing:

| Key | Action |
|---|---|
| `Space` / `Enter` | Wake the duck now (same as being seen by the camera) |
| `D` | Toggle the debug HUD (phase, camera connection, pending count) |
| `K` | Summon the shark now (it also comes by itself every 15–35 s and always eats at least one fish with its tongue) |
| `M` | Play the quack sound |

### Simulation (no backend data or credits needed)

| Key | Simulates |
|---|---|
| `1` | Dance |
| `2` | Jump |
| `3` | Spin |
| `4` | Wave |
| `5` | Sleep |
| `6` | Fly |
| `7` | Love (heart) |
| `8` | Wiggle |
| `Q` | Submarine arrives with no messages: "Nope, nothing new!" + finger wag |
| `W` | Full message flow with a demo message from Marco: "Hey, there's a message…" → performance → card → photo reply |
| `E` | Show & Tell success: countdown → thinking (magnifying glass) → duck plays with a banana |
| `Shift+E` | Show & Tell failure: "I couldn't see a thing" |
| `R` | Message card (3.5 s) |
| `T` | Photo reply: live camera + 3-2-1 + snap (needs `/camera` open; demo replies aren't uploaded) |
| `U` | "Uploading" flash state (3.5 s) |
| `I` | "Sent!" state with double quack (3.5 s) |
| `B` | Toggle the message-in-a-bottle hint in the aquarium |
| `X` | Abort the current scene and return to the aquarium |

Animations `1`–`8` come from `server/app/performances.py` (`GET /api/performances`), in that order.

## Camera page (`/camera`)

| Key | Action |
|---|---|
| `Space` / `Enter` | Forwarded to the tank (wake the duck) |
| `S` | Start Show & Tell now (tank counts down, camera captures the frame, SAM cuts the object out) |
| `A` | Toggle auto-trigger (motion → face → wake / object → Show & Tell) |

Buttons on the panel: **Wake duck**, **Show & Tell**.

The camera page also streams the webcam to the tank during the photo reply and takes the snapshot.

## Detection pipeline (camera page)

1. Motion: pixel difference on a 64×48 thumbnail in the browser (no model), threshold 3%.
2. Face + hand: local SAM 3.1 (open weights) on the backend, prompts `"face"` and `"hand"`, only after motion.
3. Object held up: local SAM 3.1, prompt `"object held in hand"`, only if a face was found (~1 s).
4. Face only → tank wakes. Face + object (> 2% of frame) → Show & Tell.
