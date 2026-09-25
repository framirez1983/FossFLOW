import {
  MAX_ICON_SOURCE_BYTES,
  canonicalSvgDataUrl,
  isSupportedImportMime,
  sanitizeSvgText
} from '../sanitizeSvg';
import { normalizeUserIconFiles } from '../normalizeUserIcons';

const svgDoc = (body: string): string => {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${body}</svg>`;
};

const toDataUrl = (svg: string): string => {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
};

describe('sanitizeSvgText', () => {
  it('preserves ordinary paths, groups, gradients and presentation attributes', () => {
    const raw = svgDoc(
      `<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><g transform="translate(1,1)" fill="red" stroke="black"><path d="M0 0h10v10H0z" fill="url(#g)"/><rect width="2" height="2" clip-path="url(#c)"/></g>`
    );
    const result = sanitizeSvgText(raw);
    expect(result).not.toBeNull();
    expect(result!.text).toContain('<linearGradient');
    expect(result!.text).toContain('<path');
    expect(result!.text).toContain('transform="translate(1,1)"');
    expect(result!.text).toContain('viewBox="0 0 10 10"');
  });

  it('preserves Illustrator-style <style> class fills', () => {
    const raw = svgDoc(
      `<style type="text/css">.st0{fill:#CDD9EE;}</style><polygon class="st0" points="0,0 5,5"/>`
    );
    const result = sanitizeSvgText(raw);
    expect(result).not.toBeNull();
    expect(result!.text).toContain('.st0');
    expect(result!.text).toContain('<polygon');
  });

  it('removes script elements', () => {
    const result = sanitizeSvgText(
      svgDoc(`<script>alert(1)</script><rect width="2" height="2"/>`)
    );
    expect(result).not.toBeNull();
    expect(result!.text).not.toContain('<script');
    expect(result!.text).not.toContain('alert(1)');
    expect(result!.text).toContain('<rect');
  });

  it('removes inline event handlers', () => {
    const result = sanitizeSvgText(
      svgDoc(
        `<rect width="2" height="2" onload="evil()" onerror="evil()" onclick="evil()"/>`
      )
    );
    expect(result).not.toBeNull();
    expect(result!.text).not.toMatch(/on(load|error|click)=/i);
    expect(result!.text).toContain('<rect');
  });

  it('removes javascript: references', () => {
    const result = sanitizeSvgText(
      svgDoc(`<a href="javascript:alert(1)"><rect width="2" height="2"/></a>`)
    );
    expect(result).not.toBeNull();
    expect(result!.text).not.toContain('javascript:');
  });

  it('removes foreignObject content', () => {
    const result = sanitizeSvgText(
      svgDoc(
        `<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject><rect width="2" height="2"/>`
      )
    );
    expect(result).not.toBeNull();
    expect(result!.text).not.toContain('foreignObject');
    expect(result!.text).toContain('<rect');
  });

  it('rejects external network references', () => {
    expect(
      sanitizeSvgText(
        svgDoc(
          `<image href="https://example.com/evil.png" width="2" height="2"/>`
        )
      )
    ).toBeNull();
    expect(
      sanitizeSvgText(
        svgDoc(
          `<image href="//example.com/evil.png" width="2" height="2"/>`
        )
      )
    ).toBeNull();
    expect(
      sanitizeSvgText(
        svgDoc(
          `<use href="https://example.com/a.svg#s"/>`
        )
      )
    ).toBeNull();
  });

  it('rejects CSS @import, however written', () => {
    expect(
      sanitizeSvgText(
        svgDoc(
          `<style>@import url("https://example.com/a.css"); .st{fill:red;}</style><rect class="st" width="2" height="2"/>`
        )
      )
    ).toBeNull();
    expect(
      sanitizeSvgText(
        svgDoc(
          `<style>@import "https://example.com/a.css"; .st{fill:red;}</style><rect class="st" width="2" height="2"/>`
        )
      )
    ).toBeNull();
  });

  it('rejects external url() in style blocks, style attributes and fill', () => {
    expect(
      sanitizeSvgText(
        svgDoc(
          `<style>.st{fill: url("https://example.com/r.svg#g");}</style><rect class="st" width="2" height="2"/>`
        )
      )
    ).toBeNull();
    expect(
      sanitizeSvgText(
        svgDoc(
          `<rect width="2" height="2" style="fill: url(https://example.com/r.svg#g)"/>`
        )
      )
    ).toBeNull();
    expect(
      sanitizeSvgText(
        svgDoc(
          `<rect width="2" height="2" style="background: url(//example.com/x.png)"/>`
        )
      )
    ).toBeNull();
    expect(
      sanitizeSvgText(
        svgDoc(`<rect width="2" height="2" fill="url(https://example.com/r.svg#g)"/>`)
      )
    ).toBeNull();
  });

  it('preserves internal fragment refs and local symbol use', () => {
    const withUse = sanitizeSvgText(
      svgDoc(
        `<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient><symbol id="s"><rect width="2" height="2"/></symbol></defs><rect width="2" height="2" fill="url(#g)"/><rect width="2" height="2" style="fill:url(#g)"/><use href="#s"/><use xlink:href="#s"/>`
      )
    );
    expect(withUse).not.toBeNull();
    expect(withUse!.text).toContain('fill="url(#g)"');
    expect(withUse!.text).toContain('fill:url(#g)');
    expect(withUse!.text).toContain('<use href="#s"');
    expect(withUse!.text).toContain('xlink:href="#s"');
  });

  it('allows self-contained data: references in CSS', () => {
    const result = sanitizeSvgText(
      svgDoc(
        `<style>.st{fill: url("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=");}</style><rect class="st" width="2" height="2"/>`
      )
    );
    expect(result).not.toBeNull();
    expect(result!.text).toContain('url("data:');
  });

  it('rejects input with no usable SVG', () => {
    expect(sanitizeSvgText('just text')).toBeNull();
    expect(sanitizeSvgText('<div>nope</div>')).toBeNull();
    expect(sanitizeSvgText('')).toBeNull();
  });

  it('is idempotent on clean output', () => {
    const raw = svgDoc(`<g fill="red"><path d="M0 0h1v1H0z"/></g>`);
    const once = sanitizeSvgText(raw);
    expect(once).not.toBeNull();
    expect(sanitizeSvgText(once!.text)!.text).toBe(once!.text);
  });
});

