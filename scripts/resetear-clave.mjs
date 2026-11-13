// Deja una clave temporal nueva en una cuenta que ya existe. Es la salida
// cuando nadie puede entrar al panel a resetearla: por ejemplo, el único
// administrador perdió su clave o quedó bloqueado.
//
//   Clave al azar:  node scripts/resetear-clave.mjs --rut 12.345.678-9 --remote
//   Clave elegida:  node scripts/resetear-clave.mjs --rut 12.345.678-9 --clave 5678 --remote
//
// En los dos casos la clave queda como temporal: al entrar, el sistema obliga
// a cambiarla por una que cumpla la política (10 caracteres, letra y número).
// Además desbloquea la cuenta y cierra todas sus sesiones abiertas.
//
// Ojo con --clave: lo que se escribe en la terminal queda en su historial. Y
// una clave corta o fácil de adivinar deja la cuenta expuesta hasta que su
// dueño entre y la cambie, así que conviene entrar apenas se resetea.

import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { formatearRut, generarClaveTemporal, hashPassword, normalizarRut, validarRut } from '../src/lib/crypto.ts';

const BASE = 'cota-clara-db';

const { values } = parseArgs({
  options: {
    rut: { type: 'string' },
    clave: { type: 'string' },
    remote: { type: 'boolean', default: false },
  },
});

function salir(mensaje) {
  console.error(`\n  ${mensaje}\n`);
  process.exit(1);
}

const rut = normalizarRut(values.rut ?? '');
if (!validarRut(rut)) salir('Falta --rut o el dígito verificador no calza.');

const elegida = values.clave !== undefined;
const clave = elegida ? values.clave.trim() : generarClaveTemporal();
// El login no acepta más de 128 caracteres; una clave más larga no serviría.
if (!clave || clave.length > 128) salir('--clave no puede quedar vacía ni pasar de 128 caracteres.');

const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
if (!existsSync(wrangler)) salir('No encuentro wrangler en node_modules. Corre npm install primero.');

const destino = values.remote ? ['--remote'] : ['--local', '--persist-to', '.wrangler/state'];

// Se llama al binario de wrangler con el mismo Node y sin shell: en Windows
// no se puede lanzar un .cmd sin shell, y pasar SQL por el shell lo rompe.
const wranglerCon = (args, opciones = {}) => execFileSync(process.execPath, [wrangler, ...args], opciones);

// Primero se confirma que la cuenta existe. Un UPDATE sobre un RUT que no
// está no falla: no cambiaría nada y el script diría que sí.
let usuario;
try {
  const salida = wranglerCon(
    ['d1', 'execute', BASE, ...destino, '--json', '--command', `SELECT id, nombre FROM usuarios WHERE rut_norm = '${rut}'`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  );
  usuario = JSON.parse(salida)[0]?.results?.[0];
} catch (e) {
  salir(`wrangler no pudo leer la base (${e.status ?? 'sin código'}).`);
}
if (!usuario) salir(`No hay ninguna cuenta con el RUT ${formatearRut(rut)}. Para crearla usa scripts/crear-admin.mjs.`);

const { hash, salt } = await hashPassword(clave);
const id = Number(usuario.id);

// El RUT ya pasó validarRut y el id viene de la base, así que ninguno trae
// comillas; el hash y el salt son hexadecimales.
const comando = [
  `UPDATE usuarios SET password_hash = '${hash}', password_salt = '${salt}', password_temporal = 1, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ${id};`,
  `DELETE FROM sesiones WHERE usuario_id = ${id};`,
  `INSERT INTO log_eventos (usuario_id, accion, detalle) VALUES (${id}, 'CLAVE_RESETEADA', '{"via":"script"}');`,
].join('\n');

// Por archivo y no por --command: el SQL de varias líneas se rompe en
// Windows. El archivo lleva el hash, no la clave, y se borra igual.
const archivo = join(tmpdir(), `cota-resetear-clave-${process.pid}.sql`);
writeFileSync(archivo, `${comando}\n`, 'utf8');

try {
  wranglerCon(['d1', 'execute', BASE, ...destino, ...(values.remote ? ['--yes'] : []), '--file', archivo], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
} catch (e) {
  rmSync(archivo, { force: true });
  salir(`wrangler no pudo escribir en la base (${e.status ?? 'sin código'}). La clave anterior sigue igual.`);
}
rmSync(archivo, { force: true });

console.log(`
  Clave reseteada en la base ${values.remote ? 'remota' : 'local'}.

    Nombre    ${usuario.nombre}
    RUT       ${formatearRut(rut)}
    Clave     ${elegida ? '(la que indicaste con --clave)' : clave}

  Es temporal: al entrar hay que cambiarla. La cuenta quedó desbloqueada y
  sin sesiones abiertas.
`);
