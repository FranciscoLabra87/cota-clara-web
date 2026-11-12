// Funciones puras del acceso corporativo: hashing, tokens, RUT y política de
// contraseñas. No importan nada de Next ni de Cloudflare a propósito, para que
// scripts/crear-admin.mjs pueda usarlas tal cual desde Node y el hash del
// primer administrador sea exactamente el que después valida el login.

const PBKDF2_ITERACIONES = 100_000;

export async function hashPassword(password: string, saltHex?: string) {
  const salt = saltHex ? hexABytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const derivado = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERACIONES, hash: 'SHA-256' },
    material,
    256,
  );
  return { hash: bytesAHex(new Uint8Array(derivado)), salt: bytesAHex(salt) };
}

export async function verifyPassword(password: string, hashHex: string, saltHex: string) {
  const { hash } = await hashPassword(password, saltHex);
  return comparacionTiempoConstante(hash, hashHex);
}

export function bytesAHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexABytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return bytes;
}

function comparacionTiempoConstante(a: string, b: string) {
  if (a.length !== b.length) return false;
  let resultado = 0;
  for (let i = 0; i < a.length; i += 1) resultado |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return resultado === 0;
}

export function generarToken() {
  return bytesAHex(crypto.getRandomValues(new Uint8Array(32)));
}

// El token viaja en la cookie; en la base va solo su SHA-256. Tiene 256 bits
// de entropía, así que no necesita salt ni derivación lenta.
export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return bytesAHex(new Uint8Array(digest));
}

// Clave temporal legible, sin caracteres ambiguos (0/O, 1/l/I), con al menos
// una letra y un dígito para que cumpla la política por construcción.
export function generarClaveTemporal(largo = 12) {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const digitos = '23456789';
  const alfabeto = letras + digitos;
  const bytes = crypto.getRandomValues(new Uint8Array(largo));
  let clave = '';
  for (let i = 0; i < largo; i += 1) clave += alfabeto[bytes[i] % alfabeto.length];
  const extra = crypto.getRandomValues(new Uint8Array(2));
  return letras[extra[0] % letras.length] + clave.slice(1, -1) + digitos[extra[1] % digitos.length];
}

export function normalizarRut(rut: unknown) {
  if (typeof rut !== 'string') return '';
  return rut.replace(/[.\s-]/g, '').toUpperCase();
}

export function validarRut(rut: string) {
  const valor = normalizarRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(valor)) return false;
  const cuerpo = valor.slice(0, -1);
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return valor.slice(-1) === esperado;
}

export function formatearRut(rut: string) {
  const valor = normalizarRut(rut);
  if (valor.length < 2) return valor;
  const cuerpo = valor.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpo}-${valor.slice(-1)}`;
}

export function validarPassword(password: unknown): { ok: true } | { ok: false; error: string } {
  const minimo = 'La contraseña debe tener al menos 10 caracteres, una letra y un número';
  if (typeof password !== 'string') return { ok: false, error: minimo };
  if (password.length > 128) return { ok: false, error: 'La contraseña es demasiado larga' };
  if (password.length < 10 || !/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password) || !/\d/.test(password)) {
    return { ok: false, error: minimo };
  }
  return { ok: true };
}
