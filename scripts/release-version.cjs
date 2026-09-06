const { execFileSync } = require('node:child_process');
const { appendFileSync } = require('node:fs');

function parse(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) || version.trim() !== version) {
    throw new Error(`Invalid stable version: ${version}`);
  }
  const parts = version.split('.').map(Number);
  if (!parts.every(Number.isSafeInteger)) throw new Error('Version exceeds safe integer range');
  return parts;
}

function compare(a, b) {
  const x = parse(a);
  const y = parse(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

function nextVersion(current, bump = 'next', requested = '') {
  let [major, minor, patch] = parse(current);
  if (!requested) {
    switch (bump) {
      case 'next':
        if (patch >= 99) {
          patch = 0;
          if (minor >= 99) { major++; minor = 0; } else { minor++; }
        } else {
          patch++;
        }
        break;
      case 'patch': patch++; break;
      case 'minor': minor++; patch = 0; break;
      case 'major': major++; minor = 0; patch = 0; break;
      default: throw new Error(`Unknown bump: ${bump}`);
    }
    requested = `${major}.${minor}.${patch}`;
  }
  if (compare(requested, current) <= 0) {
    throw new Error(`Release version must be greater than ${current}`);
  }
  return requested;
}

if (require.main === module) {
  const tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const versions = [require('../package.json').version];
  for (const tag of tags) {
    try { parse(tag.slice(1)); versions.push(tag.slice(1)); } catch { /* Ignore non-stable tags. */ }
  }
  versions.sort(compare);
  const version = nextVersion(versions.at(-1), process.env.BUMP || 'next', process.env.REQUESTED_VERSION || '');
  if (tags.includes(`v${version}`)) throw new Error(`Tag already exists: v${version}`);
  console.log(version);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\ntag=v${version}\n`);
  }
}

module.exports = { nextVersion };
