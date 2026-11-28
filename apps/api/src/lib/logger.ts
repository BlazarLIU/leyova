import { createRequire } from 'node:module'
import { pino, type TransportSingleOptions } from 'pino'

const require = createRequire(import.meta.url)

/**
 * 仅在非生产环境且已安装 pino-pretty（devDependency）时启用美化日志传输，
 * 避免生产镜像（pnpm --prod）启动时因找不到 pino-pretty 崩溃。
 */
export function getPrettyTransport(options: Record<string, unknown> = { colorize: true }): TransportSingleOptions | undefined {
  if (process.env.NODE_ENV === 'production') return undefined
  try {
    require.resolve('pino-pretty')
    return { target: 'pino-pretty', options }
  } catch {
    return undefined
  }
}

// Reuse the same log level as the Fastify app
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: getPrettyTransport(),
  redact: ['req.headers.authorization', 'req.body.password'],
})