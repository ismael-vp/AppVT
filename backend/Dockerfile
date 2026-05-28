FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    gcc \
    libtesseract-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# SOLUCIÓN 2: Crear un Virtual Environment nativo
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.12-slim AS runtime

# SOLUCIÓN 3: Definir el HOME explícitamente para HF Spaces
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONHASHSEED=random \
    MALLOC_ARENA_MAX=2 \
    PIP_NO_CACHE_DIR=1 \
    HOME=/home/appuser

RUN groupadd --gid 1000 appgroup && \
    useradd --uid 1000 --gid appgroup --shell /bin/false --create-home appuser

RUN DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-spa \
    tesseract-ocr-eng \
    whois \
    libzbar0 \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# SOLUCIÓN 1: Crear el directorio y asignar permisos ANTES del WORKDIR
RUN mkdir -p /app && chown -R appuser:appgroup /app
WORKDIR /app

# Copiar el Virtual Environment desde el builder (ya limpio de basura de compilación)
COPY --chown=appuser:appgroup --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copiar el código del proyecto
COPY --chown=appuser:appgroup . .

# Asegurar permisos recursivos globales de lectura/escritura para SQLite
RUN chown -R appuser:appgroup /app && chmod -R 775 /app

USER appuser

# NOTA: En HF Spaces es mejor omitir el HEALTHCHECK de Docker, 
# ya que su propio balanceador de carga gestiona el estado de salud.

EXPOSE 7860

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1", "--timeout-keep-alive", "5"]