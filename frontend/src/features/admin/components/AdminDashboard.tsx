"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { Lock, Loader2, ArrowRight, Mail, Key } from 'lucide-react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { User } from '@supabase/supabase-js';
import { verifyAdminAccess } from '@/app/actions/admin';

// Lazy loading del verdadero dashboard
const AdminDashboardContent = dynamic(
  () => import('./AdminDashboardContent'),
  { 
    loading: () => (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-500">
        <Loader2 className="animate-spin size-8 mb-4" />
        <p>Cargando panel de administración...</p>
      </div>
    ),
    ssr: false
  }
);

export default function AdminDashboard() {
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string>();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  useEffect(() => {
    // Restaurar bloqueo de localStorage para evitar bypass por recarga de página (F5)
    const storedLockout = localStorage.getItem('admin_lockout_until');
    if (storedLockout) {
      const parsed = parseInt(storedLockout, 10);
      if (!isNaN(parsed) && Date.now() < parsed) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLockoutUntil(parsed);
      } else {
        localStorage.removeItem('admin_lockout_until');
        localStorage.removeItem('admin_failed_attempts');
      }
    }

    const checkSession = async (user: User | null) => {
      setSessionUser(user);
      if (user) {
        // Validación en el servidor para ocultar el email administrador
        const valid = await verifyAdminAccess(user.email);
        setIsAdmin(valid);
      } else {
        setIsAdmin(false);
      }
      setLoadingSession(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      checkSession(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      checkSession(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Temporizador para limpiar el mensaje de lockout
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      if (Date.now() >= lockoutUntil) {
        setLockoutUntil(null);
        localStorage.removeItem('admin_lockout_until');
        localStorage.removeItem('admin_failed_attempts');
        setLoginError('');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    if (lockoutUntil && Date.now() < lockoutUntil) {
      setIsLoggingIn(false);
      return;
    }

    if (!captchaToken) {
      setLoginError('Por favor, completa la verificación de seguridad.');
      setIsLoggingIn(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken }
    });

    if (error) {
      // Mensaje genérico siempre para evitar User Enumeration
      setLoginError('Acceso denegado. Credenciales inválidas o cuenta protegida.');
      
      const prevAttempts = parseInt(localStorage.getItem('admin_failed_attempts') || '0', 10);
      const newAttempts = prevAttempts + 1;
      localStorage.setItem('admin_failed_attempts', newAttempts.toString());
      
      if (newAttempts >= 3) {
        const lockoutTime = Date.now() + 60 * 1000; // Bloqueo de 60 segundos
        setLockoutUntil(lockoutTime);
        localStorage.setItem('admin_lockout_until', lockoutTime.toString());
      }

      setCaptchaToken(undefined);
      turnstileRef.current?.reset();
    } else {
      // Reseteo de seguridad en caso de éxito
      localStorage.removeItem('admin_failed_attempts');
      localStorage.removeItem('admin_lockout_until');
      setLockoutUntil(null);
    }
    
    setIsLoggingIn(false);
  };

  if (loadingSession || isAdmin === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-500">
        <Loader2 className="animate-spin size-8 mb-4" />
        <p>Comprobando sesión y autorizaciones...</p>
      </div>
    );
  }

  // Si está logueado y el servidor confirmó que es admin, mostramos el dashboard
  if (sessionUser && isAdmin) {
    return <AdminDashboardContent />;
  }

  // Si está logueado pero NO es el admin, mostramos error
  if (sessionUser && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <Lock className="text-red-500 size-16 mb-4" />
        <h2 className="text-xl font-bold text-zinc-200 mb-2">Acceso Denegado</h2>
        <p className="text-zinc-500">Esta cuenta no tiene privilegios de administrador.</p>
        <button 
          onClick={() => {
            setLoadingSession(true);
            supabase.auth.signOut();
          }}
          className="mt-6 text-sm text-zinc-400 hover:text-white underline decoration-zinc-700 underline-offset-4"
        >
          Cerrar Sesión e intentar con otra cuenta
        </button>
      </div>
    );
  }

  // Si no está logueado, mostramos el panel de login normal
  const isLocked = lockoutUntil !== null;

  return (
    <div className="w-full max-w-md mx-auto mt-10 p-8 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col items-center justify-center mb-8">
        <div className="bg-zinc-900 p-4 rounded-full mb-4 border border-zinc-800">
          <Lock size={32} className="text-zinc-400" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100">Portal de Administración</h2>
        <p className="text-sm text-zinc-500 text-center mt-2">
          Identifícate con tus credenciales de acceso para gestionar el sistema.
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-zinc-200 placeholder-zinc-700 text-sm focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all duration-200"
              placeholder="admin@phishingscanner.com"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-zinc-200 placeholder-zinc-700 text-sm focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all duration-200"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="flex justify-center pt-2 min-h-[65px]">
          <Turnstile
            ref={turnstileRef}
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''}
            onSuccess={(token) => setCaptchaToken(token)}
            onExpire={() => setCaptchaToken(undefined)}
            onError={() => {
              setCaptchaToken(undefined);
              setLoginError('Error en el CAPTCHA. Inténtalo de nuevo.');
            }}
            options={{ theme: 'dark', size: 'normal' }}
          />
        </div>

        {loginError && !isLocked && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-md flex items-start gap-2">
            <span className="mt-0.5">⚠️</span>
            <span>{loginError}</span>
          </div>
        )}

        {isLocked && (
          <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs p-3 rounded-md flex items-start gap-2 text-center">
            <span className="mt-0.5">⚠️</span>
            <span>Demasiados intentos. Sistema bloqueado temporalmente.</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoggingIn || !captchaToken || isLocked}
          className="w-full bg-white hover:bg-zinc-200 text-black font-semibold py-2.5 rounded-lg flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {isLoggingIn ? (
            <Loader2 size={18} className="animate-spin text-black" />
          ) : (
            <>
              <span>Acceder al Panel</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
