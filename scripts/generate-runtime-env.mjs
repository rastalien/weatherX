import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const envFilePath = path.join(projectRoot, '.env');
const outputFilePath = path.join(projectRoot, 'js', 'runtime-env.js');

function parseEnvFile(content) {
  const entries = {};

  content.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmedLine.indexOf('=');
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    let value = trimmedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      entries[key] = value;
    }
  });

  return entries;
}

async function readEnvFile() {
  try {
    return await readFile(envFilePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

async function main() {
  const rawEnv = await readEnvFile();
  const parsedEnv = parseEnvFile(rawEnv);
  const output = [
    '// Auto-generated file. Do not edit manually.',
    `export const RUNTIME_ENV = ${JSON.stringify(parsedEnv, null, 2)};`,
    ''
  ].join('\n');

  await writeFile(outputFilePath, output, 'utf8');
  console.log(`Generated ${path.relative(projectRoot, outputFilePath)} with ${Object.keys(parsedEnv).length} entr${Object.keys(parsedEnv).length === 1 ? 'y' : 'ies'}.`);
}

main().catch((error) => {
  console.error('Failed to generate runtime env file.');
  console.error(error);
  process.exitCode = 1;
});
