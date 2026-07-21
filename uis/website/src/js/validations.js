"use strict";

/**
 * validations.js
 * Validación 100% frontend (Vanilla JS) del formulario de registro de talento
 * de Nexova (uis/website/application.html). Sin dependencias, sin backend.
 *
 * Estrategia de accesibilidad:
 * - Cada campo tiene un <p role="alert"> asociado vía aria-describedby que
 *   recibe el mensaje de error, permitiendo que lectores de pantalla lo
 *   anuncien automáticamente.
 * - aria-invalid se sincroniza con el estado de validez de cada campo.
 * - El envío exitoso o el resumen de errores se anuncia vía la región
 *   #form-status (role="status", aria-live="polite").
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("talent-form");
  if (!form) return;

  const formStatus = document.getElementById("form-status");
  const clearButton = document.getElementById("clear-form");

  const fields = {
    fullName: document.getElementById("fullName"),
    email: document.getElementById("email"),
    phone: document.getElementById("phone"),
    country: document.getElementById("country"),
    experience: document.getElementById("experience"),
    sector: document.getElementById("sector"),
    english: document.getElementById("english"),
    linkedin: document.getElementById("linkedin"),
    comments: document.getElementById("comments"),
    dataPolicy: document.getElementById("dataPolicy"),
  };

  const availabilityRadios = Array.from(
    document.querySelectorAll('input[name="availability"]')
  );

  const COMMENTS_MAX_LENGTH = 500;

  // ---------------------------------------------------------------------
  // Helpers de UI: mostrar / limpiar errores manteniendo estado ARIA
  // ---------------------------------------------------------------------

  function getErrorElement(fieldId) {
    return document.getElementById(`${fieldId}-error`);
  }

  function setInvalid(inputEl, fieldId, message) {
    const errorEl = getErrorElement(fieldId);
    if (errorEl) errorEl.textContent = message;
    if (inputEl) {
      inputEl.setAttribute("aria-invalid", "true");
      inputEl.classList.add("border-red-700");
      inputEl.classList.remove("border-slate-400");
    }
  }

  function setValid(inputEl, fieldId) {
    const errorEl = getErrorElement(fieldId);
    if (errorEl) errorEl.textContent = "";
    if (inputEl) {
      inputEl.setAttribute("aria-invalid", "false");
      inputEl.classList.remove("border-red-700");
      inputEl.classList.add("border-slate-400");
    }
  }

  // For a radio group / fieldset without a single input element to style.
  function setGroupInvalid(fieldId, message) {
    const errorEl = getErrorElement(fieldId);
    if (errorEl) errorEl.textContent = message;
  }

  function setGroupValid(fieldId) {
    const errorEl = getErrorElement(fieldId);
    if (errorEl) errorEl.textContent = "";
  }

  // ---------------------------------------------------------------------
  // Validadores individuales — devuelven true/false y gestionan su propio
  // mensaje de error, tal como se especifica en CONTEXT-WEB-NEXOVA.md
  // ---------------------------------------------------------------------

  function validateFullName() {
    const value = fields.fullName.value.trim();
    const words = value.split(/\s+/).filter(Boolean);
    if (words.length < 2) {
      setInvalid(fields.fullName, "fullName", "El nombre debe contener al menos nombre y apellido");
      return false;
    }
    setValid(fields.fullName, "fullName");
    return true;
  }

  function validateEmail() {
    const value = fields.email.value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailPattern.test(value)) {
      setInvalid(fields.email, "email", "Ingresa un email válido (ejemplo: nombre@empresa.com)");
      return false;
    }
    setValid(fields.email, "email");
    return true;
  }

  function validatePhone() {
    const value = fields.phone.value.trim();
    // Debe comenzar con "+" seguido del código de país y al menos 6 dígitos más.
    const phonePattern = /^\+\d{1,3}[\d\s]{6,}$/;
    if (!phonePattern.test(value)) {
      setInvalid(fields.phone, "phone", "El teléfono debe incluir código de país (ejemplo: +34 612 345 678)");
      return false;
    }
    setValid(fields.phone, "phone");
    return true;
  }

  function validateCountry() {
    const value = fields.country.value;
    if (!value) {
      setInvalid(fields.country, "country", "Selecciona tu país de residencia");
      return false;
    }
    setValid(fields.country, "country");
    return true;
  }

  function validateExperience() {
    const raw = fields.experience.value.trim();
    const value = Number(raw);
    if (raw === "" || Number.isNaN(value) || value < 0 || value > 50) {
      setInvalid(fields.experience, "experience", "Los años de experiencia deben estar entre 0 y 50");
      return false;
    }
    setValid(fields.experience, "experience");
    return true;
  }

  function validateSector() {
    const value = fields.sector.value;
    if (!value) {
      setInvalid(fields.sector, "sector", "Selecciona el sector de tu interés");
      return false;
    }
    setValid(fields.sector, "sector");
    return true;
  }

  function validateEnglish() {
    const value = fields.english.value;
    if (!value) {
      setInvalid(fields.english, "english", "Indica tu nivel de inglés");
      return false;
    }
    setValid(fields.english, "english");
    return true;
  }

  function validateAvailability() {
    const checked = availabilityRadios.some((radio) => radio.checked);
    if (!checked) {
      setGroupInvalid("availability", "Selecciona tu disponibilidad");
      return false;
    }
    setGroupValid("availability");
    return true;
  }

  function validateLinkedin() {
    const value = fields.linkedin.value.trim();
    // Campo opcional: solo se valida si el usuario escribió algo.
    if (value === "") {
      setValid(fields.linkedin, "linkedin");
      return true;
    }
    let isValidUrl = false;
    try {
      const url = new URL(value);
      isValidUrl = url.protocol === "http:" || url.protocol === "https:";
    } catch (error) {
      isValidUrl = false;
    }
    if (!isValidUrl) {
      setInvalid(fields.linkedin, "linkedin", "Si incluyes LinkedIn, debe ser una URL válida");
      return false;
    }
    setValid(fields.linkedin, "linkedin");
    return true;
  }

  function updateCommentsCounter() {
    const counterEl = document.getElementById("comments-counter");
    const remaining = COMMENTS_MAX_LENGTH - fields.comments.value.length;
    if (counterEl) {
      counterEl.textContent = `Quedan ${remaining} caracteres`;
    }
    return remaining;
  }

  function validateComments() {
    const remaining = updateCommentsCounter();
    if (remaining < 0) {
      setInvalid(
        fields.comments,
        "comments",
        `Los comentarios no pueden exceder 500 caracteres (quedan ${remaining})`
      );
      return false;
    }
    setValid(fields.comments, "comments");
    return true;
  }

  function validateDataPolicy() {
    if (!fields.dataPolicy.checked) {
      setInvalid(
        fields.dataPolicy,
        "dataPolicy",
        "Debes aceptar la política de tratamiento de datos para continuar"
      );
      return false;
    }
    setValid(fields.dataPolicy, "dataPolicy");
    return true;
  }

  // ---------------------------------------------------------------------
  // Limpieza del formulario: restaura la UI a su estado inicial (usada
  // tanto tras un envío exitoso como por el botón "Limpiar formulario").
  // ---------------------------------------------------------------------

  function resetFormUI() {
    Object.entries(fields).forEach(([fieldId, el]) => {
      if (!el) return;
      setValid(el, fieldId);
      el.removeAttribute("aria-invalid");
    });

    setGroupValid("availability");
    availabilityRadios.forEach((radio) => radio.removeAttribute("aria-invalid"));

    updateCommentsCounter();
    formStatus.innerHTML = "";
  }

  function formHasContent() {
    const hasFieldValue = Object.values(fields).some((el) => {
      if (!el) return false;
      if (el.type === "checkbox") return el.checked;
      return el.value.trim() !== "";
    });
    const hasAvailability = availabilityRadios.some((radio) => radio.checked);
    return hasFieldValue || hasAvailability;
  }

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      if (formHasContent()) {
        const confirmed = window.confirm(
          "¿Seguro que quieres limpiar todos los campos del formulario? Esta acción no se puede deshacer."
        );
        if (!confirmed) return;
      }

      form.reset();
      resetFormUI();
      fields.fullName.focus();
    });
  }

  // ---------------------------------------------------------------------
  // Listeners: validación en tiempo real (input/blur/change)
  // ---------------------------------------------------------------------

  fields.fullName.addEventListener("input", validateFullName);
  fields.fullName.addEventListener("blur", validateFullName);

  fields.email.addEventListener("input", validateEmail);
  fields.email.addEventListener("blur", validateEmail);

  fields.phone.addEventListener("input", validatePhone);
  fields.phone.addEventListener("blur", validatePhone);

  fields.country.addEventListener("change", validateCountry);

  fields.experience.addEventListener("input", validateExperience);
  fields.experience.addEventListener("blur", validateExperience);

  fields.sector.addEventListener("change", validateSector);

  fields.english.addEventListener("change", validateEnglish);

  availabilityRadios.forEach((radio) => {
    radio.addEventListener("change", validateAvailability);
  });

  fields.linkedin.addEventListener("input", validateLinkedin);
  fields.linkedin.addEventListener("blur", validateLinkedin);

  fields.comments.addEventListener("input", validateComments);

  fields.dataPolicy.addEventListener("change", validateDataPolicy);

  // Inicializa el contador de caracteres al cargar la página.
  updateCommentsCounter();

  // ---------------------------------------------------------------------
  // Envío del formulario (100% frontend: se simula el envío, no hay API)
  // ---------------------------------------------------------------------

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const validators = [
      validateFullName,
      validateEmail,
      validatePhone,
      validateCountry,
      validateExperience,
      validateSector,
      validateEnglish,
      validateAvailability,
      validateLinkedin,
      validateComments,
      validateDataPolicy,
    ];

    const results = validators.map((validate) => validate());
    const isFormValid = results.every(Boolean);

    if (!isFormValid) {
      formStatus.innerHTML =
        '<p class="rounded-md border border-red-700 bg-red-50 px-4 py-3 text-red-700">' +
        "Revisa los campos marcados en rojo antes de continuar." +
        "</p>";

      // Mueve el foco al primer campo inválido para navegación por teclado / lectores de pantalla.
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) {
        firstInvalid.focus();
      } else if (!validateAvailability()) {
        availabilityRadios[0].focus();
      }
      return;
    }

    formStatus.innerHTML =
      '<div class="rounded-md border border-green-700 bg-green-50 px-4 py-4 text-slate-900">' +
      '<p class="font-semibold">¡Gracias por tu interés en Nexova!</p>' +
      "<p class=\"mt-2\">Hemos recibido tu información. Nuestro equipo de selección la revisará y te " +
      "contactaremos en caso de que tu perfil encaje con alguna de nuestras oportunidades actuales o " +
      "futuras.</p>" +
      '<p class="mt-2">Mientras tanto, síguenos en LinkedIn para estar al día de nuestras vacantes y ' +
      "contenido sobre desarrollo profesional.</p>" +
      "</div>";

    form.reset();
    const successMessage = formStatus.innerHTML;
    resetFormUI();
    formStatus.innerHTML = successMessage;

    formStatus.focus();
  });
});
