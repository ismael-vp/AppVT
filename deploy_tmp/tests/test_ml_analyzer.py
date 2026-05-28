from unittest.mock import MagicMock, patch

import pytest

from models.osint_models import OSINTResponse
from services.ml_analyzer import analyze_osint_with_ml


@pytest.fixture
def mock_ml_models():
    with patch("services.ml_analyzer.osint_ml_model", MagicMock()), \
         patch("services.ml_analyzer.structure_ml_model", MagicMock()) as (m1, m2):
        yield m1, m2

def test_analyze_osint_with_ml_null_data():
    """Prueba que devuelve 0 y sin flags si falta WHOIS o SSL (simulando timeout)"""
    osint_data = OSINTResponse(url="https://example.com")
    # whois y ssl son None por defecto

    result = analyze_osint_with_ml("https://example.com", osint_data)
    assert result["ml_score"] == 0
    assert result["flags"] == []

@patch("services.ml_analyzer.structure_ml_model")
@patch("services.ml_analyzer.osint_ml_model")
def test_analyze_osint_with_ml_high_score(mock_osint, mock_struct):
    """Prueba de detección con score alto en ambos modelos"""
    mock_struct.predict_proba.return_value = [[0.1, 0.9]]
    mock_osint.predict_proba.return_value = [[0.2, 0.8]]

    from models.osint_models import SSLData, WhoisData
    osint_data = OSINTResponse(url="https://example.com")
    osint_data.whois = WhoisData()
    osint_data.ssl = SSLData()

    result = analyze_osint_with_ml("https://example.com", osint_data)
    assert result["ml_score"] > 80
    assert any("CRITICAL" in flag for flag in result["flags"])
