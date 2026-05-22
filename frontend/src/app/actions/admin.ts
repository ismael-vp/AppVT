"use server";

export async function verifyAdminAccess(email: string | undefined | null): Promise<boolean> {
  if (!email) return false;
  
  // Leemos la variable de entorno protegida en el servidor
  // Esta variable NO empieza por NEXT_PUBLIC_, por lo que nunca se enviará al navegador
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@phishingscanner.com';
  
  return email === adminEmail;
}
