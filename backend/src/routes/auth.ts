import { Router, type Request } from 'express'
import * as auth from '../auth/service.js'
import { asyncHandler, ok } from '../http.js'
import { authLimiter, sendOtpLimiter } from '../middleware/rateLimit.js'
import { refreshBody, sendOtpBody, verifyOtpBody } from '../validators.js'

const ctx = (req: Request) => ({ ip: req.ip ?? '', device: (req.get('user-agent') ?? '').slice(0, 200) })

export const authRouter = Router()

authRouter.post('/send-otp', sendOtpLimiter, asyncHandler(async (req, res) => {
  const { phone } = sendOtpBody.parse(req.body)
  ok(res, await auth.sendOtp(phone))
}))

authRouter.post('/verify-otp', authLimiter, asyncHandler(async (req, res) => {
  const { phone, code, language, theme } = verifyOtpBody.parse(req.body)
  ok(res, await auth.verifyOtp(phone, code, ctx(req), { language, theme }))
}))

authRouter.post('/refresh', authLimiter, asyncHandler(async (req, res) => {
  const { refreshToken } = refreshBody.parse(req.body)
  ok(res, auth.refresh(refreshToken, ctx(req)))
}))

authRouter.post('/logout', asyncHandler(async (req, res) => {
  const { refreshToken } = refreshBody.parse(req.body)
  auth.logout(refreshToken)
  ok(res, { loggedOut: true })
}))
