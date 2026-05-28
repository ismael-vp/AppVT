import sqlite3

import pytest

from services.feed_service import FeedService


@pytest.fixture
def mock_feed_service():
    """Crea una instancia limpia del servicio con DB en memoria"""
    service = FeedService()
    service.db_path = ":memory:"
    service._conn = sqlite3.connect(service.db_path, check_same_thread=False)
    service._conn.execute('''
        CREATE TABLE IF NOT EXISTS feeds (
            url_hash TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    service._initialized = True
    yield service
    if service._conn:
        service._conn.close()

@pytest.mark.asyncio
async def test_check_url_hit(mock_feed_service):
    """Prueba que detecta una URL cuando está en la base de datos"""
    import hashlib
    url = "https://phishing.com/login"
    url_hash = hashlib.sha256(url.encode()).hexdigest()

    mock_feed_service._conn.execute(
        "INSERT INTO feeds (url_hash, source) VALUES (?, ?)",
        (url_hash, "OpenPhish")
    )
    mock_feed_service._conn.commit()

    result = await mock_feed_service.check_url(url)
    assert result.detected is True
    assert result.source == "OpenPhish"

@pytest.mark.asyncio
async def test_check_url_miss(mock_feed_service):
    """Prueba que no detecta una URL que no está en la base de datos"""
    result = await mock_feed_service.check_url("https://google.com")
    assert result.detected is False
    assert result.source is None
