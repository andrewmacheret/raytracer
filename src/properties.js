// Reads a simple .properties file like app.properties into a flat map.
// "[scene]" starts a section, so "depth = 8" under it becomes "scene.depth".
// Lines starting with # are comments.
export function parseProperties(text) {
  const properties = new Map();
  let section = '';
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const header = /^\[([^=]+)\]$/.exec(line);
    if (header) {
      section = header[1] + '.';
      continue;
    }

    const equals = line.indexOf('=');
    if (equals === -1) continue;
    const key = section + line.slice(0, equals).trim();
    const value = line.slice(equals + 1).trim();
    properties.set(key, value === 'true' ? true : value === 'false' ? false : value);
  }
  return properties;
}
