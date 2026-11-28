import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  // Zod validation errors (zod v4 uses .issues)
  if (error instanceof ZodError) {
    const issues = (error as any).issues ?? []
    return reply.code(400).send({
      success: false,
      message: '请求参数校验失败',
      errors: issues.map((e: any) => ({
        path: e.path?.join('.') ?? '',
        message: e.message,
      })),
    })
  }

  // Fastify built-in validation errors
  if ('validation' in error && error.validation) {
    return reply.code(400).send({
      success: false,
      message: '请求参数校验失败',
      errors: error.validation,
    })
  }

  // Rate limit errors
  if ('statusCode' in error && error.statusCode === 429) {
    return reply.code(429).send({
      success: false,
      message: '请求过于频繁，请稍后再试',
    })
  }

  // Log internal errors
  request.log.error({ err: error }, 'Unhandled error')

  // Generic server error (don't leak details in production)
  const statusCode = 'statusCode' in error ? (error as FastifyError).statusCode ?? 500 : 500
  const message = statusCode === 500 && process.env.NODE_ENV === 'production'
    ? '服务器内部错误'
    : error.message

  return reply.code(statusCode).send({
    success: false,
    message,
  })
}