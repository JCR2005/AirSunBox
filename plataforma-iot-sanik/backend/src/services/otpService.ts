import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import crypto from 'node:crypto'
import * as usersRepo from '../repositories/users.js'
import { createMailer } from '../lib/mailer.js'
import type { Mailer } from '../lib/mailer.js'

const OTP_EXPIRY_MINUTES = 10
const OTP_LENGTH = 6
const MAX_FAILED_ATTEMPTS = 3
const LOCKOUT_MINUTES = 15

let _mailer: Mailer | null = null
const mailer = (app: FastifyInstance): Mailer => {
  if (!_mailer) _mailer = createMailer(app.log)
  return _mailer
}

export function generateOtp(): string {
  return crypto.randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH).toString()
}

export function generateBackupCodes(): string[] {
  const codes: string[] = []
  for (let i = 0; i < 8; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase()
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`)
  }
  return codes
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map(c => bcrypt.hash(c, 10)))
}

export async function createOtp(app: FastifyInstance, userId: string, code: string): Promise<void> {
  const hash = await bcrypt.hash(code, 10)
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
  await usersRepo.setOtp(app.db, userId, hash, expiresAt)
}

export async function sendOtp(app: FastifyInstance, email: string, code: string): Promise<void> {
  const { createMailer } = await import('../lib/mailer.js')
  const mailer = createMailer(app.log)
  await mailer.sendOtp(email, code)
}

export async function verifyOtp(app: FastifyInstance, userId: string, inputCode: string): Promise<{ valid: boolean; usedBackup: boolean }> {
  const userRows = await usersRepo.findById(app.db, userId)
  const user = userRows[0]
  
  // Check if locked
  if (user?.otp_locked_until && new Date() < user.otp_locked_until) {
    return { valid: false, usedBackup: false }
  }
  
  // First try OTP code
  if (user?.otp_code_hash && user?.otp_expires_at && new Date() <= user.otp_expires_at) {
    const valid = await bcrypt.compare(inputCode, user.otp_code_hash)
    if (valid) {
      await usersRepo.clearOtp(app.db, userId)
      await usersRepo.resetOtpFailedAttempts(app.db, userId)
      return { valid: true, usedBackup: false }
    }
  }
  
  // Try backup code
  if (user?.backup_codes && user.backup_codes.length > 0) {
    for (let i = 0; i < user.backup_codes.length; i++) {
      const valid = await bcrypt.compare(inputCode.toUpperCase(), user.backup_codes[i])
      if (valid) {
        // Consume this backup code
        const remaining = user.backup_codes.filter((_, idx) => idx !== i)
        await usersRepo.consumeBackupCode(app.db, user.id, remaining)
        await usersRepo.resetOtpFailedAttempts(app.db, userId)
        return { valid: true, usedBackup: true }
      }
    }
  }
  
  // Invalid code - increment failed attempts
  const attempts = await usersRepo.incrementOtpFailedAttempts(app.db, userId)
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
    await usersRepo.lockOtpUntil(app.db, userId, lockedUntil)
  }
  
  return { valid: false, usedBackup: false }
}