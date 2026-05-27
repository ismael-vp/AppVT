"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserProfile } from '@/components/auth/UserProfile';
import { Menu, X } from 'lucide-react';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // Ambos hooks DEBEN estar antes de cualquier return condicional (Rules of Hooks)
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 2);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (pathname.startsWith('/report/')) {
    return null;
  }

  const navLinks = [
    { name: 'Inicio', href: '/' },
    { name: 'Análisis en Bloque', href: '/bulk' },
    { name: 'Clasificación', href: '/leaderboard' },
    { name: 'Estadísticas', href: '/dashboard' },
  ];

  return (
    <header
      className={`sticky top-0 z-50 print:hidden transition-all duration-200 ${
        scrolled
          ? 'bg-[#080808]/95 backdrop-blur-md border-b border-zinc-800/80'
          : 'bg-[#080808]/70 backdrop-blur-sm border-b border-zinc-800/40'
      }`}
    >
      <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center gap-8">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group shrink-0" translate="no">
          <div className="relative w-8 h-8 rounded-[10px] overflow-hidden flex items-center justify-center shrink-0 bg-black shadow-sm ring-1 ring-white/10 group-hover:ring-white/20 transition-all">
            <Image 
              src="/icon-192x192.png" 
              alt="PhishingScanner Logo" 
              width={32} 
              height={32} 
              className="object-cover scale-[1.12]"
            />
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">
            PhishingScanner
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden sm:flex items-center gap-1 flex-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 text-[13px] rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? 'text-white font-medium'
                    : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Right */}
        <div className="ml-auto flex items-center gap-2">
          <UserProfile />
          <button
            className="sm:hidden text-zinc-500 hover:text-white transition-colors p-1.5 rounded-md"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menú"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <div className={`sm:hidden overflow-hidden transition-all duration-200 ${
        mobileMenuOpen ? 'max-h-56 border-t border-zinc-800/60' : 'max-h-0'
      }`}>
        <nav className="flex flex-col px-4 py-2 gap-0.5 bg-[#080808]">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2.5 text-sm rounded-md transition-colors ${
                  isActive ? 'text-white font-medium' : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
