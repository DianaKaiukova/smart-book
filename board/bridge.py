#!/usr/bin/env python3
"""
SmartBook board bridge — PSOC Edge E84 (Infineon Live Lab) -> SmartBook.

Reads the board's UART output (the presence/vision firmware's printf lines),
decides whether a room is occupied, and POSTs OccupancyEvents to the deployed
SmartBook app at /api/occupancy. This is "Path A": the bridge runs on the Live
Lab's remote PC (which has Python via ModusToolbox, plus internet access).

It reads the serial port directly with pyserial, OR tails a Tera Term log file
(--logfile) if you cannot install pyserial on the lab PC.

Only stdlib is used for HTTP (urllib), so the sole optional dependency is
pyserial, and only when reading the port live.

Usage (on the Live Lab remote PC):
    pip install pyserial            # only needed for live serial reading
    set SMARTBOOK_URL=https://smart-book-bxu8.vercel.app
    set OCCUPANCY_INGEST_KEY=...     # the same value set in Vercel
    set ROOM_ID=N.0.15               # which seeded room the board represents
    python bridge.py                 # reads COM4 @ 115200 by default

    # or, tailing a Tera Term log instead of opening the port:
    python bridge.py --logfile C:\\path\\to\\teraterm.log

Config is read from environment variables or the flags below.
See board/README.md for the full session runbook.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

# --------------------------------------------------------------------------- #
# Config (env vars, overridable by flags)
# --------------------------------------------------------------------------- #
DEFAULT_URL = os.environ.get("SMARTBOOK_URL", "http://localhost:3000")
DEFAULT_KEY = os.environ.get("OCCUPANCY_INGEST_KEY", "")
DEFAULT_ROOM = os.environ.get("ROOM_ID", "N.0.15")
DEFAULT_PORT = os.environ.get("SERIAL_PORT", "COM4")   # Live Lab: COM4 KitProg3 USB-UART
DEFAULT_BAUD = int(os.environ.get("SERIAL_BAUD", "115200"))

# How many consecutive same-state readings before we trust a change (debounce).
CONFIRM_READINGS = 3
# Re-send the current state at least this often, even without a change (heartbeat).
HEARTBEAT_SECONDS = 20


# --------------------------------------------------------------------------- #
# Presence parsing  —  >>> ADJUST THIS TO THE REAL SERIAL OUTPUT <<<
# --------------------------------------------------------------------------- #
# Tonight: run `ml-deepcraft-deploy-vision`, watch COM4 in Tera Term, and note
# exactly what the firmware prints when a person is present vs absent. Then edit
# this one function. It returns (occupied, people_count_or_None, confidence_or_None)
# for a line, or None if the line carries no presence information.
#
# The defaults below recognise several common formats so the bridge often works
# out of the box; replace them with the firmware's real wording once you see it.
PRESENT_WORDS = ("person", "people", "present", "occupied", "detected", "human")
ABSENT_WORDS = ("no person", "no people", "absent", "empty", "no detection", "nobody")
_COUNT_RE = re.compile(r"(?:people|persons?|count)\D{0,6}(\d+)", re.IGNORECASE)
_CONF_RE = re.compile(r"(?:conf(?:idence)?|score|prob)\D{0,6}([01](?:\.\d+)?)", re.IGNORECASE)


def parse_presence(line: str):
    """Return (occupied: bool, people: int|None, conf: float|None) or None."""
    text = line.strip().lower()
    if not text:
        return None

    people = None
    m = _COUNT_RE.search(text)
    if m:
        people = int(m.group(1))

    conf = None
    m = _CONF_RE.search(text)
    if m:
        try:
            conf = max(0.0, min(1.0, float(m.group(1))))
        except ValueError:
            conf = None

    # An explicit count wins: 0 => empty, >0 => occupied.
    if people is not None:
        return (people > 0, people, conf)

    if any(w in text for w in ABSENT_WORDS):
        return (False, 0, conf)
    if any(w in text for w in PRESENT_WORDS):
        return (True, people, conf)

    return None  # not a presence line


# --------------------------------------------------------------------------- #
# Posting
# --------------------------------------------------------------------------- #
def iso_now() -> str:
    """UTC timestamp with offset, e.g. 2026-11-28T20:15:03.123456+00:00."""
    return datetime.now(timezone.utc).isoformat()


def post_event(url: str, key: str, room_id: str, occupied: bool,
               people: int | None, conf: float | None) -> None:
    event = {
        "roomId": room_id,
        "occupied": occupied,
        "source": "board",
        "ts": iso_now(),
    }
    if people is not None:
        event["peopleCount"] = people
    if conf is not None:
        event["confidence"] = conf

    body = json.dumps(event).encode("utf-8")
    req = urllib.request.Request(
        url.rstrip("/") + "/api/occupancy",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "x-occupancy-key": key},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"  -> {resp.status} {resp.read().decode('utf-8', 'replace')}")
    except urllib.error.HTTPError as e:
        print(f"  -> HTTP {e.code}: {e.read().decode('utf-8', 'replace')}", file=sys.stderr)
    except urllib.error.URLError as e:
        print(f"  -> network error: {e.reason}", file=sys.stderr)


# --------------------------------------------------------------------------- #
# Line sources
# --------------------------------------------------------------------------- #
def read_serial(port: str, baud: int):
    try:
        import serial  # pyserial
    except ImportError:
        sys.exit("pyserial not installed. Run `pip install pyserial`, "
                 "or use --logfile to tail a Tera Term log instead.")
    with serial.Serial(port, baud, timeout=1) as ser:
        print(f"Reading {port} @ {baud} ...")
        buf = b""
        while True:
            chunk = ser.read(256)
            if not chunk:
                yield None  # idle tick (lets the heartbeat fire)
                continue
            buf += chunk
            while b"\n" in buf:
                raw, buf = buf.split(b"\n", 1)
                yield raw.decode("utf-8", "replace")


def tail_logfile(path: str):
    print(f"Tailing {path} ...")
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        f.seek(0, os.SEEK_END)
        while True:
            line = f.readline()
            if line:
                yield line
            else:
                yield None  # idle tick
                time.sleep(0.5)


# --------------------------------------------------------------------------- #
# Main loop (debounce + heartbeat)
# --------------------------------------------------------------------------- #
def run(lines, url: str, key: str, room_id: str) -> None:
    posted_state = None          # last state we actually sent
    pending_state = None         # candidate state awaiting confirmation
    pending_count = 0
    last_people = None
    last_conf = None
    last_sent_at = 0.0

    if not key:
        print("WARNING: OCCUPANCY_INGEST_KEY is empty. The server will reject "
              "posts unless it runs with no key configured (dev only).",
              file=sys.stderr)
    print(f"Target: {url}/api/occupancy   room={room_id}\n")

    for line in lines:
        now = time.monotonic()

        if line is not None:
            parsed = parse_presence(line)
            if parsed is not None:
                occupied, people, conf = parsed
                last_people, last_conf = people, conf
                if occupied == pending_state:
                    pending_count += 1
                else:
                    pending_state, pending_count = occupied, 1

                # Confirmed a new, stable state -> send it.
                if pending_state != posted_state and pending_count >= CONFIRM_READINGS:
                    posted_state = pending_state
                    last_sent_at = now
                    print(f"[{iso_now()}] state -> {'OCCUPIED' if posted_state else 'empty'} "
                          f"(people={people}, conf={conf})")
                    post_event(url, key, room_id, posted_state, people, conf)

        # Heartbeat: re-assert the current state so the app never goes stale.
        if posted_state is not None and (now - last_sent_at) >= HEARTBEAT_SECONDS:
            last_sent_at = now
            print(f"[{iso_now()}] heartbeat -> {'OCCUPIED' if posted_state else 'empty'}")
            post_event(url, key, room_id, posted_state, last_people, last_conf)


def main() -> None:
    ap = argparse.ArgumentParser(description="SmartBook board bridge (PSOC Edge -> /api/occupancy)")
    ap.add_argument("--url", default=DEFAULT_URL, help="SmartBook base URL")
    ap.add_argument("--key", default=DEFAULT_KEY, help="OCCUPANCY_INGEST_KEY")
    ap.add_argument("--room", default=DEFAULT_ROOM, help="Seeded room id the board represents")
    ap.add_argument("--port", default=DEFAULT_PORT, help="Serial port (Live Lab: COM4)")
    ap.add_argument("--baud", type=int, default=DEFAULT_BAUD, help="Baud rate (default 115200)")
    ap.add_argument("--logfile", help="Tail this Tera Term log instead of opening the serial port")
    args = ap.parse_args()

    source = tail_logfile(args.logfile) if args.logfile else read_serial(args.port, args.baud)
    try:
        run(source, args.url, args.key, args.room)
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