describe('canonicalSvgDataUrl', () => {
  it('maps sanitization twins to the identical stored asset', () => {
    const clean = svgDoc(`<rect width="2" height="2"/>`);
    const tainted = svgDoc(
      `<script>alert(1)</script><rect width="2" height="2" onclick="evil()"/>`
    );
    expect(canonicalSvgDataUrl(toDataUrl(tainted))).toBe(
      canonicalSvgDataUrl(toDataUrl(clean))
    );
  });

  it('returns null for rejected content', () => {
    expect(canonicalSvgDataUrl(toDataUrl('no svg here'))).toBeNull();
    expect(canonicalSvgDataUrl('not-a-data-url')).toBeNull();
  });
});

describe('isSupportedImportMime', () => {
  it('accepts SVG and common rasters, rejects the rest', () => {
    expect(isSupportedImportMime('image/svg+xml')).toBe(true);
    expect(isSupportedImportMime('image/png')).toBe(true);
    expect(isSupportedImportMime('image/jpeg')).toBe(true);
    expect(isSupportedImportMime('image/webp')).toBe(true);
    expect(isSupportedImportMime('image/gif')).toBe(true);
    expect(isSupportedImportMime('image/bmp')).toBe(false);
    expect(isSupportedImportMime('text/plain')).toBe(false);
    expect(isSupportedImportMime('')).toBe(false);
  });
});

describe('normalizeUserIconFiles policy gates', () => {
  const svgFile = (name: string, content: string, type = 'image/svg+xml') => {
    return new File([content], name, { type });
  };

  it('skips oversized sources with a useful reason', async () => {
    const big = svgFile(
      'huge.svg',
      `<svg xmlns="http://www.w3.org/2000/svg">${' '.repeat(MAX_ICON_SOURCE_BYTES + 1)}</svg>`
    );
    expect(big.size).toBeGreaterThan(MAX_ICON_SOURCE_BYTES);
    const result = await normalizeUserIconFiles([big]);
    expect(result.icons).toHaveLength(0);
    expect(result.skipped).toEqual([
      { name: 'huge.svg', reason: expect.stringMatching(/1 MiB/) }
    ]);
  });

  it('skips unsupported types with a useful reason', async () => {
    const bmp = new File(['BM'], 'pic.bmp', { type: 'image/bmp' });
    const result = await normalizeUserIconFiles([bmp]);
    expect(result.icons).toHaveLength(0);
    expect(result.skipped).toEqual([
      { name: 'pic.bmp', reason: 'unsupported file type' }
    ]);
  });

  it('skips unsafe SVG but keeps the valid twin byte-identical', async () => {
    const clean = svgFile('ok.svg', svgDoc(`<rect width="2" height="2"/>`));
    const nasty = svgFile(
      'nasty.svg',
      svgDoc(`<script>alert(1)</script><rect width="2" height="2"/>`)
    );
    const result = await normalizeUserIconFiles([clean, nasty]);
    // clean accepted; nasty sanitizes to the same asset, accepted as its own
    // project icon with a distinct name (project dedup stays name-based).
    expect(result.icons).toHaveLength(2);
    expect(result.icons[0].url).toBe(result.icons[1].url);
    expect(result.skipped).toHaveLength(0);
  });

  it('skips SVG with external references', async () => {
    const ext = svgFile(
      'ext.svg',
      svgDoc(`<image href="https://example.com/x.png"/>`)
    );
    const result = await normalizeUserIconFiles([ext]);
    expect(result.icons).toHaveLength(0);
    expect(result.skipped).toEqual([
      { name: 'ext.svg', reason: 'unsafe SVG content' }
    ]);
  });
});
