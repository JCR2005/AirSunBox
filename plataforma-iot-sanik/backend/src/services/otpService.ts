import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import * as usersRepo from '../repositories/users.js'
import { createMailer } from '../lib/mailer.js'
import type { Mailer } from '../lib/mailer.js'

const OTP_EXPIRY_MINUTES = 10
const OTP_LENGTH = 6

let _mailer: Mailer | null = null
const mailer = (app: FastifyInstance): Mailer => {
  if (!_mailer) _mailer = createMailer(app.log)
  return _mailer
}

export function generateOtp(): string {
  return Math.floor(10 ** (OTP_LENGTH - 1) + Math.random() * 9 * 10 ** (OTP_LENGTH - 1)).toString()
}

export async function createOtp(app: FastifyInstance, userId: string, code: string): Promise<void> {
  const hash = await bcrypt.hash(code, 10)
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
  await usersRepo.setOtp(app.db, userId, hash, expiresAt)
}

export async function sendOtp(app: FastifyInstance, email: string, code: string): Promise<void> {
  await mailer(app).sendOtp(email, code)
}

export async function verifyOtp(app: FastifyInstance, userId: string, inputCode: string): Promise<boolean> {
  const userRows = await usersRepo.findById(app.db, userId)
  const user = userRows[0]
  if (!user?.otp_code_hash || !user?.otp_expires_at) return false
  if (new Date() > user.otp_expires_at) return false
  const valid = await bcrypt.compare(inputCode, user.otp_code_hash)
  if (valid) await usersRepo.clearOtp(app.db, userId)
  return valid
}