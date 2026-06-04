import User from '../models/User.js';
import bcrypt from 'bcrypt';
import validator from 'validator';
import { signAuthToken } from '../middlewares/auth.js';
import { serializeUser } from '../utils/userRoles.js';

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export async function loginUser(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const safePassword = String(password ?? '');

  if (!normalizedEmail || !safePassword) {
    throw new Error('Invalid credentials');
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isValid = await bcrypt.compare(safePassword, user.password);

  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  const token = signAuthToken(
    {
      _id: String(user._id),
      username: user.username,
      email: user.email,
    },
    { expiresIn: '1d' }
  );

  return {
    token,
    user: serializeUser(user),
  };
}

export async function registerUser({ username, email, password }) {
  const safeUsername = String(username ?? '').trim();
  const normalizedEmail = normalizeEmail(email);
  const safePassword = String(password ?? '');

  if (!safeUsername || !normalizedEmail || !safePassword) {
    throw new Error('Липсват задължителни полета.');
  }

  if (!validator.isEmail(normalizedEmail)) {
    throw new Error('Невалиден email формат.');
  }

  const existing = await User.findOne({ email: normalizedEmail });

  if (existing) {
    throw new Error('Този потребител вече съществува!');
  }

  const isStrong = validator.isStrongPassword(safePassword, {
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  });

  if (!isStrong) {
    throw new Error(
      'Паролата трябва да е поне 8 символа, да съдържа малки и главни латински букви, поне 1 цифра и поне един символ!'
    );
  }

  const user = new User({
    username: safeUsername,
    email: normalizedEmail,
    password: safePassword,
  });

  await user.save();

  return serializeUser(user);
}
