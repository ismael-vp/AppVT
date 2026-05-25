"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import axios from 'axios';
import { useThreatStore } from '@/store/useThreatStore';
import { Link, Search, X, Trash2, ScanLine } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { useSearchParams } from 'next/navigation';

function AnalyzeFormInner() {
  const { mode, setMode, setIsScanning, setScanResult, setError, isScanning, scanResult } = useThreatStore();
  const [urlInput, setUrlInput] = useState('');
  const [imageInput, setImageInput] = useState<File | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Iniciando análisis...');
  const searchParams = useSearchParams();
  const urlParam = searchParams.get('url');

  // 1. NUEVO ESTADO: Para guardar la URL segura de la imagen
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [hasAutoScanned, setHasAutoScanned] = useState(false);

  // --- EFECTO: Gestor de Memoria para la previsualización de imágenes (Fix Blob Leak) ---
  useEffect(() => {
    if (!imageInput) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(imageInput);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [imageInput]);

  // --- EFECTO: Sincronización del input con el historial ---
  useEffect(() => {
    if (scanResult && scanResult.type === 'url' && scanResult.resourceName) {
      setUrlInput(scanResult.resourceName);
    }
  }, [scanResult]);

  // --- EFECTO: Auto-scan si viene url en los parámetros ---
  useEffect(() => {
    if (urlParam && !hasAutoScanned) {
      setUrlInput(urlParam);
      setMode('url');
      setHasAutoScanned(true);

      const doAutoScan = async () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        setError(null);
        setIsScanning(true);
        setScanResult(null);

        try {
          const response = await axios.post(`${API_URL}/api/analyze/url`,
            { url: urlParam },
            { signal: abortControllerRef.current.signal }
          );
          setScanResult(response.data, urlParam);
        } catch (err: unknown) {
          if (axios.isCancel(err) || abortControllerRef.current?.signal.aborted) return;
          setError('Error al realizar el análisis automático.');
        } finally {
          if (!abortControllerRef.current?.signal.aborted) {
            setIsScanning(false);
          }
        }
      };
      
      doAutoScan();
    }
  }, [urlParam, hasAutoScanned, setMode, setIsScanning, setScanResult, setError]);

  // --- EFECTO: Gestor de mensajes de carga ---
  useEffect(() => {
    if (!isScanning) return;
    const messages = mode === 'url'
      ? ['Analizando estructura...', 'Consultando indicadores...', 'Sintetizando veredicto...']
      : ['Extrayendo texto...', 'Analizando contenido...', 'Generando reporte...'];

    let i = 0;
    const interval = setInterval(() => {
      setLoadingMessage(messages[i % messages.length]);
      i++;
    }, 3000);

    return () => clearInterval(interval);
  }, [isScanning, mode]);

  // --- COMPRESIÓN DE IMÁGENES CLIENT-SIDE ---
  const handleImageSelection = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1200;
      const MAX_HEIGHT = 1200;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height *= MAX_WIDTH / width));
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width *= MAX_HEIGHT / height));
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (blob) {
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          setImageInput(compressedFile);
        } else {
          setImageInput(file);
        }
        URL.revokeObjectURL(objectUrl);
      }, 'image/jpeg', 0.85);
    };

    img.onerror = () => {
      setImageInput(file);
      URL.revokeObjectURL(objectUrl);
    };
  };

  // --- EFECTO: Escuchar evento Paste Global ---
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (mode !== 'image' || isScanning) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) handleImageSelection(file);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [mode, isScanning]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setError(null);
    setIsScanning(true);
    setScanResult(null);

    try {
      if (mode === 'url') {
        if (!urlInput) {
          setError("Por favor, introduce una URL válida para analizar.");
          setIsScanning(false);
          return;
        }

        const response = await axios.post(`${API_URL}/api/analyze/url`,
          { url: urlInput },
          { signal: abortControllerRef.current.signal }
        );
        setScanResult(response.data, urlInput);

      } else if (mode === 'image') {
        if (!imageInput) {
          setError("Por favor, selecciona una imagen para analizar.");
          setIsScanning(false);
          return;
        }
        const formData = new FormData();
        formData.append('file', imageInput);

        const response = await axios.post(`${API_URL}/api/analyze/image`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal: abortControllerRef.current.signal
        });
        setScanResult(response.data, imageInput.name);
      }
    } catch (err: unknown) {
      if (axios.isCancel(err) || abortControllerRef.current?.signal.aborted) {
        return;
      }

      if (axios.isAxiosError(err) && err.response && err.response.data && err.response.data.detail) {
        const detail = err.response.data.detail;

        const toUserMessage = (raw: string): string => {
          const clean = raw.replace(/^Value error,\s*/i, '').trim();
          if (clean.toLowerCase().includes('ssrf') || clean.toLowerCase().includes('no es segura')) {
            return 'La URL introducida no es válida o no se puede analizar.';
          }
          if (clean.toLowerCase().includes('dominio válido') || clean.toLowerCase().includes('netloc')) {
            return 'La URL no contiene un dominio válido. Asegúrate de incluir el protocolo (https://...).';
          }
          if (clean.toLowerCase().includes('http') && clean.toLowerCase().includes('protocolo')) {
            return 'La URL debe empezar por https:// o http://.';
          }
          return clean;
        };

        if (Array.isArray(detail)) {
          const firstError = detail[0];
          setError(toUserMessage(firstError.msg || 'Error de validación en los datos enviados.'));
        } else {
          setError(toUserMessage(String(detail)));
        }
      } else {
        setError('Error de conexión con el servidor. ¿Está el backend encendido?');
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setIsScanning(false);
      }
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Tab switcher */}
      <div className="flex gap-1 mb-3">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'url'
              ? 'bg-white text-black'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          }`}
        >
          <Link size={14} />
          URL
        </button>
        <button
          type="button"
          onClick={() => setMode('image')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'image'
              ? 'bg-white text-black'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          }`}
        >
          <ScanLine size={14} />
          Imagen
        </button>
      </div>

      {/* Form card */}
      <div className="bg-[#0d0d0d] border border-zinc-800/50 rounded-xl p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'url' ? (
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
              <input
                id="url"
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://pagina-peligrosa.com"
                className="w-full bg-[#080808] border border-zinc-800/80 text-zinc-200 placeholder-zinc-700 text-sm rounded-lg py-3.5 pl-10 pr-10 focus:outline-none focus:border-zinc-600 transition-colors"
                disabled={isScanning}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setUrlInput('')}
                className={`absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-600 hover:text-zinc-300 transition-colors ${urlInput && !isScanning ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <div>
              <label
                htmlFor="dropzone-image"
                className="flex flex-col items-center justify-center w-full h-36 border border-zinc-800/80 border-dashed rounded-lg cursor-pointer bg-[#080808] hover:bg-zinc-900/50 transition-colors"
              >
                {previewUrl ? (
                  <div className="relative w-full h-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Vista previa" className="w-full h-full object-contain p-2" />
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setImageInput(null); }}
                      className="absolute top-2 right-2 text-xs text-zinc-400 hover:text-white bg-zinc-900/90 border border-zinc-700 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                    >
                      <Trash2 size={11} />
                      Quitar
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-zinc-600">
                    <ScanLine size={22} />
                    <p className="text-xs">Arrastra o haz clic — JPG, PNG, WEBP</p>
                  </div>
                )}
                <input id="dropzone-image" type="file" accept="image/*" className="hidden"
                  onChange={(e) => setImageInput(e.target.files ? e.target.files[0] : null)}
                  disabled={isScanning}
                />
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={isScanning || (mode === 'url' ? !urlInput : !imageInput)}
            className={`w-full flex items-center justify-center gap-3 font-medium py-3 rounded-lg text-sm transition-all ${
              isScanning
                ? 'bg-zinc-900 text-zinc-500 cursor-wait'
                : (mode === 'url' ? !urlInput : !imageInput)
                ? 'bg-zinc-900/60 text-zinc-600 cursor-not-allowed'
                : 'bg-white text-black hover:bg-zinc-100 active:scale-[0.99]'
            }`}
          >
            {isScanning ? (
              <>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-dot-jump" />
                  <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-dot-jump delay-200" />
                  <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-dot-jump delay-400" />
                </div>
                <span className="text-zinc-500">{loadingMessage}</span>
              </>
            ) : (
              mode === 'image' ? 'Analizar imagen' : 'Analizar'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AnalyzeForm() {
  return (
    <Suspense fallback={<div className="w-full max-w-5xl mx-auto bg-[#0d0d0d] border border-zinc-800/50 p-5 rounded-xl" />}>
      <AnalyzeFormInner />
    </Suspense>
  );
}