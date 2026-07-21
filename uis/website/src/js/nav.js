"use strict";

/**
 * nav.js
 * Controla el menú desplegable ("burger") del header en pantallas móviles.
 * Se usa en index.html y application.html. 100% Vanilla JS, sin dependencias.
 *
 * Accesibilidad:
 * - Sincroniza aria-expanded y aria-label del botón con el estado del menú.
 * - Cierra con la tecla Escape y devuelve el foco al botón (navegación por teclado).
 * - Cierra automáticamente al seleccionar un enlace o al pasar a viewport de escritorio,
 *   evitando que el panel quede abierto y desincronizado del layout.
 */

document.addEventListener("DOMContentLoaded", () => {
  const toggleButton = document.getElementById("menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");
  const iconOpen = document.getElementById("icon-menu-open");
  const iconClose = document.getElementById("icon-menu-close");

  if (!toggleButton || !mobileMenu) return;

  const desktopBreakpoint = window.matchMedia("(min-width: 768px)");

  function isMenuOpen() {
    return toggleButton.getAttribute("aria-expanded") === "true";
  }

  function openMenu() {
    mobileMenu.classList.remove("hidden");
    toggleButton.setAttribute("aria-expanded", "true");
    toggleButton.setAttribute("aria-label", "Cerrar menú de navegación");
    if (iconOpen) iconOpen.classList.add("hidden");
    if (iconClose) iconClose.classList.remove("hidden");
  }

  function closeMenu() {
    mobileMenu.classList.add("hidden");
    toggleButton.setAttribute("aria-expanded", "false");
    toggleButton.setAttribute("aria-label", "Abrir menú de navegación");
    if (iconOpen) iconOpen.classList.remove("hidden");
    if (iconClose) iconClose.classList.add("hidden");
  }

  toggleButton.addEventListener("click", () => {
    if (isMenuOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Cierra el menú al activar cualquier enlace de navegación.
  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  // Escape cierra el menú y devuelve el foco al botón que lo abrió.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isMenuOpen()) {
      closeMenu();
      toggleButton.focus();
    }
  });

  // Si la ventana pasa al breakpoint de escritorio, el menú móvil se cierra
  // para evitar un estado inconsistente al redimensionar o rotar pantalla.
  desktopBreakpoint.addEventListener("change", (event) => {
    if (event.matches && isMenuOpen()) {
      closeMenu();
    }
  });
});
