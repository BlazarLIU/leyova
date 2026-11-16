/**
 * PM2 进程配置（相对路径，可在任意部署目录使用）
 * 用法：pm2 start ecosystem.config.cjs
 */
const { join } = require('node:path')

const ROOT = __dirname
const LOG_DIR = join(ROOT, 'logs')

module.exports = {
  apps: [
    {
      name: 'leyova-api',
      cwd: join(ROOT, 'apps', 'api'),
      script: 'src/index.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx/esm',
      env: {
        NODE_ENV: 'production',
        PORT: '8788',
        HOST: '0.0.0.0',
        DISABLE_CRON: 'true',
        ...(process.env.SESSION_SECRET ? { SESSION_SECRET: process.env.SESSION_SECRET } : {}),
        ...(process.env.API_ENCRYPTION_KEY ? { API_ENCRYPTION_KEY: process.env.API_ENCRYPTION_KEY } : {}),
        ...(process.env.LEYOVA_MCP_TOKEN ? { LEYOVA_MCP_TOKEN: process.env.LEYOVA_MCP_TOKEN } : {}),
        ...(process.env.LEYOVA_MCP_SIGNING_SECRET ? { LEYOVA_MCP_SIGNING_SECRET: process.env.LEYOVA_MCP_SIGNING_SECRET } : {}),
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: join(LOG_DIR, 'api-error.log'),
      out_file: join(LOG_DIR, 'api-out.log'),
      merge_logs: true,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
    },
    {
      name: 'leyova-worker',
      cwd: join(ROOT, 'apps', 'api'),
      script: 'src/worker.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      env: {
        NODE_ENV: 'production',
        ...(process.env.SESSION_SECRET ? { SESSION_SECRET: process.env.SESSION_SECRET } : {}),
        ...(process.env.API_ENCRYPTION_KEY ? { API_ENCRYPTION_KEY: process.env.API_ENCRYPTION_KEY } : {}),
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: join(LOG_DIR, 'worker-error.log'),
      out_file: join(LOG_DIR, 'worker-out.log'),
      merge_logs: true,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
    },
    {
      name: 'leyova-mcp',
      cwd: join(ROOT, 'apps', 'mcp-server'),
      script: 'src/index.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx/esm',
      env: {
        NODE_ENV: 'production',
        MCP_PORT: '9101',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: join(LOG_DIR, 'mcp-error.log'),
      out_file: join(LOG_DIR, 'mcp-out.log'),
      merge_logs: true,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
    },
    {
      name: 'leyova-web',
      cwd: join(ROOT, 'apps', 'web'),
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --host 0.0.0.0 --port 5513',
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: join(LOG_DIR, 'web-error.log'),
      out_file: join(LOG_DIR, 'web-out.log'),
      merge_logs: true,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
    },
  ],
}
