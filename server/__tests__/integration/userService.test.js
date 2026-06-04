import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import User from '../../models/User.js';
import { loginUser, registerUser } from '../../services/userService.js';
import { createUser } from './factories.js';

describe('user service integration', () => {
  it('registers users with normalized email and hashed password', async () => {
    const result = await registerUser({
      username: ' Petya ',
      email: ' PETYA@EXAMPLE.COM ',
      password: 'StrongPass1!',
    });

    expect(result).toMatchObject({
      username: 'Petya',
      email: 'petya@example.com',
      role: 'customer',
      artistStatus: null,
    });
    expect(result).not.toHaveProperty('password');

    const stored = await User.findById(result._id).lean();
    expect(stored.email).toBe('petya@example.com');
    expect(stored.password).not.toBe('StrongPass1!');
  });

  it('rejects missing fields, invalid email, weak password, and duplicate email', async () => {
    await expect(registerUser({ username: '', email: 'petya@example.com', password: 'StrongPass1!' })).rejects.toThrow();
    await expect(registerUser({ username: 'Petya', email: 'not-an-email', password: 'StrongPass1!' })).rejects.toThrow();
    await expect(registerUser({ username: 'Petya', email: 'petya@example.com', password: 'weak' })).rejects.toThrow();

    await createUser({ email: 'petya@example.com' });

    await expect(
      registerUser({ username: 'Petya2', email: ' PETYA@EXAMPLE.COM ', password: 'StrongPass1!' })
    ).rejects.toThrow();
  });

  it('logs in with normalized email and returns a signed auth token', async () => {
    const user = await createUser({
      username: 'Petya',
      email: 'petya@example.com',
      password: 'StrongPass1!',
    });

    const result = await loginUser(' PETYA@EXAMPLE.COM ', 'StrongPass1!');
    const decoded = jwt.verify(result.token, process.env.JWT_SECRET);

    expect(result.user).toMatchObject({
      _id: String(user._id),
      username: 'Petya',
      email: 'petya@example.com',
      role: 'customer',
      artistStatus: null,
    });
    expect(decoded).toMatchObject({
      _id: String(user._id),
      username: 'Petya',
      email: 'petya@example.com',
    });
    expect(decoded).not.toHaveProperty('role');
    expect(decoded).not.toHaveProperty('artistStatus');
  });

  it('rejects missing credentials, unknown users, wrong passwords, and missing JWT secret', async () => {
    await expect(loginUser('', 'StrongPass1!')).rejects.toThrow('Invalid credentials');
    await expect(loginUser('missing@example.com', 'StrongPass1!')).rejects.toThrow('Invalid credentials');

    await createUser({ email: 'petya@example.com', password: 'StrongPass1!' });

    await expect(loginUser('petya@example.com', 'WrongPass1!')).rejects.toThrow('Invalid credentials');

    delete process.env.JWT_SECRET;
    await expect(loginUser('petya@example.com', 'StrongPass1!')).rejects.toThrow();
    process.env.JWT_SECRET = 'integration-jwt-secret';
  });
});
