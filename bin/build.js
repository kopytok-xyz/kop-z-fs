import { log } from 'console';
import * as esbuild from 'esbuild';
import { readdirSync, rmSync } from 'fs';
import { join, relative, sep } from 'path';

// Config output
const BUILD_DIRECTORY = 'dist/assets';
const PRODUCTION = process.env.NODE_ENV === 'production';

// Config entrypoint files
const ENTRY_POINTS = ['src/index.ts'];

// Config dev serving
const LIVE_RELOAD = !PRODUCTION;
const SERVE_PORT = 3000;
const SERVE_ORIGIN = `http://localhost:${SERVE_PORT}`;

// Create context
const baseConfig = {
  entryPoints: ENTRY_POINTS,
  outdir: BUILD_DIRECTORY,
  bundle: true,
  minify: PRODUCTION,
  sourcemap: !PRODUCTION,
  target: PRODUCTION ? 'es2020' : 'esnext',
  define: {
    SERVE_ORIGIN: JSON.stringify(SERVE_ORIGIN),
  },
};

const prodConfig = {
  entryNames: '[name]-[hash]',
  chunkNames: '[name]-[hash]',
  assetNames: '[name]-[hash]',
};

rmSync(BUILD_DIRECTORY, { recursive: true, force: true });

const context = await esbuild.context({
  ...baseConfig,
  ...(PRODUCTION ? prodConfig : {}),
  metafile: true,
  inject: LIVE_RELOAD ? ['./bin/live-reload.js'] : undefined,
});

// Build files in prod
if (PRODUCTION) {
  const result = await context.rebuild();
  const mainFile = Object.keys(result.metafile.outputs).find(
    (file) => file.endsWith('.js') && !file.endsWith('.map')
  );
  log(mainFile);
  context.dispose();
}

// Watch and serve files in dev
else {
  await context.watch();
  await context
    .serve({
      servedir: process.cwd(),
      port: SERVE_PORT,
    })
    .then(logServedFiles);
}

/**
 * Logs information about the files that are being served during local development.
 */
function logServedFiles() {
  const getFiles = (dirPath) => {
    const files = readdirSync(dirPath, { withFileTypes: true }).map((dirent) => {
      const filePath = join(dirPath, dirent.name);
      return dirent.isDirectory() ? getFiles(filePath) : filePath;
    });
    return files.flat();
  };

  const files = getFiles(BUILD_DIRECTORY);

  const filesInfo = files
    .filter((file) => !file.endsWith('.map'))
    .map((file) => {
      // Получаем путь относительно папки servedir ('dist')
      const relativePath = relative('dist', file).split(sep).join('/');
      const location = `${SERVE_ORIGIN}/${relativePath}`;

      // Импорт-сниппет
      const tag = location.endsWith('.css')
        ? `<link href="${location}" rel="stylesheet" type="text/css"/>`
        : `<script defer src="${location}"></script>`;

      return {
        'File Location': location,
        'Import Suggestion': tag,
      };
    });

  console.table(filesInfo);
}
