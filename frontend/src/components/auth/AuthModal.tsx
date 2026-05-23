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
  const turnstileRef = useRef<TurnstileInstance>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Eliminar efecto de reset en isOpen para evitar error "Turnstile has not been loaded"

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

  const handleOAuth = async (provider: 'google' | 'github') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        }
      });
      if (error) throw error;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Error al iniciar con ${provider}`);
    }
  };

  if (!mounted || typeof document === 'undefined') return null;

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
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-zinc-950 border-l border-zinc-800/50 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        
        {/* Cabecera del Panel */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/50">
          <h2 className="text-sm font-semibold text-zinc-100 tracking-wide uppercase">
            {isLogin ? 'Acceso al Sistema' : 'Nuevo Registro'}
          </h2>
          <button 
            type="button"
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
          
          <button
            onClick={() => handleOAuth('google')}
            type="button"
            className="w-full bg-white hover:bg-gray-100 text-black font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-sm mb-4 border border-zinc-300"
            tabIndex={isOpen ? 0 : -1}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              <path fill="none" d="M1 1h22v22H1z" />
            </svg>
            Continuar con Google
          </button>

          <button
            onClick={() => handleOAuth('github')}
            type="button"
            className="w-full bg-[#24292F] hover:bg-[#24292F]/90 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-sm mb-4"
            tabIndex={isOpen ? 0 : -1}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            Continuar con GitHub
          </button>
          
          <div className="relative flex items-center justify-center mb-6 mt-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <span className="relative bg-zinc-950 px-3 text-xs text-zinc-500 uppercase tracking-widest">O con correo</span>
          </div>

          {/* Email Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                <input 
                  type="email" 
                  id="email-input"
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
                  id="password-input"
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
              {isOpen && (
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
              className="w-full bg-[#111] hover:bg-[#222] border border-[#333] text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4 text-sm"
              tabIndex={isOpen ? 0 : -1}
            >
              {loading ? (
                <div className="animate-spin rounded-full size-4 border-2 border-zinc-600 border-t-zinc-300"></div>
              ) : (
                <>
                  {isLogin ? 'Continuar con Email' : 'Registrarse con Email'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer del Panel */}
        <div className="px-6 py-4 border-t border-zinc-800/50 bg-zinc-950 mt-auto">
          <p className="text-center text-zinc-500 text-xs">
            {isLogin ? '¿No tienes acceso al sistema?' : '¿Ya eres un analista autorizado?'}
            <button 
              type="button"
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
