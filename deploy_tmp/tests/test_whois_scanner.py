from unittest.mock import AsyncMock, patch

import pytest

from services.scanners.whois_scanner import WhoisScanner


@pytest.mark.asyncio
@patch("httpx.AsyncClient.get")
async def test_get_whois_rdap_success(mock_get):
    """Prueba que el RDAP parsea correctamente cuando devuelve 200"""
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "events": [
            {"eventAction": "registration", "eventDate": "2000-01-01T00:00:00Z"},
            {"eventAction": "expiration", "eventDate": "2030-01-01T00:00:00Z"}
        ]
    }
    mock_get.return_value = mock_response

    result = await WhoisScanner.get_whois("google.com")

    assert result is not None
    assert result.creation_date is not None
    assert "2000-01-01" in result.creation_date

@pytest.mark.asyncio
@patch("httpx.AsyncClient.get")
@patch("whois.whois")
async def test_get_whois_rdap_fails_fallback_to_whois(mock_whois, mock_get):
    """Prueba el fallback a python-whois si RDAP falla"""
    mock_get.return_value.status_code = 404

    import datetime
    mock_whois_obj = type("obj", (object,), {
        "creation_date": datetime.datetime(2010, 1, 1),
        "registrar": "Test Registrar"
    })
    mock_whois.return_value = mock_whois_obj

    result = await WhoisScanner.get_whois("example.com")
    assert result is not None
    assert "2010-01-01" in result.creation_date
    assert result.registrar == "Test Registrar"
