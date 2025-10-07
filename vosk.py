#!/usr/bin/env python3

import asyncio
import websockets
import sys
import wave
import json


async def run_test(audio_path, uri):
    async with websockets.connect(uri) as websocket:
        wf = wave.open(audio_path, "rb")

        await websocket.send(json.dumps({
            "config": {"sample_rate": wf.getframerate()}
        }))

        buffer_size = int(wf.getframerate() * 0.2)
        while True:
            data = wf.readframes(buffer_size)
            if len(data) == 0:
                break

            await websocket.send(data)
            msg = await websocket.recv()
            print(msg, flush=True)

        await websocket.send('{"eof" : 1}')
        final_msg = await websocket.recv()

        try:
            result = json.loads(final_msg)
        except json.JSONDecodeError:
            print(json.dumps({"error": "invalid JSON"}), flush=True)
            return

        if "result" in result and isinstance(result["result"], list):
            confs = [w.get("conf", 0.0) for w in result["result"] if "conf" in w]
            avg_conf = sum(confs) / len(confs) if confs else 0.0
            result["conf"] = round(avg_conf, 3)
        else:
            result["conf"] = 0.0

        print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: test.py <audio_path> [url]")
        sys.exit(1)

    audio_path = sys.argv[1]
    uri = sys.argv[2] if len(sys.argv) > 2 else "ws://localhost:2700"

    asyncio.run(run_test(audio_path, uri))
