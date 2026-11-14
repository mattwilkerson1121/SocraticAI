import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentService, fileBodyToBuffer } from './document.service';

const state = vi.hoisted(() => ({
  fileType: 'txt',
  payload: new Uint8Array(),
}));

function queryBuilder(singleResult: { data: unknown; error: unknown }) {
  const builder: {
    select: () => typeof builder;
    eq: () => typeof builder;
    update: () => typeof builder;
    single: () => Promise<{ data: unknown; error: unknown }>;
    then: Promise<{ data: null; error: null }>['then'];
  } = {
    select: () => builder,
    eq: () => builder,
    update: () => builder,
    single: async () => singleResult,
    then: (resolve, reject) => Promise.resolve({ data: null, error: null }).then(resolve, reject),
  };
  return builder;
}

vi.mock('../config/supabase', () => ({
  supabaseAdmin: {
    from: () =>
      queryBuilder({
        data: {
          id: 'doc-1',
          user_id: 'user-1',
          project_id: 'proj-1',
          filename: 'notes.txt',
          file_path: 'user-1/proj-1/notes.txt',
          file_type: state.fileType,
          size: state.payload.byteLength,
          mime_type: 'text/plain',
          uploaded_at: '2026-09-23T00:00:00.000Z',
          updated_at: '2026-09-23T00:00:00.000Z',
        },
        error: null,
      }),
    storage: {
      from: () => ({
        download: async () => ({
          data: new Blob([state.payload]),
          error: null,
        }),
      }),
    },
  },
}));

describe('fileBodyToBuffer', () => {
  it('keeps the original bytes of a Blob, which is what Storage download() returns', async () => {
    const original = 'Tariffs raise the price of imported steel.';
    const buffer = await fileBodyToBuffer(new Blob([original]));
    expect(buffer.toString('utf-8')).toBe(original);
    expect(new Blob([original]).toString()).toBe('[object Blob]');
  });

  it('accepts Buffer, ArrayBuffer, and typed-array inputs', async () => {
    const original = Buffer.from('already a buffer');
    expect(await fileBodyToBuffer(original)).toBe(original);

    const bytes = new Uint8Array([9, 8, 7, 6]);
    expect((await fileBodyToBuffer(bytes.buffer)).equals(Buffer.from(bytes))).toBe(true);
    expect((await fileBodyToBuffer(bytes)).equals(Buffer.from(bytes))).toBe(true);
  });
});

describe('DocumentService.parseDocument', () => {
  beforeEach(() => {
    state.fileType = 'txt';
    state.payload = new Uint8Array();
  });

  it('reads text out of a downloaded Blob instead of the string "[object Blob]"', async () => {
    const original = 'The argument assumes demand never changes.';
    state.fileType = 'txt';
    state.payload = new Uint8Array(Buffer.from(original));

    const content = await new DocumentService().parseDocument('doc-1', 'user-1');

    expect(content).toBe(original);
    expect(content).not.toContain('[object Blob]');
  });

  it('parses JSON downloaded as a Blob', async () => {
    state.fileType = 'json';
    state.payload = new Uint8Array(Buffer.from('{"claim":"exports always fall"}'));

    const content = await new DocumentService().parseDocument('doc-1', 'user-1');

    expect(content).toContain('"claim": "exports always fall"');
    expect(content).not.toContain('[object Blob]');
  });
});
