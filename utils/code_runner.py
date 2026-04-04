from __future__ import annotations

import json
import multiprocessing as mp
from typing import Any, Dict


def _execute_generated_code(code: str, payload: Dict[str, Any], queue: mp.Queue) -> None:
    namespace: Dict[str, Any] = {}
    try:
        compiled = compile(code, "<generated_train.py>", "exec")
        exec(compiled, namespace)  # noqa: S102
        train = namespace.get("train")
        if not callable(train):
            queue.put({"error": "Generated code must define train(payload: dict) -> dict"})
            return
        result = train(payload)
        if not isinstance(result, dict):
            queue.put({"error": "train() must return a dict"})
            return
        queue.put({"result": result})
    except Exception as exc:  # noqa: BLE001
        queue.put({"error": str(exc)})


def run_generated_code(code: str, payload: Dict[str, Any], timeout_seconds: int = 1200) -> Dict[str, Any]:
    queue: mp.Queue = mp.Queue()
    process = mp.Process(target=_execute_generated_code, args=(code, payload, queue))
    process.start()
    process.join(timeout=timeout_seconds)

    if process.is_alive():
        process.terminate()
        process.join()
        return {"error": f"Execution timed out after {timeout_seconds}s", "metrics": {}}

    if queue.empty():
        return {"error": "No result returned by generated training code.", "metrics": {}}

    outcome = queue.get()
    if "error" in outcome:
        return {"error": outcome["error"], "metrics": {}}

    result = outcome["result"]
    # Keep output JSON-serializable and predictable.
    try:
        json.dumps(result)
    except TypeError:
        return {"error": "Generated training result is not JSON serializable.", "metrics": {}}
    return result
