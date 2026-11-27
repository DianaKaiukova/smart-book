# Board integration — PSOC Edge E84 (Infineon Live Lab)

Connects the real board to the deployed SmartBook app as the live occupancy
source, replacing the simulator. The board detects whether a room is occupied;
[`bridge.py`](bridge.py) forwards that to `POST /api/occupancy`.

**Deployed app:** https://smart-book-bxu8.vercel.app
**Live Lab:** https://infineon-live-lab.tenxerlabs.com/app/psoc-edge-e84 (myInfineon login)

## Architecture

```
PSOC Edge E84  --UART/printf-->  Tera Term (COM4 @ 115200)
   (vision firmware, lab webcam)        |
                                        v
                         bridge.py (on the Live Lab remote PC)
                                        |  HTTPS POST + x-occupancy-key
                                        v
                 https://smart-book-bxu8.vercel.app/api/occupancy
                                        |
                                        v
                        SmartBook live map / ghost + squatter logic
```

**Path A (this bridge, reliable):** firmware prints presence on UART → Python
bridge on the lab PC reads it → POSTs to the app.
**Path B (stretch, best "use of the board"):** modify a Wi-Fi example
(`wifi-secure-tcp-client` / HTTPS) so the **board itself** POSTs to
`/api/occupancy`. Same payload and header as below.

## Known from the docs (no need to rediscover in-session)

- **Serial:** Tera Term on the remote PC, **COM4 "KitProg3 USB-UART", 115200 8N1**.
- **Presence firmware:** `ml-deepcraft-deploy-vision` (uses the lab webcam) — run
  it from ModusToolbox Project Creator. `ml-face-id` / `rock-paper-scissors-game`
  cover Face ID / gesture for the door-assistant stretch (S5).
- **Getting the bridge onto the PC:** the Developer Workspace **File Upload/Import**
  drops files into `C:\Users\DELL\AppData\Local\Programs\Imagimob Studio\USER_UPLOADED_FILE\`.
- **Python** is available on the remote PC (bundled with ModusToolbox / VS Code).
- **Network:** the remote PC has internet (Project Creator downloads libraries),
  and a phone is wired in to test the board's Wi-Fi.

### The one thing to verify in-session
Can the remote PC reach **our** app? Open https://smart-book-bxu8.vercel.app in the
remote PC's browser (or `curl` it). If yes → Path A works as-is.

## The ingest contract (what bridge.py sends)

`POST /api/occupancy`
Header: `x-occupancy-key: <OCCUPANCY_INGEST_KEY>` (the value set in Vercel)
Body (one event, or an array of up to 200):

```json
{
  "roomId": "N.0.15",
  "occupied": true,
  "source": "board",
  "ts": "2026-11-28T20:15:03+00:00",
  "peopleCount": 2,      // optional
  "confidence": 0.94     // optional (0..1)
}
```

`roomId` must be a **seeded** room (e.g. `N.0.15`, the ghost-demo room).
Success → `202 {accepted, unknownRooms}`. Bad key → `401`. Unknown room → `422`.

## Session runbook

1. **Reach check** — open the app URL in the remote PC's browser. ✅ → continue.
2. **Run presence firmware** — in ModusToolbox, create + program
   `ml-deepcraft-deploy-vision` on `KIT_PSE84_EVAL_EPC2`. Open **Tera Term** on
   **COM4 @ 115200**.
3. **Capture the real output** — wave at / step in front of the webcam vs. clear
   it. Copy ~20–40 lines for present and absent into `board/board-serial-sample.txt`.
4. **Tune the parser** — edit `parse_presence()` in [`bridge.py`](bridge.py) so it
   matches what the firmware actually prints (the defaults catch common wordings
   like "person", "people: N", "no detection").
5. **Upload + run the bridge** on the remote PC:
   ```bat
   pip install pyserial
   set SMARTBOOK_URL=https://smart-book-bxu8.vercel.app
   set OCCUPANCY_INGEST_KEY=<the value from Vercel>
   set ROOM_ID=N.0.15
   python bridge.py
   ```
   (No pyserial? `python bridge.py --logfile <teraterm.log>` tails a Tera Term log.)
6. **Switch the app to the board** — in Vercel, set `OCCUPANCY_SOURCE=board` and
   redeploy. The live map now reflects the real board; N.0.15 flips Free⇄Occupied
   as people appear, driving the ghost / auto-check-in / squatter logic.
7. **Rehearse** the full demo 2–3× and record a backup video.

## Files

- [`bridge.py`](bridge.py) — serial/log → `/api/occupancy` bridge (stdlib HTTP; pyserial only for live serial).
- `board-serial-sample.txt` — captured real serial output (add during the session).
