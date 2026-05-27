#!/usr/bin/env python3
"""
Entrenamiento del modelo RandomForest para clasificación de URLs (phishing/legítimo)
utilizando características estructurales y de suplantación.

Optimizado para datasets masivos: búsqueda rápida de hiperparámetros,
entrenamiento final con progreso visible y evaluación exhaustiva.

Requiere un dataset con 13 features + label (generado con extract_advanced_features).
"""

import os
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"

import json
import time
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
    roc_auc_score, f1_score, precision_score, recall_score
)
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
logger = logging.getLogger(__name__)

# ----------------------------------------------------------------------
# Rutas y configuración
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
models_dir = os.path.join(base_dir, "models")
os.makedirs(models_dir, exist_ok=True)

MODEL_PATH = os.path.join(models_dir, "phishing_structure_rf.joblib")
METRICS_PATH = os.path.join(models_dir, "phishing_structure_rf_metrics.json")
DATASET_PATH = os.path.join(base_dir, "dataset_structure.csv")  # 13 features + label

# Parámetros para búsqueda rápida (seis combinaciones, 3 folds, 150k muestras)
SEARCH_PARAMS = {
    'n_estimators': [150, 200, 250],          # número de árboles
    'max_depth': [15, 20, 25],                # profundidad máxima
    'min_samples_split': [10, 15],            # regularización
    'min_samples_leaf': [4, 6]
}

# Configuración fija del clasificador
CLASS_WEIGHT = {0: 1, 1: 2}   # penaliza más los falsos negativos (phishing)

# ----------------------------------------------------------------------
def save_metrics(metrics_dict):
    """Guarda un diccionario de métricas en formato JSON."""
    with open(METRICS_PATH, 'w', encoding='utf-8') as f:
        json.dump(metrics_dict, f, indent=2, ensure_ascii=False)
    logger.info(f"Métricas guardadas en {METRICS_PATH}")

# ----------------------------------------------------------------------
def main():
    if not os.path.exists(DATASET_PATH):
        logger.error(f"No se encontró el dataset en {DATASET_PATH}. "
                     "Ejecuta primero el generador de dataset con las características avanzadas.")
        return

    # --- Carga de datos ---
    logger.info("Cargando dataset...")
    t0 = time.time()
    df = pd.read_csv(DATASET_PATH)
    logger.info(f"Carga completada en {time.time()-t0:.2f} s. Dimensiones: {df.shape}")

    X = df.drop(columns=['label'])
    y = df['label']

    total = len(df)
    n_phishing = y.sum()
    n_legit = total - n_phishing
    logger.info(f"Muestras totales: {total}  |  Legítimas: {n_legit}  |  Phishing: {n_phishing}")

    # División estratificada 80/20
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    logger.info(f"Entrenamiento: {len(X_train)}  |  Prueba: {len(X_test)}")

    # El entrenamiento sobre <100k muestras es sumamente rápido (pocos segundos),
    # por lo que no hace falta usar un sample pequeño para pruebas rápidas.
    logger.info("Iniciando Random Search para encontrar hiperparámetros óptimos...")

    # --- Búsqueda de hiperparámetros (rápida) ---
    # Usamos solo 150k muestras para acelerar si el dataset es muy grande
    if len(X_train) > 150_000:
        X_search, _, y_search, _ = train_test_split(
            X_train, y_train, train_size=150_000, stratify=y_train, random_state=42
        )
    else:
        X_search, y_search = X_train, y_train
    logger.info(f"Búsqueda de hiperparámetros sobre {X_search.shape[0]} muestras...")

    base_rf = RandomForestClassifier(class_weight=CLASS_WEIGHT,
                                     random_state=42, n_jobs=2)
    search = RandomizedSearchCV(
        base_rf,
        param_distributions=SEARCH_PARAMS,
        n_iter=6,                    # solo 6 combinaciones aleatorias
        cv=3,                        # validación cruzada 3‑fold
        scoring='f1',                # optimizamos F1 (balance precision/recall)
        random_state=42,
        n_jobs=2,
        verbose=1                    # muestra progreso de cada combinación
    )
    t0 = time.time()
    search.fit(X_search, y_search)
    logger.info(f"Búsqueda completada en {time.time()-t0:.1f} s")
    best_params = search.best_params_
    logger.info(f"Mejores parámetros: {best_params}")

    # --- Entrenamiento final con todos los datos de entrenamiento ---
    final_params = best_params.copy()
    final_params.update({
        'class_weight': CLASS_WEIGHT,
        'random_state': 42,
        'n_jobs': 2,
        'verbose': 1               # muestra cada árbol construido
    })

    logger.info("Entrenando modelo final con todos los datos de entrenamiento...")
    t0 = time.time()
    final_rf = RandomForestClassifier(**final_params)
    final_rf.fit(X_train, y_train)
    logger.info(f"Entrenamiento completado en {time.time()-t0:.1f} s")

    # --- Evaluación detallada en el conjunto de prueba ---
    y_pred = final_rf.predict(X_test)
    y_proba = final_rf.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)

    logger.info("--- Resultados en Test ---")
    logger.info(f"Accuracy  : {acc:.4f} ({acc*100:.2f}%)")
    logger.info(f"F1 Score  : {f1:.4f}")
    logger.info(f"Precision : {prec:.4f}")
    logger.info(f"Recall    : {rec:.4f}")
    logger.info(f"AUC-ROC   : {auc:.4f}")

    print("\n--- Reporte de Clasificación ---")
    print(classification_report(y_test, y_pred, target_names=["Legítimo", "Phishing"]))

    # Matriz de confusión normalizada
    cm = confusion_matrix(y_test, y_pred)
    cm_norm = cm.astype('float') / cm.sum(axis=1)[:, np.newaxis]
    print("\nMatriz de Confusión (normalizada por fila):")
    print(f"Legítimo correcto : {cm_norm[0,0]:.2%}  |  Legítimo -> Phishing : {cm_norm[0,1]:.2%}")
    print(f"Phishing correcto : {cm_norm[1,1]:.2%}  |  Phishing -> Legítimo : {cm_norm[1,0]:.2%}")

    # Importancia de las características
    feature_names = X.columns
    importances = final_rf.feature_importances_
    indices = np.argsort(importances)[::-1]
    logger.info("Importancia de características (orden descendente):")
    for i in indices:
        logger.info(f"  {feature_names[i]:20s}: {importances[i]:.4f}")

    # --- Guardar métricas y modelo ---
    metrics = {
        "dataset_samples": total,
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "best_params": best_params,
        "test_accuracy": acc,
        "test_f1": f1,
        "test_precision": prec,
        "test_recall": rec,
        "test_auc": auc,
        "confusion_matrix_normalized": cm_norm.tolist(),
        "feature_importances": {name: float(imp) for name, imp in zip(feature_names, importances)}
    }
    save_metrics(metrics)

    joblib.dump(final_rf, MODEL_PATH, compress=3)
    logger.info(f"Modelo guardado en {MODEL_PATH} "
                f"({os.path.getsize(MODEL_PATH)/1024:.1f} KB)")

if __name__ == "__main__":
    main()
