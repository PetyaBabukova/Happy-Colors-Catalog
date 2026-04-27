import path from 'path';

import {
  ALLOWED_IMAGE_UPLOAD_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_IMAGE_UPLOAD_SIZE_BYTES,
  MAX_VIDEO_UPLOAD_SIZE_BYTES,
} from '@/config/productLimits';

const IMAGE_SIGNATURE_CHECKS = {
  'image/jpeg': (buffer) =>
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff,
  'image/png': (buffer) =>
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a,
  'image/webp': (buffer) =>
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP',
};

const EXTENSIONS_BY_MIME_TYPE = {
  'image/jpeg': new Set(['.jpg', '.jpeg']),
  'image/png': new Set(['.png']),
  'image/webp': new Set(['.webp']),
  'video/mp4': new Set(['.mp4']),
};

const ALLOWED_MP4_BRANDS = new Set([
  'isom',
  'iso2',
  'iso3',
  'iso4',
  'iso5',
  'iso6',
  'mp41',
  'mp42',
  'avc1',
  'dash',
  'M4V ',
  'M4A ',
  'M4P ',
  'MSNV',
]);

function isAllowedMp4Brand(brand) {
  return brand.startsWith('mp4') || brand.startsWith('iso') || ALLOWED_MP4_BRANDS.has(brand);
}

function isValidMp4Buffer(buffer) {
  if (buffer.length < 16) {
    return false;
  }

  const boxSize = buffer.readUInt32BE(0);
  const boxType = buffer.toString('ascii', 4, 8);

  if (boxType !== 'ftyp') {
    return false;
  }

  const safeBoxSize = boxSize >= 16 ? Math.min(boxSize, buffer.length) : Math.min(32, buffer.length);
  const majorBrand = buffer.toString('ascii', 8, 12);

  if (isAllowedMp4Brand(majorBrand)) {
    return true;
  }

  for (let offset = 16; offset + 4 <= safeBoxSize; offset += 4) {
    const compatibleBrand = buffer.toString('ascii', offset, offset + 4);

    if (isAllowedMp4Brand(compatibleBrand)) {
      return true;
    }
  }

  return false;
}

function detectActualImageMimeType(buffer) {
  for (const [mimeType, matcher] of Object.entries(IMAGE_SIGNATURE_CHECKS)) {
    if (matcher(buffer)) {
      return mimeType;
    }
  }

  return '';
}

function getNormalizedExtension(filename) {
  return path.extname(filename || '').toLowerCase();
}

export function validateImageUploadFile(file, buffer) {
  if (!file || typeof file === 'string') {
    return { ok: false, status: 400, message: 'Не е получен файл за качване.' };
  }

  if (!ALLOWED_IMAGE_UPLOAD_MIME_TYPES.includes(file.type)) {
    return {
      ok: false,
      status: 400,
      message: 'Позволени са само JPG, PNG и WEBP изображения.',
    };
  }

  if (
    file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES ||
    buffer.length > MAX_IMAGE_UPLOAD_SIZE_BYTES
  ) {
    return {
      ok: false,
      status: 400,
      message: 'Изображението е твърде голямо. Максимален размер: 5 MB.',
    };
  }

  const actualMimeType = detectActualImageMimeType(buffer);

  if (!actualMimeType) {
    return {
      ok: false,
      status: 400,
      message: 'Файлът не изглежда като валидно изображение.',
    };
  }

  if (actualMimeType !== file.type) {
    return {
      ok: false,
      status: 400,
      message: 'Декларираният тип на файла не съвпада със съдържанието му.',
    };
  }

  const extension = getNormalizedExtension(file.name);
  const allowedExtensions = EXTENSIONS_BY_MIME_TYPE[actualMimeType];

  if (extension && !allowedExtensions?.has(extension)) {
    return {
      ok: false,
      status: 400,
      message: 'Разширението на файла не съответства на съдържанието му.',
    };
  }

  return { ok: true, mimeType: actualMimeType };
}

export function validateVideoUploadFile(file, buffer) {
  if (!file || typeof file === 'string') {
    return { ok: false, status: 400, message: 'Не е получен файл за качване.' };
  }

  if (!ALLOWED_VIDEO_MIME_TYPES.includes(file.type)) {
    return {
      ok: false,
      status: 400,
      message: 'Поддържа се само MP4 видео формат.',
    };
  }

  if (
    file.size > MAX_VIDEO_UPLOAD_SIZE_BYTES ||
    buffer.length > MAX_VIDEO_UPLOAD_SIZE_BYTES
  ) {
    return {
      ok: false,
      status: 400,
      message: 'Видеото е твърде голямо. Максимален размер: 25 MB.',
    };
  }

  if (!isValidMp4Buffer(buffer)) {
    return {
      ok: false,
      status: 400,
      message: 'Файлът не изглежда като валидно MP4 видео.',
    };
  }

  const extension = getNormalizedExtension(file.name);
  const allowedExtensions = EXTENSIONS_BY_MIME_TYPE[file.type];

  if (extension && !allowedExtensions?.has(extension)) {
    return {
      ok: false,
      status: 400,
      message: 'Разширението на видео файла не съответства на съдържанието му.',
    };
  }

  return { ok: true, mimeType: file.type };
}
