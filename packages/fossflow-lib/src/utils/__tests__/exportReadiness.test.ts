import { ensureExportSnapshotReady } from '../exportOptions';

describe('ensureExportSnapshotReady', () => {
  afterEach(() => {
    delete (document as unknown as Record<string, unknown>).fonts;
  });

  it('resolves once fonts are ready and the container is laid out', async () => {
    (document as unknown as Record<string, unknown>).fonts = {
      ready: Promise.resolve()
    };
    const el = {
      getBoundingClientRect: () => {
        return { width: 800, height: 600 };
      }
    } as unknown as HTMLDivElement;

    await expect(
      ensureExportSnapshotReady(el, 500)
    ).resolves.toBeUndefined();
  });

  it('never hangs: gives up after the cap when layout never arrives', async () => {
    const el = {
      getBoundingClientRect: () => {
        return { width: 0, height: 0 };
      }
    } as unknown as HTMLDivElement;

    const start = Date.now();
    await expect(
      ensureExportSnapshotReady(el, 120)
    ).resolves.toBeUndefined();
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('works without the FontFaceSet API (older engines, tests)', async () => {
    const el = {
      getBoundingClientRect: () => {
        return { width: 10, height: 10 };
      }
    } as unknown as HTMLDivElement;

    await expect(
      ensureExportSnapshotReady(el, 500)
    ).resolves.toBeUndefined();
  });
});
