from agents.plan_agent import PlanAgent


def test_build_research_digest_compacts_findings() -> None:
    findings = [
        {
            "query": "mnist cnn paper",
            "paper_count": 6,
            "sources": ["arxiv"],
        },
        {
            "query": "mnist svm baseline",
            "paper_count": 4,
            "sources": ["arxiv", "semantic_scholar"],
        },
    ]

    digest = PlanAgent._build_research_digest(findings)

    assert digest["rounds_completed"] == 2
    assert digest["total_papers"] == 10
    assert digest["queries"] == ["mnist cnn paper", "mnist svm baseline"]
    assert digest["sources"] == ["arxiv", "semantic_scholar"]
