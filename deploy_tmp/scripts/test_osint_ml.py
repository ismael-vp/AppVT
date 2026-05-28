#!/usr/bin/env python3
"""
Prueba del modelo OSINT sobre una URL real.

Uso: python test_osint_ml.py <URL>
"""

import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ml_analyzer import analyze_osint_with_ml
from services.osint_service import OSINTService

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

async def main():
    if len(sys.argv) < 2:
        print("Uso: python test_osint_ml.py <URL>")
        print("Ejemplo: python test_osint_ml.py https://secure-login-paypal.com/update")
        return

    url = sys.argv[1]
    print(f"\nAnalizando URL con modelo OSINT: {url}\n")

    # 1. Recopilar datos OSINT (con timeout y manejo de errores)
    try:
        print("[1/2] Recopilando datos OSINT... (puede tardar ~10-20s)")
        osint_data = await asyncio.wait_for(
            OSINTService.get_osint_data(url),
            timeout=30.0   # tiempo máximo de espera
        )
        print("✓ Datos OSINT obtenidos.")
    except asyncio.TimeoutError:
        logger.warning("Timeout al obtener datos OSINT. Se usarán valores por defecto (riesgo alto).")
        from models.osint_models import OSINTResponse
        osint_data = OSINTResponse()  # objeto vacío -> características por defecto
    except Exception as e:
        logger.error(f"Error al obtener OSINT: {e}. Se usarán valores por defecto.")
        from models.osint_models import OSINTResponse
        osint_data = OSINTResponse()

    # 2. Analizar con el modelo
    print("\n[2/2] Analizando con el modelo ML OSINT...")
    try:
        resultado = analyze_osint_with_ml(url, osint_data)
    except FileNotFoundError as e:
        print(f"\n❌ Error: {e}")
        print("Asegúrate de haber entrenado el modelo OSINT (train_osint_ml.py).")
        return

    # 3. Mostrar resultados
    print("\n=== RESULTADO DEL MODELO ML OSINT ===")
    print(f"Puntuación de Riesgo (0-100): {resultado['ml_score']}")

    if resultado['flags']:
        print("Banderas detectadas:")
        for flag in resultado['flags']:
            print(f" - {flag}")
    else:
        print("El modelo considera que esta URL es SEGURA basándose en el OSINT.")
    print("======================================\n")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
