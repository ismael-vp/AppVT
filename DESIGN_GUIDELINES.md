# Directrices de Diseño (Design Guidelines) para PhishingScanner

Este documento establece las reglas visuales y de experiencia de usuario (UX/UI) que el agente de IA debe seguir estrictamente al realizar modificaciones en la interfaz de PhishingScanner. 

El incumplimiento de estas directrices resultará en un diseño que no encaje con la identidad del producto.

## 1. Filosofía General
- **Minimalismo y Simplicidad:** La web debe mantenerse lo más limpia y directa posible. Menos es más. 
- **Aspecto Oscuro (Dark Mode Native):** El diseño se basa en tonos muy oscuros (`bg-black`, `bg-zinc-950`, `bg-[#050505]`) con contrastes calculados para los textos (`zinc-500`, `zinc-400`, `zinc-300`).
- **Aspecto Profesional y Técnico:** PhishingScanner es una herramienta de ciberseguridad avanzada. Su interfaz debe evocar precisión, como si fuera una terminal moderna o una herramienta de análisis profesional, no un producto infantil o sobrecargado.

## 2. Reglas Estrictas sobre Iconografía
- **MÍNIMA CANTIDAD DE ICONOS:** Solo se deben usar iconos cuando sean **estrictamente necesarios** para comprender una acción (ej. un botón de descarga o un menú hamburguesa).
- **No añadir iconos decorativos:** Nunca añadas iconos al lado de títulos, etiquetas, o textos si el texto por sí solo es claro. Por ejemplo, no pongas un icono de "archivo" junto al título "Introduce las URLs" ni un icono de "usuarios" en "Reputación Comunitaria".
- Los iconos, cuando existan, deben ser pequeños (generalmente `size={14}` o `size={16}` como máximo) y tener un color tenue (ej. `text-zinc-500`) a menos que requieran la atención inmediata del usuario.

## 3. Efectos Visuales y Colores
- **Sin Glassmorphism:** Evita abusar de fondos translúcidos con mucho blur o efectos "cristal". El estilo se basa en bordes finos (`border-zinc-800`), sombras muy sutiles, y colores sólidos o con poca opacidad técnica (`bg-zinc-900/50`).
- **Color de Acento:** El color principal es un índigo/violeta sutil. Se utiliza **solamente** en las acciones principales (como el botón "Iniciar análisis") o cuando un elemento está seleccionado/activo. No uses el color de acento para adornos innecesarios (ej. no pongas líneas brillantes o bordes fluorescentes a menos que se indique explícitamente).
- **Contraste de Texto:** Asegúrate de que el texto secundario sea legible. Nunca uses tonos por debajo de `zinc-500` para texto que contenga información útil. (Usa `text-zinc-400` o `text-zinc-500` en lugar de `text-zinc-700`).

## 4. Estructura y Navegación
- Mantén la escalabilidad móvil en mente. Cualquier componente nuevo debe adaptarse de manera nativa sin desbordar (usa `flex-wrap`, menús hamburguesa, u oculta elementos en `sm:hidden` cuando sea apropiado).

> **IMPORTANTE PARA LA IA:** Antes de proponer o aplicar cambios estéticos a un componente, lee y valida tu propuesta contra este archivo `DESIGN_GUIDELINES.md`. Si vas a añadir un icono, pregúntate: "¿Es verdaderamente indispensable?". Si la respuesta es no, **no lo añadas**.
