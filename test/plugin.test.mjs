import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const skillDir = 'plugin/skills/graphify';

test('marketplace and plugin manifests agree', () => {
  const market = json('.claude-plugin/marketplace.json');
  const plugin = json('plugin/.claude-plugin/plugin.json');
  assert.equal(market.plugins.length, 1);
  const [entry] = market.plugins;
  assert.equal(entry.source, './plugin');
  assert.equal(entry.name, plugin.name);
  assert.equal(entry.version, plugin.version);
  assert.ok(plugin.description.length > 0);
});

test('the skill has a name and description and every reference it names exists', () => {
  const skill = read(`${skillDir}/SKILL.md`);
  const front = skill.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(front, 'SKILL.md has frontmatter');
  assert.match(front[1], /^name: graphify$/m);
  assert.match(front[1], /^description: .+/m);
  const named = new Set([...skill.matchAll(/references\/([\w-]+\.md)/g)].map((m) => m[1]));
  assert.ok(named.size > 0);
  for (const f of named) assert.ok(existsSync(join(root, skillDir, 'references', f)), `references/${f} exists`);
  assert.deepEqual(readdirSync(join(root, skillDir, 'references')).sort(), [...named].sort(), 'no unused reference files');
});

test('hooks match Graphify\'s own Claude Code hooks and call the bundled guard', () => {
  const { hooks } = json('plugin/hooks/hooks.json');
  const flat = Object.entries(hooks).flatMap(([event, groups]) =>
    groups.flatMap((g) => g.hooks.map((h) => ({ event, matcher: g.matcher, command: h.command, timeout: h.timeout }))),
  );
  assert.deepEqual(
    flat.map((h) => [h.event, h.matcher, h.command.split(' ').pop()]),
    [['PreToolUse', 'Bash|Grep', 'search'], ['PreToolUse', 'Read|Glob', 'read'], ['SessionStart', 'compact', 'compact']],
  );
  for (const h of flat) {
    assert.match(h.command, /^sh "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/guard\.sh" /);
    assert.equal(h.timeout, 10);
  }
  assert.ok(existsSync(join(root, 'plugin/hooks/guard.sh')));
});

test('the guard stays silent and never blocks when Graphify is not installed', () => {
  // Hide every Python folder (where pip puts graphify) from PATH; keep the rest so sh still starts.
  const sep = process.platform === 'win32' ? ';' : ':';
  const key = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const path = process.env[key].split(sep).filter((p) => !/python|graphify/i.test(p)).join(sep);
  const r = spawnSync('sh', [join(root, 'plugin/hooks/guard.sh'), 'search'], {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Grep', tool_input: { pattern: 'x' } }),
    env: { ...process.env, [key]: path },
    encoding: 'utf8',
  });
  assert.equal(r.error, undefined);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('UPSTREAM records the copied commit and version', () => {
  const up = read('UPSTREAM');
  assert.match(up, /^commit: [0-9a-f]{40}$/m);
  assert.match(up, /^version: \d+\.\d+\.\d+/m);
  for (const f of ['LICENSE', 'LICENSE-MIT', 'NOTICE']) assert.ok(existsSync(join(root, f)), `${f} kept`);
});
