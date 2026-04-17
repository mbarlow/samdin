// browser-sync dev server config.
// Doc root is src/; specs/, prefabs/, and media/ are mounted at their own
// URL prefixes so fetches like /specs/clinic.json resolve to ../specs/clinic.json.

const path = require('path');
const rootDir = path.resolve(__dirname, '..');

module.exports = {
  server: {
    baseDir: path.join(rootDir, 'src'),
    routes: {
      '/specs': path.join(rootDir, 'specs'),
      '/prefabs': path.join(rootDir, 'prefabs'),
      '/media': path.join(rootDir, 'media')
    }
  },
  port: Number.parseInt(process.env.PORT || '7777', 10),
  files: [
    path.join(rootDir, 'src/**/*.html'),
    path.join(rootDir, 'src/**/*.css'),
    path.join(rootDir, 'src/**/*.js'),
    path.join(rootDir, 'specs/**/*.json'),
    path.join(rootDir, 'prefabs/**/*.json')
  ],
  notify: false,
  open: false
};
