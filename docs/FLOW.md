# Current interaction flow

How the tank (`/`, external OLED) and the camera page (`/camera`, Mac) behave **right now**. The tank needs **no input**: everything is driven by the webcam and timers.

Legend:
- 🟦 automatic
- 🟪 webcam / detection
- 🔊 quack sound (`web/public/quack.mp3`)
- ⏱ timer

```mermaid
flowchart TD
    classDef auto fill:#dbeafe,stroke:#1e40af,color:#111
    classDef cam fill:#ede9fe,stroke:#6d28d9,color:#111
    classDef friend fill:#dcfce7,stroke:#15803d,color:#111

    F0["Friend opens /friend<br/>draws on duck, picks action,<br/>writes text or records video, sends"]:::friend
    F0 --> Q[(Message queued<br/>bottle floats in the tank)]:::auto

    IDLE["Tank idle: aquarium<br/>fish + frog-tongue shark"]:::auto
    IDLE --> M{"Motion?<br/>(pixel diff in /camera)"}:::cam
    M -- no --> IDLE
    M -- yes --> FACE{"Face?<br/>(Apple Vision, ~10 ms)"}:::cam
    FACE -- no --> IDLE
    FACE -- yes --> OBJ{"Object held up?<br/>(local SAM 3.1)"}:::cam

    OBJ -- no --> WAKE["🔊 Submarine arrives, duck waves"]:::auto
    WAKE --> PEND{"Pending<br/>message?"}:::auto
    PEND -- no --> NO["'Nope, nothing new!'<br/>arm raised, finger wag"]:::auto --> LEAVE
    PEND -- yes --> HAS["Thumbs up:<br/>'Hey, there's a message from Marco!'<br/>⏱ ~3 s"]:::auto

    HAS --> ZOOM["Zoom into porthole"]:::auto
    ZOOM --> PERF["Duck performs friend's request<br/>wearing their drawing"]:::auto
    PERF --> CARD["Message card held by two gloves<br/>⏱ text: 4–12 s · video: until it ends"]:::auto
    CARD --> LIVE["Live camera on the tank<br/>(JPEG frames over WebSocket)<br/>'Smile for Marco! 📸' 3-2-1"]:::cam
    LIVE --> SNAP["Flash: /camera snaps the photo<br/>and uploads the reply"]:::cam
    SNAP --> SENT["🔊🔊 'Sent to Marco!' + photo<br/>⏱ 2.6 s"]:::auto --> LEAVE
    SENT -.-> FR["Photo appears on Marco's /friend page"]:::friend

    OBJ -- yes --> CD["Tank: 3-2-1 'hold it still'"]:::auto
    CD --> STSNAP["/camera captures frame →<br/>SAM cutout (+ Muse Spark gag in live mode)"]:::cam
    STSNAP --> THINK["🔊 Sub: duck with magnifying glass"]:::auto
    THINK -- error --> FAIL["'I couldn't see a thing'"]:::auto --> LEAVE
    THINK -- ok --> STP["Zoom: duck plays with the object"]:::auto
    STP --> THX["'Thanks for the banana!'<br/>⏱ 2.2 s"]:::auto --> LEAVE

    LEAVE["Submarine leaves"]:::auto --> IDLE
```

## Notes

- **No touch, no keys needed** on the tank. Keys exist only for testing (see [KEYS.md](KEYS.md)).
- The reply is **mandatory** and is a **photo**. If `/camera` isn't connected, the tank shows "Open /camera on the Mac to reply" and the sub leaves.
- The message is marked as viewed right after the performance, so it won't come back.
- Show & Tell no longer offers gifting (it needed a choice); the gift endpoint still exists in the backend.
- **Sound:** browsers block audio until the page has been clicked once. If the tank shows "🔇 click anywhere to enable the quack", click it once with the mouse.
