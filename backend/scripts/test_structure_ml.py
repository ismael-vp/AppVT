import sys
import os

# Añadir backend al sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ml_analyzer import analyze_structure_with_ml

def main():
    if len(sys.argv) < 2:
        print("Uso: python test_structure_ml.py <URL>")
        print("Ejemplo: python test_structure_ml.py https://secure-login-paypal.com/update")
        return

    url = sys.argv[1]
    print(f"\nAnalizando estructura de: {url}\n")
    
    resultado = analyze_structure_with_ml(url)
    
    print("=== RESULTADO DEL MODELO DE MACHINE LEARNING ===")
    print(f"Puntuación de Riesgo (0-100): {resultado['ml_score']}")
    
    if resultado['flags']:
        print("Banderas (Alertas) detectadas:")
        for flag in resultado['flags']:
            print(f" - {flag}")
    else:
        print("El modelo considera que la estructura de esta URL es SEGURA.")
    print("===============================================\n")

if __name__ == "__main__":
    main()
