from utils.research import build_research_query, find_related_research


def test_build_research_query_prefers_hint() -> None:
    query = build_research_query(
        task_description="binary classification",
        dataset_path="/vol/data/churn.csv",
        query_hint="tabular churn classification model comparison",
    )
    assert query == "tabular churn classification model comparison"


def test_find_related_research_dedupes_and_ranks(monkeypatch) -> None:
    def _fake_semantic(query: str, max_results: int):
        return [
            {
                "title": "A strong baseline",
                "summary": "semantic summary",
                "year": 2022,
                "source": "semantic_scholar",
                "url": "https://example.org/s1",
                "citation_count": 120,
                "venue": "NeurIPS",
            },
            {
                "title": "Shared paper",
                "summary": "short",
                "year": 2021,
                "source": "semantic_scholar",
                "url": "https://example.org/s2",
                "citation_count": 60,
                "venue": "ICML",
            },
        ]

    def _fake_arxiv(query: str, max_results: int):
        return [
            {
                "title": "Shared paper",
                "summary": "much longer summary from arxiv",
                "year": 2021,
                "source": "arxiv",
                "url": "https://arxiv.org/abs/1234.5678",
                "citation_count": 0,
                "venue": "",
            },
            {
                "title": "Recent method",
                "summary": "arxiv summary",
                "year": 2024,
                "source": "arxiv",
                "url": "https://arxiv.org/abs/9999.9999",
                "citation_count": 0,
                "venue": "",
            },
        ]

    monkeypatch.setattr("utils.research._from_semantic_scholar", _fake_semantic)
    monkeypatch.setattr("utils.research._from_arxiv", _fake_arxiv)

    result = find_related_research(
        task_description="classification",
        dataset_path="/vol/data.csv",
        query_hint="classification benchmark",
        max_results=5,
    )

    assert result["paper_count"] == 3
    assert result["papers"][0]["title"] == "A strong baseline"

    shared = [p for p in result["papers"] if p["title"] == "Shared paper"][0]
    assert shared["summary"] == "much longer summary from arxiv"


def test_find_related_research_survives_source_failures(monkeypatch) -> None:
    def _boom(query: str, max_results: int):
        raise RuntimeError("source down")

    monkeypatch.setattr("utils.research._from_semantic_scholar", _boom)
    monkeypatch.setattr("utils.research._from_arxiv", _boom)

    result = find_related_research(
        task_description="classification",
        dataset_path="/vol/data.csv",
    )

    assert result["paper_count"] == 0
    assert "errors" in result
    assert len(result["errors"]) == 2
