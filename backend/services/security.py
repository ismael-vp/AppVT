"""
Constantes y utilidades de seguridad compartidas entre servicios.

Centraliza patrones de prompt injection para evitar duplicación entre
ai_service.py e image_phishing_service.py.
"""

import re

PROMPT_INJECTION_PATTERNS: list[re.Pattern] = [
    re.compile(r"ignore\s+(all\s+)?(previous\s+)?instructions?", re.I),
    re.compile(r"ignore\s+(the\s+)?system\s+prompt", re.I),
    re.compile(r"you\s+are\s+now\s+a", re.I),
    re.compile(r"from\s+now\s+on\s+you\s+are", re.I),
    re.compile(r"disregard\s+(all\s+)?(previous\s+)?(instructions?|rules?)", re.I),
    re.compile(r"forget\s+(all\s+)?(previous\s+)?(instructions?|context)", re.I),
    re.compile(r"new\s+instruction[s]?:", re.I),
    re.compile(r"system\s*:\s*", re.I),
    re.compile(r"user\s*:\s*", re.I),
    re.compile(r"assistant\s*:\s*", re.I),
    re.compile(r"<\/\s*(system|user|assistant)\s*>", re.I),
    re.compile(r"\[\s*(system|user|assistant)\s*\]", re.I),
    re.compile(r"DAN\s*\(|Do\s+Anything\s+Now", re.I),
    re.compile(r"jailbreak", re.I),
    re.compile(r"developer\s+mode", re.I),
]


def sanitize_untrusted_text(text: str) -> str:
    """Sanitiza texto no confiable sustituyendo patrones de prompt injection."""
    if not isinstance(text, str):
        text = str(text)
    for pattern in PROMPT_INJECTION_PATTERNS:
        text = pattern.sub("[CONTENIDO_FILTRADO]", text)
    text = text.replace("<untrusted_text>", "&lt;untrusted_text&gt;")
    text = text.replace("</untrusted_text>", "&lt;/untrusted_text&gt;")
    return text
