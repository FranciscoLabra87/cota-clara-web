/// <reference types="@cloudflare/vitest-plugin/types" />

// El esquema se importa como texto para armar la base de cada prueba.
declare module '*.sql?raw' {
  const contenido: string;
  export default contenido;
}
