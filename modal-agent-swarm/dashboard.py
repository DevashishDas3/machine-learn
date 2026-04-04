"""
Local live monitor for `modal run orchestrator.py`.

Writes events to runs_local/<run_id>/events.jsonl on the machine running the entrypoint.
In another terminal: pip install streamlit && streamlit run dashboard.py
"""

from __future__ import annotations

import json
from pathlib import Path

import streamlit as st

from utils.run_events import list_run_ids, load_events_jsonl, runs_local_root

st.set_page_config(page_title="ML Agent Swarm", layout="wide")
st.title("ML Agent Swarm — run monitor")
st.caption(
    "Events are recorded locally while `modal run orchestrator.py` executes on your machine. "
    "Refresh this page to see new steps."
)

runs_root = runs_local_root()
run_ids = list_run_ids()

col_a, col_b = st.columns([1, 2])
with col_a:
    pick = st.selectbox(
        "Run",
        options=run_ids if run_ids else ["(no runs yet)"],
        index=0 if run_ids else 0,
    )
with col_b:
    st.text_input("Events directory", value=str(runs_root / pick) if pick != "(no runs yet)" else str(runs_root))

if not run_ids or pick == "(no runs yet)":
    st.info(
        "No runs in `runs_local/` yet. Run the pipeline from this folder:\n\n"
        "`modal run orchestrator.py --dataset-path ... --task-description ...`\n\n"
        "Then refresh this page."
    )
    st.stop()

events = load_events_jsonl(pick)
state_path = runs_root / pick / "state.json"
state_txt = ""
if state_path.exists():
    state_txt = state_path.read_text(encoding="utf-8")

tab_timeline, tab_code, tab_report, tab_raw = st.tabs(["Timeline", "Code previews", "Report", "Raw state"])

with tab_timeline:
    for ev in events:
        ts = ev.get("ts", "")
        name = ev.get("event", "?")
        with st.expander(f"{ts} — **{name}**", expanded=name in ("pipeline_started", "pipeline_complete")):
            st.json({k: v for k, v in ev.items() if k not in ("event", "ts", "run_id")})

with tab_code:
    st.subheader("Generated train() code (latest preview per approach)")
    seen: set[str] = set()
    for ev in reversed(events):
        if ev.get("event") != "code_generated":
            continue
        ap = ev.get("approach")
        if ap in seen:
            continue
        seen.add(ap)
        st.markdown(f"### {ap}")
        st.code(ev.get("code_preview") or "", language="python")

    if not seen:
        st.caption("No `code_generated` events yet.")

with tab_report:
    prev = ""
    for ev in reversed(events):
        if ev.get("event") == "report_complete":
            prev = ev.get("report_preview") or ""
            break
    if prev:
        st.markdown(prev)
    else:
        st.caption("No `report_complete` event yet (or report phase not reached).")

with tab_raw:
    st.code(json.dumps(events, indent=2, ensure_ascii=False)[:200_000], language="json")
    if state_txt:
        st.subheader("state.json")
        st.code(state_txt[:100_000], language="json")

st.sidebar.markdown("### How it works")
st.sidebar.markdown(
    "- The orchestrator appends one JSON object per line to `events.jsonl`.\n"
    "- Open this dashboard **before** or **during** a run; use **Refresh** in the browser.\n"
    "- Full artifacts remain on the Modal volume; this UI is for **local progress**."
)
if st.sidebar.button("Reload data"):
    st.rerun()
