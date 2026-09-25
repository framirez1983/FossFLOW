/**
 * Tests for the server-persisted Icon Library store.
 *
 * Run: npm test  (node --test iconLibrary.test.js)
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createIconLibraryStore,
  parseLibraryAsset,
  sha256Hex,
  libraryEntryIdForHash,
  normalizeLibraryName,
  isValidLibraryId,
  LIBRARY_MAX_ASSET_BYTES
} from './iconLibrary.js';
import { canonicalSvgDataUrlFromText } from './sanitizeSvg.js';

const SVG_A = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>`;
const SVG_B = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><circle r="5"/></svg>`;
const toDataUrl = (svg) =>
  `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;

let tmpRoot;
let store;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'icon-lib-test-'));
  store = createIconLibraryStore({ storagePath: tmpRoot });
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('parseLibraryAsset', () => {
  it('accepts SVG data URLs and reports mime', () => {
    const parsed = parseLibraryAsset(toDataUrl(SVG_A));
    assert.equal(parsed.ok, true);
    assert.equal(parsed.mime, 'svg+xml');
    assert.ok(parsed.bytes.length > 0);
  });

  it('rejects non-data URLs, wrong mime and bad base64', () => {
    assert.equal(parseLibraryAsset('https://example.com/a.svg').ok, false);
    assert.equal(parseLibraryAsset('data:text/plain;base64,aaaa').ok, false);
    assert.equal(parseLibraryAsset('data:image/png;base64,!!!').ok, false);
    assert.equal(parseLibraryAsset(null).ok, false);
  });

  it('rejects oversized assets', () => {
    const big = Buffer.alloc(LIBRARY_MAX_ASSET_BYTES + 1, 7);
    const url = `data:image/png;base64,${big.toString('base64')}`;
    const parsed = parseLibraryAsset(url);
    assert.equal(parsed.ok, false);
    assert.match(parsed.error, /exceeds/);
  });
});

describe('create/list', () => {
  it('creates an entry with stable hash-based id', async () => {
    const res = await store.create({ name: 'PBX', url: toDataUrl(SVG_A) });
    assert.equal(res.ok, true);
    assert.equal(res.status, 201);
    // The id covers the CANONICAL sanitized bytes, not the raw upload.
    const canonical = canonicalSvgDataUrlFromText(SVG_A);
    assert.ok(canonical);
    const expectedHash = sha256Hex(
      Buffer.from(canonical.split(',')[1], 'base64')
    );
    assert.equal(res.entry.id, libraryEntryIdForHash(expectedHash));
    assert.equal(res.entry.url, canonical);
    assert.equal(res.entry.sha256, expectedHash);
    assert.equal(res.entry.name, 'PBX');
    assert.equal(res.entry.mime, 'svg+xml');
    assert.ok(res.entry.sha256);
    assert.ok(res.entry.createdAt);
    assert.equal(res.duplicate, false);

    const listed = await store.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, res.entry.id);
  });

  it('same bytes under a different filename deduplicate to the same entry', async () => {
    const first = await store.create({ name: 'pbx.svg', url: toDataUrl(SVG_A) });
    const second = await store.create({
      name: 'my-final-pbx.svg',
      url: toDataUrl(SVG_A)
    });
    assert.equal(second.ok, true);
    assert.equal(second.duplicate, true);
    assert.equal(second.entry.id, first.entry.id);
    // Original display name is preserved, not overwritten.
    assert.equal(second.entry.name, 'pbx.svg');
    assert.equal((await store.list()).length, 1);
  });

  it('same name with different bytes creates a separate entry', async () => {
    const first = await store.create({ name: 'box', url: toDataUrl(SVG_A) });
    const second = await store.create({ name: 'box', url: toDataUrl(SVG_B) });
    assert.equal(second.ok, true);
    assert.equal(second.duplicate, false);
    assert.notEqual(second.entry.id, first.entry.id);
    assert.equal((await store.list()).length, 2);
  });

  it('render metadata does not affect duplicate equivalence', async () => {
    const first = await store.create({
      name: 'a',
      url: toDataUrl(SVG_A),
      isIsometric: true
    });
    const second = await store.create({
      name: 'b',
      url: toDataUrl(SVG_A),
      isIsometric: false,
      scale: 2
    });
    assert.equal(second.duplicate, true);
    assert.equal(second.entry.id, first.entry.id);
  });

  it('rejects missing names and invalid assets', async () => {
    const noName = await store.create({ name: '  ', url: toDataUrl(SVG_A) });
    assert.equal(noName.ok, false);
    assert.equal(noName.status, 400);
    const badAsset = await store.create({ name: 'x', url: 'nope' });
    assert.equal(badAsset.ok, false);
    assert.equal(badAsset.status, 400);
  });
});

describe('rename', () => {
  it('renames metadata only and keeps the same id', async () => {
    const created = await store.create({ name: 'old', url: toDataUrl(SVG_A) });
    const renamed = await store.rename(created.entry.id, { name: 'new' });
    assert.equal(renamed.ok, true);
    assert.equal(renamed.entry.id, created.entry.id);
    assert.equal(renamed.entry.name, 'new');
    assert.equal(renamed.entry.sha256, created.entry.sha256);
    assert.equal(renamed.entry.url, created.entry.url);
  });

  it('rejects asset mutation, bad ids and missing entries', async () => {
    const created = await store.create({ name: 'x', url: toDataUrl(SVG_A) });
    const frozen = await store.rename(created.entry.id, {
      url: toDataUrl(SVG_B)
    });
    assert.equal(frozen.ok, false);
    assert.equal(frozen.status, 400);
    assert.equal((await store.rename('bogus', { name: 'y' })).status, 400);
    assert.equal(
      (await store.rename('lib_ffffffffffffffff', { name: 'y' })).status,
      404
    );
    assert.equal((await store.rename(created.entry.id, { name: '' })).status, 400);
  });
});

describe('delete', () => {
  it('removes the entry and list reflects it', async () => {
    const created = await store.create({ name: 'gone', url: toDataUrl(SVG_A) });
    const removed = await store.remove(created.entry.id);
    assert.equal(removed.ok, true);
    assert.equal((await store.list()).length, 0);
    assert.equal((await store.remove(created.entry.id)).status, 404);
  });
});

describe('persistence', () => {
  it('survives service re-instantiation against the same storage path', async () => {
    const created = await store.create({ name: 'kept', url: toDataUrl(SVG_A) });
    const reopened = createIconLibraryStore({ storagePath: tmpRoot });
    const listed = await reopened.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, created.entry.id);
    assert.equal(listed[0].url, created.entry.url);
  });
});

describe('helpers', () => {  it('normalizeLibraryName trims, caps length and rejects blanks', () => {
    assert.equal(normalizeLibraryName('  PBX  '), 'PBX');
    assert.equal(normalizeLibraryName('   '), null);
    assert.equal(normalizeLibraryName(null), null);
    assert.equal(normalizeLibraryName('x'.repeat(500)).length, 100);
  });

  it('isValidLibraryId accepts only server-shaped ids', () => {
    assert.equal(isValidLibraryId('lib_0123456789abcdef'), true);
    assert.equal(isValidLibraryId('../x'), false);
    assert.equal(isValidLibraryId('diagram_1'), false);
  });
});

const svgDoc = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${body}</svg>`;
const svgUrl = (svg) =>
  `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
const storedText = (entry) =>
  Buffer.from(entry.url.split(',')[1], 'base64').toString('utf-8');

describe('ingestion policy', () => {
  it('stores sanitized SVG without script/event/javascript constructs', async () => {
    const res = await store.create({
      name: 'nasty',
      url: svgUrl(
        svgDoc(
          `<script>alert(1)</script><rect width="2" height="2" onclick="evil()"/><a href="javascript:alert(1)"><circle r="1"/></a>`
        )
      )
    });
    assert.equal(res.ok, true);
    const text = storedText(res.entry);
    assert.ok(!/<script/i.test(text));
    assert.ok(!/on(click|load|error)=/i.test(text));
    assert.ok(!/javascript:/i.test(text));
    assert.ok(text.includes('<rect'));
    assert.ok(text.includes('<circle'));
  });

  it('sanitization twins deduplicate on canonical bytes', async () => {
    const clean = await store.create({
      name: 'clean',
      url: svgUrl(svgDoc(`<rect width="2" height="2"/>`))
    });
    const tainted = await store.create({
      name: 'tainted',
      url: svgUrl(
        svgDoc(
          `<script>alert(1)</script><rect width="2" height="2" onclick="x()"/>`
        )
      )
    });
    assert.equal(tainted.ok, true);
    assert.equal(tainted.duplicate, true);
    assert.equal(tainted.entry.id, clean.entry.id);
    assert.equal(tainted.entry.url, clean.entry.url);
  });

  it('preserves gradients, masks and style blocks', async () => {
    const res = await store.create({
      name: 'fancy',
      url: svgUrl(
        svgDoc(
          `<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient><mask id="m"><rect width="2" height="2"/></mask></defs><style type="text/css">.st0{fill:#CDD9EE;}</style><polygon class="st0" points="0,0 5,5" fill="url(#g)"/>`
        )
      )
    });
    assert.equal(res.ok, true);
    const text = storedText(res.entry);
    assert.ok(text.includes('<linearGradient'));
    assert.ok(text.includes('<mask'));
    assert.ok(text.includes('.st0'));
  });

  it('rejects external references and oversized assets', async () => {
    const external = await store.create({
      name: 'ext',
      url: svgUrl(
        svgDoc(`<image href="https://example.com/x.png" width="2" height="2"/>`)
      )
    });
    assert.equal(external.ok, false);
    assert.equal(external.status, 400);

    const big = Buffer.alloc(1024 * 1024 + 1, 7);
    const oversized = await store.create({
      name: 'big',
      url: `data:image/png;base64,${big.toString('base64')}`
    });
    assert.equal(oversized.ok, false);
    assert.equal(oversized.status, 400);
  });

  it('direct API-style submission cannot bypass policy', async () => {
    // Raw unsanitized bytes straight to the store, as a hostile client would.
    const res = await store.create({
      name: 'bypass',
      url: svgUrl(svgDoc(`<rect width="2" height="2"/><script>steal()</script>`))
    });
    assert.equal(res.ok, true);
    const text = storedText(res.entry);
    assert.ok(!text.includes('steal()'));
    // The hash covers stored bytes: re-adding the cleaned form dedupes.
    const again = await store.create({
      name: 'bypass2',
      url: res.entry.url
    });
    assert.equal(again.duplicate, true);
    assert.equal(again.entry.id, res.entry.id);
  });
});

describe('external-resource audit', () => {
  it('rejects CSS @import in any form', async () => {
    for (const css of [
      `@import url("https://example.com/a.css"); .st{fill:red;}`,
      `@import "https://example.com/a.css"; .st{fill:red;}`
    ]) {
      const res = await store.create({
        name: 'imp',
        url: svgUrl(
          svgDoc(`<style>${css}</style><rect class="st" width="2" height="2"/>`)
        )
      });
      assert.equal(res.ok, false);
      assert.equal(res.status, 400);
    }
  });

  it('rejects external url() in styles and fill attributes', async () => {
    const vectors = [
      `<style>.st{fill: url("https://example.com/r.svg#g");}</style>`,
      `<rect width="2" height="2" style="fill: url(https://example.com/r.svg#g)"/>`,
      `<rect width="2" height="2" style="background: url(//example.com/x.png)"/>`,
      `<rect width="2" height="2" fill="url(https://example.com/r.svg#g)"/>`,
      `<use href="https://example.com/a.svg#s"/>`
    ];
    for (const body of vectors) {
      const res = await store.create({
        name: 'ext',
        url: svgUrl(svgDoc(body))
      });
      assert.equal(res.ok, false, body.slice(0, 60));
      assert.equal(res.status, 400);
    }
  });

  it('preserves local fragments, symbol use and the Illustrator pattern', async () => {
    const res = await store.create({
      name: 'local',
      url: svgUrl(
        svgDoc(
          `<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient><symbol id="s"><rect width="2" height="2"/></symbol></defs><style type="text/css">.st0{fill:#CDD9EE;}</style><rect width="2" height="2" fill="url(#g)"/><polygon class="st0" points="0,0 5,5"/><use href="#s"/>`
        )
      )
    });
    assert.equal(res.ok, true);
    const text = storedText(res.entry);
    assert.ok(text.includes('fill="url(#g)"'));
    assert.ok(text.includes('.st0'));
    assert.ok(text.includes('<use href="#s"'));
  });
});
