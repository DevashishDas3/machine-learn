from __future__ import annotations

import json
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any, Dict, List


SEMANTIC_SCHOLAR_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
ARXIV_API_URL = "https://export.arxiv.org/api/query"


def _normalize_space(value: str) -> str:
    return " ".join((value or "").split())


def _safe_json_get(url: str, timeout_seconds: float = 8.0) -> Any:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "ml-agent-swarm/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:  # noqa: S310
        raw = response.read().decode("utf-8", errors="replace")
    return json.loads(raw)


def _safe_text_get(url: str, timeout_seconds: float = 8.0) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/atom+xml",
            "User-Agent": "ml-agent-swarm/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:  # noqa: S310
        return response.read().decode("utf-8", errors="replace")


def _from_semantic_scholar(query: str, max_results: int) -> List[Dict[str, Any]]:
    params = {
        "query": query,
        "limit": max(1, min(max_results, 20)),
        "fields": "title,abstract,year,url,citationCount,venue",
    }
    url = f"{SEMANTIC_SCHOLAR_URL}?{urllib.parse.urlencode(params)}"
    payload = _safe_json_get(url)

    papers: List[Dict[str, Any]] = []
    for item in payload.get("data", []):
        title = _normalize_space(str(item.get("title", "")))
        if not title:
            continue
        abstract = _normalize_space(str(item.get("abstract", "")))
        papers.append(
            {
                "title": title,
                "summary": abstract[:700],
                "year": item.get("year"),
                "source": "semantic_scholar",
                "url": item.get("url") or "",
                "citation_count": int(item.get("citationCount") or 0),
                "venue": _normalize_space(str(item.get("venue", ""))),
            }
        )

    return papers


def _from_arxiv(query: str, max_results: int) -> List[Dict[str, Any]]:
    params = {
        "search_query": f"all:{query}",
        "start": 0,
        "max_results": max(1, min(max_results, 15)),
        "sortBy": "relevance",
        "sortOrder": "descending",
    }
    url = f"{ARXIV_API_URL}?{urllib.parse.urlencode(params)}"
    xml_text = _safe_text_get(url)

    ns = {"atom": "http://www.w3.org/2005/Atom"}
    root = ET.fromstring(xml_text)

    papers: List[Dict[str, Any]] = []
    for entry in root.findall("atom:entry", ns):
        title = _normalize_space(entry.findtext("atom:title", default="", namespaces=ns))
        if not title:
            continue
        summary = _normalize_space(
            entry.findtext("atom:summary", default="", namespaces=ns)
        )
        published = entry.findtext("atom:published", default="", namespaces=ns)
        year = None
        if len(published) >= 4 and published[:4].isdigit():
            year = int(published[:4])
        url = _normalize_space(entry.findtext("atom:id", default="", namespaces=ns))

        papers.append(
            {
                "title": title,
                "summary": summary[:700],
                "year": year,
                "source": "arxiv",
                "url": url,
                "citation_count": 0,
                "venue": "",
            }
        )

    return papers


def _dedupe_and_rank(papers: List[Dict[str, Any]], max_results: int) -> List[Dict[str, Any]]:
    deduped: Dict[str, Dict[str, Any]] = {}
    for paper in papers:
        key = _normalize_space(str(paper.get("title", "")).lower())
        if not key:
            continue
        existing = deduped.get(key)
        if not existing:
            deduped[key] = paper
            continue
        # Keep the richer record when duplicates are found across sources.
        if len(paper.get("summary", "")) > len(existing.get("summary", "")):
            deduped[key] = paper

    ranked = sorted(
        deduped.values(),
        key=lambda p: (
            int(p.get("citation_count") or 0),
            int(p.get("year") or 0),
            p.get("title", ""),
        ),
        reverse=True,
    )
    return ranked[: max(1, min(max_results, 12))]


def build_research_query(
    task_description: str, dataset_path: str, query_hint: str | None = None
) -> str:
    if query_hint and query_hint.strip():
        return _normalize_space(query_hint)[:240]

    dataset_name = dataset_path.strip().split("/")[-1] if dataset_path else "dataset"
    return _normalize_space(f"{task_description} {dataset_name}")[:240]


def find_related_research(
    task_description: str,
    dataset_path: str,
    query_hint: str | None = None,
    max_results: int = 6,
) -> Dict[str, Any]:
    query = build_research_query(
        task_description=task_description,
        dataset_path=dataset_path,
        query_hint=query_hint,
    )

    papers: List[Dict[str, Any]] = []
    errors: List[str] = []

    try:
        papers.extend(_from_semantic_scholar(query=query, max_results=max_results))
    except Exception as exc:  # noqa: BLE001
        errors.append(f"semantic_scholar:{exc}")

    try:
        papers.extend(_from_arxiv(query=query, max_results=max_results))
    except Exception as exc:  # noqa: BLE001
        errors.append(f"arxiv:{exc}")

    ranked = _dedupe_and_rank(papers, max_results=max_results)

    response: Dict[str, Any] = {
        "query": query,
        "papers": ranked,
        "paper_count": len(ranked),
        "sources": sorted({p.get("source", "") for p in ranked if p.get("source")}),
    }
    if errors:
        response["errors"] = errors
    return response
