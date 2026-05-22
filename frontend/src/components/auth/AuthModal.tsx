"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { X, Mail, Key, ArrowRight } from 'lucide-react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>();
  const [showTurnstile, setShowTurnstile] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Controlar renderizado para animaciones de salida
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setShowTurnstile(true), 350);
      return () => clearTimeout(timer);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowTurnstile(false);
    }
  }, [isOpen]);

  // Cerrar al pulsar Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Bloquear el scroll del fondo mientras el panel esté abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Resetear captcha al cambiar entre login/registro
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCaptchaToken(undefined);
    turnstileRef.current?.reset();
  }, [isLogin]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!captchaToken) {
      setError('Por favor, completa la verificación de seguridad.');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken },
        });
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Correo o contraseña incorrectos.');
          }
          throw error;
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { captchaToken },
        });
        if (error) throw error;
        
        // Supabase protege contra enumeración de correos
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error('Ya existe una cuenta con este correo electrónico.');
        }
      }
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Ha ocurrido un error inesperado';
      setError(errorMessage);
      // Resetear captcha tras un error para que el usuario pueda reintentar
      setCaptchaToken(undefined);
      turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  // const handleOAuth = async (provider: 'google' | 'github') => {
  //   try {
  //     const { error } = await supabase.auth.signInWithOAuth({
  //       provider,
  //       options: {
  //         redirectTo: window.location.origin,
  //       }
  //     });
  //     if (error) throw error;
  //   } catch (err: unknown) {
  //     setError(err instanceof Error ? err.message : 'OAuth error');
  //   }
  // };

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Overlay oscuro para difuminar el fondo */}
      <div 
        className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel lateral derecho (Drawer) */}
      <div 
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-[#0a0a0a] border-l border-zinc-800/50 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        
        {/* Cabecera del Panel */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/50">
          <h2 className="text-sm font-semibold text-zinc-100 tracking-wide uppercase">
            {isLogin ? 'Acceso al Sistema' : 'Nuevo Registro'}
          </h2>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors rounded-full p-1 hover:bg-zinc-800/50 active:scale-95"
            tabIndex={isOpen ? 0 : -1}
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
            {isLogin 
              ? 'Inicia sesión para acceder a tu historial de escaneos y guardar reportes en la nube.'
              : 'Crea una cuenta gratuita para persistir tus análisis de seguridad y compartirlos.'}
          </p>

          {/* Email Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-zinc-200 placeholder-zinc-700 text-sm focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all duration-200 ease-out"
                  placeholder="admin@phishingscanner.com"
                  tabIndex={isOpen ? 0 : -1}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400">Contraseña</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-zinc-200 placeholder-zinc-700 text-sm focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all duration-200 ease-out"
                  placeholder="••••••••"
                  tabIndex={isOpen ? 0 : -1}
                />
              </div>
            </div>

            {/* Cloudflare Turnstile CAPTCHA */}
            <div className="flex justify-center pt-2 min-h-[65px]">
              {showTurnstile && (
                <Turnstile
                  ref={turnstileRef}
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''}
                  onSuccess={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(undefined)}
                  onError={() => {
                    setCaptchaToken(undefined);
                    setError('Error en la verificación de seguridad. Inténtalo de nuevo.');
                  }}
                  options={{
                    theme: 'dark',
                    size: 'normal',
                  }}
                />
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-md flex items-start gap-2">
                <span className="mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading || !captchaToken}
              className="w-full bg-zinc-100 hover:bg-white text-black font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4 text-sm"
              tabIndex={isOpen ? 0 : -1}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
              ) : (
                <>
                  {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer del Panel */}
        <div className="px-6 py-4 border-t border-zinc-800/50 bg-[#0a0a0a] mt-auto">
          <p className="text-center text-zinc-500 text-xs">
            {isLogin ? '¿No tienes acceso al sistema?' : '¿Ya eres un analista autorizado?'}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 text-zinc-300 hover:text-white font-medium transition-colors border-b border-zinc-700 hover:border-zinc-400 pb-0.5"
              tabIndex={isOpen ? 0 : -1}
            >
              {isLogin ? 'Solicitar registro' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </div>
    </>,

    document.body
  );
};
