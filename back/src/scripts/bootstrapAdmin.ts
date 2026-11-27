import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { User } from '../models';

const config = z.object({ ADMIN_EMAIL: z.string().email(), ADMIN_PASSWORD: z.string().min(16).max(128) }).safeParse(process.env);
if (!config.success) throw new Error('Set ADMIN_EMAIL and a unique ADMIN_PASSWORD (at least 16 characters) before bootstrapping an admin.');
const adminConfig = config.data;

async function run(): Promise<void> {
  await connectDatabase();
  const email = adminConfig.ADMIN_EMAIL.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing && existing.role !== 'admin') throw new Error('Refusing to promote an existing non-admin account.');
  if (existing) throw new Error('An admin with this email already exists.');
  await User.create({ email, passwordHash: await bcrypt.hash(adminConfig.ADMIN_PASSWORD, 12), role: 'admin' });
}
run().then(() => disconnectDatabase()).catch(async (err: unknown) => { console.error(err); await disconnectDatabase(); process.exitCode = 1; });
