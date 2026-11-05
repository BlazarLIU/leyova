import type { FastifyReply } from 'fastify'

export function sendOk<T>(reply: FastifyReply, data: T, message = 'success') {
  return reply.send({ success: true, message, data })
}

export function sendError(reply: FastifyReply, statusCode: number, message: string, error?: string) {
  return reply.code(statusCode).send({ success: false, message, error })
}
