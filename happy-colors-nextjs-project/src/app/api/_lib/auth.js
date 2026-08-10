import {
  AUTH_COOKIE_NAME,
} from '../../../../../shared/authConstants.js';
import {
  canArtistManageProducts,
  isFullAdmin,
  serializeUser,
} from '../../../../../shared/authRoles.js';
import {
  getRequiredJwtSecret,
  verifyHs256JwtPayload,
} from '../../../../../shared/authJwtCore.js';
import { ensureServerEnvLoaded } from './env';
import { connectToMongo } from './mongo';

function getJwtSecret() {
  return getRequiredJwtSecret({
    getEnvValue: (name) => process.env[name],
    prepareEnv: ensureServerEnvLoaded,
  });
}

async function loadUserFromDb(userId) {
  const mongoose = await connectToMongo();

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  return mongoose.connection.db.collection('users').findOne({
    _id: new mongoose.Types.ObjectId(userId),
  });
}

export async function requireApiAuth(request) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const verification = verifyHs256JwtPayload({ token, getJwtSecret });

  if (!verification.ok) {
    return verification;
  }

  try {
    const user = await loadUserFromDb(verification.payload?._id);

    if (!user) {
      return { ok: false, status: 401, message: 'Invalid authentication token.' };
    }

    return { ok: true, user: serializeUser(user) };
  } catch {
    return { ok: false, status: 401, message: 'Invalid authentication token.' };
  }
}

export function requireApiFullAdmin(authResult) {
  if (!authResult?.ok) {
    return authResult;
  }

  if (!isFullAdmin(authResult.user)) {
    return { ok: false, status: 403, message: 'Forbidden.' };
  }

  return authResult;
}

export function requireApiActiveArtistOrFullAdmin(authResult) {
  if (!authResult?.ok) {
    return authResult;
  }

  if (isFullAdmin(authResult.user) || canArtistManageProducts(authResult.user)) {
    return authResult;
  }

  return { ok: false, status: 403, message: 'Forbidden.' };
}
