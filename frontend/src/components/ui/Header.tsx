"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserProfile } from '@/components/auth/UserProfile';
import { Menu, X } from 'lucide-react';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu when pathname changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { name: 'Inicio', href: '/' },
    { name: 'Análisis en Bloque', href: '/bulk' },
    { name: 'Clasificación', href: '/leaderboard' },
    { name: 'Estadísticas', href: '/dashboard' },
  ];

  return (
    <header className="border-b border-[#333] bg-black/80 backdrop-blur-md sticky top-0 z-50 print:hidden">
      <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
        
        <Link href="/" className="text-sm font-medium tracking-wide text-white" translate="no">
          PhishingScanner
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden sm:flex items-center gap-6 ml-8">
          {navLinks.map((link) => (
            <Link 
              key={link.href} 
              href={link.href} 
              className={`text-xs transition-colors whitespace-nowrap ${pathname === link.href ? 'text-indigo-400' : 'text-zinc-400 hover:text-white'}`}
            >
              {link.name}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <UserProfile />
          
          {/* Mobile Menu Button */}
          <button 
            className="sm:hidden text-zinc-400 hover:text-white transition-colors p-1"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div 
        className={`sm:hidden bg-zinc-950 border-zinc-900 overflow-hidden transition-all duration-300 ease-in-out ${
          mobileMenuOpen ? 'max-h-64 opacity-100 border-b py-4' : 'max-h-0 opacity-0 border-b-0 py-0'
        }`}
      >
        <nav className="flex flex-col gap-4 px-4">
          {navLinks.map((link) => (
            <Link 
              key={link.href} 
              href={link.href} 
              className={`text-sm transition-colors ${pathname === link.href ? 'text-indigo-400 font-medium' : 'text-zinc-400 hover:text-white'}`}
            >
              {link.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
