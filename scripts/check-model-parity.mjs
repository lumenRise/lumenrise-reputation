import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiRepository = resolve(process.env.LUMENRISE_API_PATH || resolve(repository, '../lumenrise-api'));
const manifest = JSON.parse(await readFile(resolve(repository, 'model-parity.json'), 'utf8'));
const mismatches = [];

for (const relativePath of manifest.files) {
  const [local, source] = await Promise.all([
    readFile(resolve(repository, relativePath)),
    readFile(resolve(apiRepository, relativePath)),
  ]);

  if (!local.equals(source)) mismatches.push(relativePath);
}

if (mismatches.length) {
  console.error('Model files differ from lumenrise-api:\n' + mismatches.join('\n'));
  process.exitCode = 1;
} else {
  console.info(`${manifest.files.length} model and dependency files match lumenrise-api.`);
}
