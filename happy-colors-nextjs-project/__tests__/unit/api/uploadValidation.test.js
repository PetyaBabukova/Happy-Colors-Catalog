import { describe, expect, it } from 'vitest';
import {
  validateImageUploadFile,
  validateVideoUploadFile,
} from '../../../src/app/api/_lib/uploadValidation.js';

function pngBuffer() {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
}

function jpegBuffer() {
  return Buffer.from([0xff, 0xd8, 0xff, 0x00]);
}

function mp4Buffer({ majorBrand = 'isom', compatibleBrand = 'mp42' } = {}) {
  const buffer = Buffer.alloc(24);
  buffer.writeUInt32BE(24, 0);
  buffer.write('ftyp', 4, 4, 'ascii');
  buffer.write(majorBrand, 8, 4, 'ascii');
  buffer.write(compatibleBrand, 16, 4, 'ascii');
  return buffer;
}

describe('uploadValidation', () => {
  it('accepts valid image uploads by declared type, signature, and extension', () => {
    expect(validateImageUploadFile({ type: 'image/png', size: 9, name: 'paint.png' }, pngBuffer())).toEqual({
      ok: true,
      mimeType: 'image/png',
    });
  });

  it('rejects image MIME, signature, and extension mismatches', () => {
    expect(validateImageUploadFile({ type: 'image/gif', size: 9, name: 'paint.gif' }, pngBuffer())).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(validateImageUploadFile({ type: 'image/png', size: 4, name: 'paint.png' }, jpegBuffer())).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(validateImageUploadFile({ type: 'image/png', size: 9, name: 'paint.jpg' }, pngBuffer())).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it('accepts valid MP4 uploads and rejects invalid video content', () => {
    expect(validateVideoUploadFile({ type: 'video/mp4', size: 24, name: 'clip.mp4' }, mp4Buffer())).toEqual({
      ok: true,
      mimeType: 'video/mp4',
    });
    expect(
      validateVideoUploadFile({ type: 'video/mp4', size: 12, name: 'clip.mp4' }, Buffer.from('not an mp4'))
    ).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it('rejects unsupported video types and extension mismatches', () => {
    expect(validateVideoUploadFile({ type: 'video/webm', size: 24, name: 'clip.webm' }, mp4Buffer())).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(validateVideoUploadFile({ type: 'video/mp4', size: 24, name: 'clip.mov' }, mp4Buffer())).toMatchObject({
      ok: false,
      status: 400,
    });
  });
});
