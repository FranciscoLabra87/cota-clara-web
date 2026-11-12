// Crea el primer administrador del panel. No hay otra forma de entrar la
// primera vez: el panel solo deja crear usuarios a quien ya es ADMIN.
//
//   Local:  node scripts/crear-admin.mjs --rut 12.345.678-9 --nombre "Francisco Labra"
//   Remoto: node scripts/crear-admin.mjs --rut 12.345.678-9 --nombre "Francisco Labra" --remote
//
// Imprime una contraseña temporal una sola vez. No queda en la base en claro
// ni en el repo: se guarda solo su hash, con password_temporal = 1, así que
// hay que cambiarla al entrar.
//
// Importa las funciones reales de src/lib/crypto.ts (Node 24 lee TypeScript
// directo) para que el hash sea exactamente el que valida el login.

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
    nombre: { type: 'string' },
    email: { type: 'string' },
    rol: { type: 'string', default: 'ADMIN' },
    remote: { type: 'boolean', default: false },
  },
});

function salir(mensaje) {
  console.error(`\n  ${mensaje}\n`);
  process.exit(1);
}

const rut = normalizarRut(values.rut ?? '');
const nombre = (values.nombre ?? '').trim();
const email = (values.email ?? '').trim();
const rol = values.rol ?? 'ADMIN';

if (!validarRut(rut)) salir('Falta --rut o el dígito verificador no calza.');
if (nombre.length < 2) salir('Falta --nombre.');
if (!['ADMIN', 'EDITOR'].includes(rol)) salir('--rol tiene que ser ADMIN o EDITOR.');

const clave = generarClaveTemporal();
const { hash, salt } = await hashPassword(clave);

// Los valores vienen de la línea de comandos, pero igual se escapan: una
// comilla en el nombre rompería el INSERT.
const sql = (valor) => (valor ? `'${String(valor).replace(/'/g, "''")}'` : 'NULL');

const comando = `INSERT INTO usuarios (rut_norm, nombre, email, rol, password_hash, password_salt, password_temporal) VALUES (${sql(rut)}, ${sql(nombre)}, ${sql(email)}, ${sql(rol)}, ${sql(hash)}, ${sql(salt)}, 1);`;

// Por archivo y no por --command: en Windows el SQL se rompe al pasar por el
// shell. El archivo lleva el hash, no la contraseña, y se borra igual.
const archivo = join(tmpdir(), `cota-crear-admin-${process.pid}.sql`);
writeFileSync(archivo, `${comando}\n`, 'utf8');

const args = ['d1', 'execute', BASE];
if (values.remote) args.push('--remote', '--yes');
else args.push('--local', '--persist-to', '.wrangler/state');
args.push('--file', archivo);

// Se llama al binario de wrangler con el mismo Node, en vez de npx: en Windows
// no se puede lanzar un .cmd sin shell, y meter el SQL por el shell lo rompe.
// La ruta se arma a mano porque wrangler no expone ./bin en sus "exports".
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
if (!existsSync(wrangler)) {
  rmSync(archivo, { force: true });
  salir('No encuentro wrangler en node_modules. Corre npm install primero.');
}

try {
  execFileSync(process.execPath, [wrangler, ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
} catch (e) {
  rmSync(archivo, { force: true });
  salir(`wrangler no pudo escribir en la base (${e.status ?? 'sin código'}). Si el RUT ya existe, usa el panel para resetear su contraseña.`);
}
rmSync(archivo, { force: true });

console.log(`
  Cuenta creada en la base ${values.remote ? 'remota' : 'local'}.

    Nombre    ${nombre}
    RUT       ${formatearRut(rut)}
    Rol       ${rol}
    Clave     ${clave}

  Esta clave se muestra una sola vez y hay que cambiarla al entrar.
`);
