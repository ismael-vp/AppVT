from unittest.mock import MagicMock, patch

import pytest

from services.scanners.ssl_scanner import SSLScanner


@pytest.mark.asyncio
@patch("ssl.create_default_context")
@patch("asyncio.open_connection")
async def test_get_ssl_info_valid(mock_open_connection, mock_create_context):
    """Prueba que el escáner SSL parsea correctamente un certificado válido"""
    mock_reader = MagicMock()
    mock_writer = MagicMock()
    mock_writer.get_extra_info.return_value = {
        'notBefore': 'Jan  1 00:00:00 2020 GMT',
        'notAfter': 'Jan  1 00:00:00 2030 GMT',
        'issuer': ((('organizationName', 'Test CA'),),)
    }
    mock_open_connection.return_value = (mock_reader, mock_writer)

    result = await SSLScanner.get_ssl_info("example.com")

    assert result is not None
    assert result.issuer == "Test CA"
    assert result.is_suspicious is False

@pytest.mark.asyncio
async def test_get_ssl_info_invalid_hostname():
    """Prueba que el escáner maneja correctamente hostnames inválidos"""
    result = await SSLScanner.get_ssl_info("not_a_valid_hostname_!@#")
    assert result is None
