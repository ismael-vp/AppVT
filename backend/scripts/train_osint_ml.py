#!/usr/bin/env python3
"""
Entrenamiento del modelo OSINT (RandomForest) con dataset sintético robusto.
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

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
models_dir = os.path.join(base_dir, "models")
os.makedirs(models_dir, exist_ok=True)

MODEL_PATH = os.path.join(models_dir, "phishing_osint_rf.joblib")
METRICS_PATH = os.path.join(models_dir, "phishing_osint_rf_metrics.json")
DATASET_PATH = os.path.join(base_dir, "dataset_osint.csv")

SEARCH_PARAMS = {
    'n_estimators': [150, 250, 350],
    'max_depth': [12, 15, 20],
    'min_samples_split': [8, 12],
    'min_samples_leaf': [3, 5]
}

def main():
    if not os.path.exists(DATASET_PATH):
        logger.error(f"No se encontró {DATASET_PATH}")
        return

    df = pd.read_csv(DATASET_PATH)
    X = df.drop(columns=['label'])
    y = df['label']
    logger.info(f"Muestras: {len(df)} | Legítimas: {(y==0).sum()} | Phishing: {y.sum()}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    base_rf = RandomForestClassifier(class_weight='balanced', random_state=42, n_jobs=2)
    search = RandomizedSearchCV(
        base_rf, SEARCH_PARAMS, n_iter=8, cv=3, scoring='f1',
        random_state=42, n_jobs=2, verbose=1
    )
    search.fit(X_train, y_train)
    logger.info(f"Mejores parámetros: {search.best_params_}")

    best_rf = RandomForestClassifier(**search.best_params_, class_weight='balanced',
                                     random_state=42, n_jobs=2)
    best_rf.fit(X_train, y_train)

    y_pred = best_rf.predict(X_test)
    y_proba = best_rf.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)

    logger.info(f"Accuracy: {acc:.4f}  F1: {f1:.4f}  Precision: {prec:.4f}  Recall: {rec:.4f}  AUC: {auc:.4f}")
    print(classification_report(y_test, y_pred, target_names=["Legítimo", "Phishing"]))

    cm = confusion_matrix(y_test, y_pred)
    print("Matriz de confusión:\n", cm)

    importances = best_rf.feature_importances_
    indices = np.argsort(importances)[::-1]
    logger.info("Importancia de características:")
    for i in indices:
        logger.info(f"  {X.columns[i]:20s}: {importances[i]:.4f}")

    metrics = {
        "best_params": search.best_params_,
        "test_accuracy": acc, "test_f1": f1, "test_precision": prec,
        "test_recall": rec, "test_auc": auc,
        "feature_importances": {X.columns[i]: float(importances[i]) for i in indices}
    }
    with open(METRICS_PATH, 'w') as f:
        json.dump(metrics, f, indent=2)

    joblib.dump(best_rf, MODEL_PATH, compress=3)
    logger.info(f"Modelo guardado en {MODEL_PATH}")

if __name__ == "__main__":
    main()
