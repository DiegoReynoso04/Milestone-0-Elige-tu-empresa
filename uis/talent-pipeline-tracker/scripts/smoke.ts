// Script TEMPORAL de validación manual de lib/api-client.ts, services/ y
// normalizers.ts contra la API real. Se borra al terminar la Capa 1
// (Método del Pintor, §2.1 de SPECS.md).
//
// Uso: npx tsx scripts/smoke.ts
//
// Crea un registro desechable (mismo enfoque que las verificaciones V-1..V-5
// de la §0), ejercita las 8 funciones de services/ sobre él y va imprimiendo
// cada resultado. No implementa deleteRecord (fuera de alcance, REQ-4): el
// registro de prueba queda en la API pública al terminar.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Next.js carga .env.local automáticamente; un script suelto no. Se replica
// aquí a mano para no añadir dotenv como dependencia nueva del proyecto.
function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local');
  const content = readFileSync(envPath, 'utf-8');

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvLocal();

  // Import dinámico: debe ocurrir DESPUÉS de cargar .env.local, porque
  // lib/api-client.ts valida la variable de entorno al importarse.
  const { getRecords, getRecordById, createRecord, updateRecord, patchRecord } = await import(
    '../services/records.service'
  );
  const { getNotes, addNote, deleteNote } = await import('../services/notes.service');

  console.log('--- getRecords({ limit: 3 }) ---');
  const page = await getRecords({ limit: 3 });
  console.log(JSON.stringify(page, null, 2));

  console.log('\n--- createRecord (registro desechable) ---');
  const draft = {
    full_name: 'Smoke Test — Capa 1',
    email: 'smoke.test.capa1@example.com',
    phone: '+34000000000',
    position: 'Smoke Test',
    experience_years: 0,
  };
  const created = await createRecord(draft);
  console.log(JSON.stringify(created, null, 2));

  console.log('\n--- getRecordById ---');
  const fetched = await getRecordById(created.id);
  console.log(JSON.stringify(fetched, null, 2));

  console.log('\n--- patchRecord (status/stage) ---');
  const patched = await patchRecord(created.id, { status: 'in_progress', stage: 'review' });
  console.log(JSON.stringify(patched, null, 2));

  console.log('\n--- updateRecord (PUT, conserva status/stage — V-3) ---');
  const updated = await updateRecord(created.id, { ...draft, phone: '+34111111111' });
  console.log(JSON.stringify(updated, null, 2));

  console.log('\n--- addNote ---');
  const note = await addNote(created.id, { content: 'Nota de prueba (smoke test Capa 1)' });
  console.log(JSON.stringify(note, null, 2));

  console.log('\n--- getNotes ---');
  const notes = await getNotes(created.id);
  console.log(JSON.stringify(notes, null, 2));

  console.log('\n--- deleteNote ---');
  await deleteNote(created.id, note.id);
  console.log('nota eliminada (204, sin cuerpo)');

  console.log('\n--- getNotes (tras borrar) ---');
  const notesAfter = await getNotes(created.id);
  console.log(JSON.stringify(notesAfter, null, 2));

  console.log('\nOK — las 8 funciones de services/ funcionan contra la API real.');
  console.log(
    `Nota: el registro ${created.id} queda en la API pública (deleteRecord fuera de alcance, REQ-4).`
  );
}

main().catch((error) => {
  console.error('\nFALLÓ el smoke test:', error);
  process.exitCode = 1;
});
