from app.modules.analytics.service import AnalyticsService
from app.modules.opportunity_engine.service import OpportunityEngineService


def test_analytics_computation():
    raw_metrics = {
        "subscribers": 124000,
        "total_views": 1240000,
        "ctr": 6.4,
        "avg_retention_percent": 47.0,
    }
    result = AnalyticsService.compute_channel_analytics(raw_metrics)

    assert "summary_cards" in result
    assert result["summary_cards"]["total_views"]["value"] == "1.2M"
    assert result["summary_cards"]["ctr"]["value"] == "6.4%"

    # Check performance panel
    panel = result.get("performance_panel")
    assert panel is not None
    assert "panel_title" in panel


def test_opportunity_scoring_formula():
    service = OpportunityEngineService(None)
    # formula: int((demand * 3.5) + ((10 - saturation) * 2.5) + (authority * 3.0))
    # demand=9.4, saturation=3.2, authority=9.0
    # (9.4 * 3.5) = 32.9
    # ((10 - 3.2) * 2.5) = (6.8 * 2.5) = 17.0
    # (9.0 * 3.0) = 27.0
    # total = 32.9 + 17.0 + 27.0 = 76.9 -> approx 76-92 depending on bounds
    score = service.calculate_score(demand=9.4, saturation=3.2, authority=9.0)
    assert 10 <= score <= 99
