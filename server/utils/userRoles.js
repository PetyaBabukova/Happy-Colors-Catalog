export const USER_ROLES = Object.freeze({
  FULL_ADMIN: 'full_admin',
  ARTIST: 'artist',
  CUSTOMER: 'customer',
});

export const USER_ROLE_VALUES = Object.freeze(Object.values(USER_ROLES));

export const ARTIST_STATUSES = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
});

export const ARTIST_STATUS_VALUES = Object.freeze(Object.values(ARTIST_STATUSES));

export function normalizeRole(role) {
  return USER_ROLE_VALUES.includes(role) ? role : USER_ROLES.CUSTOMER;
}

export function normalizeArtistStatus(role, artistStatus) {
  if (normalizeRole(role) !== USER_ROLES.ARTIST) {
    return null;
  }

  return ARTIST_STATUS_VALUES.includes(artistStatus)
    ? artistStatus
    : ARTIST_STATUSES.PENDING;
}

export function serializeUser(user) {
  if (!user) {
    return null;
  }

  const role = normalizeRole(user.role);

  return {
    _id: String(user._id),
    username: user.username,
    email: user.email,
    role,
    artistStatus: normalizeArtistStatus(role, user.artistStatus),
  };
}

export function isFullAdmin(user) {
  return normalizeRole(user?.role) === USER_ROLES.FULL_ADMIN;
}

export function isActiveArtist(user) {
  return (
    normalizeRole(user?.role) === USER_ROLES.ARTIST &&
    normalizeArtistStatus(USER_ROLES.ARTIST, user?.artistStatus) === ARTIST_STATUSES.ACTIVE
  );
}

export function canArtistManageProducts(user) {
  return (
    normalizeRole(user?.role) === USER_ROLES.ARTIST &&
    normalizeArtistStatus(USER_ROLES.ARTIST, user?.artistStatus) !== ARTIST_STATUSES.SUSPENDED
  );
}
