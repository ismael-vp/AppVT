import pytest

from models.osint_models import OSINTResponse, SSLData
from services.scanners.heuristic_scanner import HeuristicScanner


@pytest.mark.asyncio
async def test_run_full_heuristics_safe():
    """Prueba que un sitio seguro devuelve un score bajo"""
    scanner = HeuristicScanner()
    osint_data = OSINTResponse(url="https://youtube.com")

    result = await scanner.run_full_heuristics("https://youtube.com", "youtube.com", osint_data)

    assert result.risk_score < 50
    assert result.level in ["Bajo", "Seguro"]

@pytest.mark.asyncio
async def test_run_full_heuristics_suspicious_ssl():
    """Prueba que un SSL sospechoso incrementa el score"""
    scanner = HeuristicScanner()
    osint_data = OSINTResponse(url="https://example.com")
    osint_data.ssl = SSLData(is_suspicious=True)

    result = await scanner.run_full_heuristics("https://example.com", "example.com", osint_data)

    assert result.risk_score >= 20
    assert any("SUSPICIOUS_SSL" in flag for flag in result.flags)

@pytest.mark.asyncio
async def test_run_full_heuristics_typosquatting():
    """Prueba que el typosquatting detectado por el motor interno incrementa el score"""
    scanner = HeuristicScanner()
    osint_data = OSINTResponse(url="https://g00gle.com")

    # g00gle.com debe activar Typosquatting
    result = await scanner.run_full_heuristics("https://g00gle.com", "g00gle.com", osint_data)

    assert result.risk_score > 30
    assert result.typosquatting is not None
    assert result.typosquatting.is_typosquatting is True
