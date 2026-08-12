import {
  CARTOON_ORDER_PHOTO_READ_PURPOSE,
  CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
  CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
  createCartoonOrderUploadTokenTools,
} from '../../../../../shared/cartoonOrderUploadTokenCore.js';
import { ensureServerEnvLoaded } from './env';

export {
  CARTOON_ORDER_PHOTO_READ_PURPOSE,
  CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
  CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
};

function getTokenSecret() {
  ensureServerEnvLoaded();
  const secret = process.env.CARTOON_ORDER_UPLOAD_TOKEN_SECRET || process.env.JWT_SECRET;

  if (!secret || String(secret).trim() === '') {
    throw new Error('CARTOON_ORDER_UPLOAD_TOKEN_SECRET or JWT_SECRET is not configured.');
  }

  return secret;
}

const tokenTools = createCartoonOrderUploadTokenTools({ getTokenSecret });

export const createUploadSessionToken = tokenTools.createUploadSessionToken;
export const createUploadConfirmationToken = tokenTools.createUploadConfirmationToken;
export const verifyCartoonOrderUploadToken = tokenTools.verifyCartoonOrderUploadToken;
