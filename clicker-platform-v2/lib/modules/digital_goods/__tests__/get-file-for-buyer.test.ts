import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chain for adminDb: collection(path).where().where().limit().get()  AND  doc(path).get()
const libGetMock = vi.fn();
const docGetMock = vi.fn();
const fileExistsMock = vi.fn();
const fileDownloadMock = vi.fn();
const bucketFileMock = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      where: () => ({
        where: () => ({
          limit: () => ({ get: libGetMock }),
        }),
      }),
    }),
    doc: () => ({ get: docGetMock }),
  },
  adminStorage: {
    bucket: () => ({
      file: (path: string) => {
        bucketFileMock(path);
        return { exists: fileExistsMock, download: fileDownloadMock };
      },
    }),
  },
}));

import { getFileForBuyer } from '../server-api';

const SITE = 's1';
const UID = 'u1';
const PRODUCT = 'p1';
const PATH = 'sites/s1/modules/digital_goods/products/files/abc.pdf';

const productWithFile = {
  exists: true,
  data: () => ({
    files: [{ kind: 'pdf', storagePath: PATH, name: 'abc.pdf', mimeType: 'application/pdf', sizeBytes: 1234 }],
  }),
};

beforeEach(() => {
  libGetMock.mockReset(); docGetMock.mockReset();
  fileExistsMock.mockReset(); fileDownloadMock.mockReset(); bucketFileMock.mockReset();
});

describe('getFileForBuyer — entitlement', () => {
  it('forbids when the buyer has no library entry for the product', async () => {
    libGetMock.mockResolvedValue({ empty: true });
    await expect(getFileForBuyer(SITE, UID, PRODUCT, PATH)).rejects.toThrow('forbidden');
  });

  it('forbids a storagePath outside this site\'s product files (path traversal / IDOR)', async () => {
    libGetMock.mockResolvedValue({ empty: false });
    const evil = 'sites/other/modules/digital_goods/products/files/secret.pdf';
    await expect(getFileForBuyer(SITE, UID, PRODUCT, evil)).rejects.toThrow('forbidden');
  });

  it('forbids a path not listed on the product (IDOR within same site)', async () => {
    libGetMock.mockResolvedValue({ empty: false });
    docGetMock.mockResolvedValue(productWithFile);
    const notOnProduct = 'sites/s1/modules/digital_goods/products/files/someone-else.pdf';
    await expect(getFileForBuyer(SITE, UID, PRODUCT, notOnProduct)).rejects.toThrow('forbidden');
  });

  it('not_found when the storage object is missing', async () => {
    libGetMock.mockResolvedValue({ empty: false });
    docGetMock.mockResolvedValue(productWithFile);
    fileExistsMock.mockResolvedValue([false]);
    await expect(getFileForBuyer(SITE, UID, PRODUCT, PATH)).rejects.toThrow('not_found');
  });

  it('returns bytes + metadata when entitled', async () => {
    libGetMock.mockResolvedValue({ empty: false });
    docGetMock.mockResolvedValue(productWithFile);
    fileExistsMock.mockResolvedValue([true]);
    fileDownloadMock.mockResolvedValue([Buffer.from('PDFDATA')]);

    const out = await getFileForBuyer(SITE, UID, PRODUCT, PATH);
    expect(out.bytes.toString()).toBe('PDFDATA');
    expect(out.contentType).toBe('application/pdf');
    expect(out.filename).toBe('abc.pdf');
    expect(out.sizeBytes).toBe(1234);
    expect(bucketFileMock).toHaveBeenCalledWith(PATH);
  });
});
