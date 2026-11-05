/**
 * Auto-generated OpenAPI 3.0 specification for leyova API v2.
 * 
 * Run: npx tsx src/openapi.ts > openapi.json
 * This script generates the spec from the route structure.
 */

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'leyova API v2',
    description: 'leyova 直播电商数据管理系统 API 接口文档',
    version: '2.0.0',
    contact: { name: 'leyova Team' },
  },
  servers: [
    { url: 'http://localhost:8787', description: 'Local dev' },
    { url: 'http://localhost:5173', description: 'Via Vite proxy' },
  ],
  paths: {
    // ── Health ──
    '/health': {
      get: {
        tags: ['Health'],
        summary: '服务健康检查',
        responses: { '200': { description: '服务正常', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } } } },
      },
    },

    // ── Auth ──
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: '用户登录',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
        responses: { '200': { description: '登录成功', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } } },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: '用户退出',
        responses: { '200': { description: '退出成功' } },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: '当前用户信息',
        responses: { '200': { description: '用户信息', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserInfo' } } } } },
      },
    },

    // ── Overview / Dashboard ──
    '/api/v1/overview/stats': {
      get: {
        tags: ['Dashboard'],
        summary: 'Dashboard 核心统计数据',
        parameters: [{ name: 'period', in: 'query', schema: { type: 'string', enum: ['7d', '30d', '90d'] }, description: '统计周期' }],
        responses: { '200': { description: '统计数据' } },
      },
    },
    '/api/v1/overview/activities': {
      get: {
        tags: ['Dashboard'],
        summary: '最近活动列表',
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }],
        responses: { '200': { description: '活动列表' } },
      },
    },
    '/api/v1/overview/sessions': {
      get: {
        tags: ['Dashboard'],
        summary: '直播间场次列表',
        responses: { '200': { description: '场次列表' } },
      },
    },
    '/api/v1/overview/live-monitor': {
      get: {
        tags: ['Dashboard'],
        summary: '直播实时监控数据',
        responses: { '200': { description: '监控数据' } },
      },
    },

    // ── Anchors ──
    '/api/v1/anchors': {
      get: {
        tags: ['Anchors'],
        summary: '主播列表',
        responses: { '200': { description: '主播列表' } },
      },
    },
    '/api/v1/anchors/{id}': {
      get: {
        tags: ['Anchors'],
        summary: '主播详情',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: '主播详情' } },
      },
    },
    '/api/v1/anchors/{id}/performance': {
      get: {
        tags: ['Anchors'],
        summary: '主播绩效数据',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: '绩效数据' } },
      },
    },
    '/api/v1/training/plans': {
      get: {
        tags: ['Training'],
        summary: '培训计划列表',
        responses: { '200': { description: '培训计划' } },
      },
    },
    '/api/v1/training/records': {
      get: {
        tags: ['Training'],
        summary: '培训记录列表',
        responses: { '200': { description: '培训记录' } },
      },
    },
    '/api/v1/scripts/templates': {
      get: {
        tags: ['Scripts'],
        summary: '话术模板列表',
        responses: { '200': { description: '话术模板' } },
      },
    },

    // ── BI ──
    '/api/v1/bi/dashboard': {
      get: {
        tags: ['BI'],
        summary: 'BI 仪表盘数据',
        responses: { '200': { description: 'BI 数据' } },
      },
    },
    '/api/v1/bi/roi': {
      get: {
        tags: ['BI'],
        summary: 'ROI 分析数据',
        responses: { '200': { description: 'ROI 数据' } },
      },
    },
    '/api/v1/bi/refund': {
      get: {
        tags: ['BI'],
        summary: '退款分析数据',
        responses: { '200': { description: '退款数据' } },
      },
    },
    '/api/v1/bi/anomalies': {
      get: {
        tags: ['BI'],
        summary: '异常检测数据',
        responses: { '200': { description: '异常数据' } },
      },
    },

    // ── Ops ──
    '/api/v1/ops/capabilities': {
      get: {
        tags: ['Ops'],
        summary: '主播能力评分',
        responses: { '200': { description: '能力评分' } },
      },
    },
    '/api/v1/ops/goals': {
      get: {
        tags: ['Ops'],
        summary: '目标跟踪列表',
        responses: { '200': { description: '目标跟踪' } },
      },
    },
    '/api/v1/ops/scripts': {
      get: {
        tags: ['Ops'],
        summary: '话术库列表',
        responses: { '200': { description: '话术库' } },
      },
    },
    '/api/v1/ops/issues': {
      get: {
        tags: ['Ops'],
        summary: '问题库列表',
        responses: { '200': { description: '问题库' } },
      },
    },
    '/api/v1/ops/room-health': {
      get: {
        tags: ['Ops'],
        summary: '房间健康度列表',
        responses: { '200': { description: '房间健康度' } },
      },
    },
    '/api/v1/ops/session-products': {
      get: {
        tags: ['Ops'],
        summary: '场次商品列表',
        responses: { '200': { description: '场次商品' } },
      },
    },

    // ── System ──
    '/api/v1/system/config': {
      get: { tags: ['System'], summary: '系统配置', responses: { '200': { description: '系统配置列表' } } },
      put: { tags: ['System'], summary: '更新系统配置', responses: { '200': { description: '更新结果' } } },
    },
    '/api/v1/system/alerts': {
      get: { tags: ['System'], summary: '告警中心列表', responses: { '200': { description: '告警列表' } } },
    },
    '/api/v1/system/competitors': {
      get: { tags: ['System'], summary: '竞品监控列表', responses: { '200': { description: '竞品列表' } } },
    },
    '/api/v1/system/competitors/{id}/prices': {
      get: { tags: ['System'], summary: '竞品价格数据', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: '价格数据' } } },
    },
    '/api/v1/system/multi-room': {
      get: { tags: ['System'], summary: '多房间概览数据', responses: { '200': { description: '多房间数据' } } },
    },
    '/api/v1/system/inventory': {
      get: { tags: ['System'], summary: '库存风控数据', responses: { '200': { description: '库存数据' } } },
    },
    '/api/v1/system/users': {
      get: { tags: ['System'], summary: '用户列表', responses: { '200': { description: '用户列表', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } } } } },
      post: { tags: ['System'], summary: '创建用户', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateUserRequest' } } } }, responses: { '200': { description: '创建结果' } } },
    },
    '/api/v1/system/users/{id}': {
      put: { tags: ['System'], summary: '更新用户', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: '更新结果' } } },
      delete: { tags: ['System'], summary: '删除用户', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: '删除结果' } } },
    },

    // ── Personnel ──
    '/api/v1/personnel/anchors': {
      get: { tags: ['Personnel'], summary: '人员管理-主播列表', responses: { '200': { description: '主播列表' } } },
      post: { tags: ['Personnel'], summary: '添加主播', responses: { '200': { description: '添加结果' } } },
    },
    '/api/v1/personnel/anchors/{id}': {
      delete: { tags: ['Personnel'], summary: '删除主播', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: '删除结果' } } },
    },
    '/api/v1/personnel/operators': {
      get: { tags: ['Personnel'], summary: '人员管理-运营列表', responses: { '200': { description: '运营列表' } } },
      post: { tags: ['Personnel'], summary: '添加运营', responses: { '200': { description: '添加结果' } } },
    },
    '/api/v1/personnel/operators/{id}': {
      delete: { tags: ['Personnel'], summary: '删除运营', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: '删除结果' } } },
    },
    '/api/v1/personnel/managers': {
      get: { tags: ['Personnel'], summary: '人员管理-经理列表', responses: { '200': { description: '经理列表' } } },
      post: { tags: ['Personnel'], summary: '添加经理', responses: { '200': { description: '添加结果' } } },
    },
    '/api/v1/personnel/managers/{id}': {
      delete: { tags: ['Personnel'], summary: '删除经理', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: '删除结果' } } },
    },
    '/api/v1/attendance': {
      get: { tags: ['Personnel'], summary: '考勤数据(30天聚合)', responses: { '200': { description: '考勤数据' } } },
    },

    // ── Data ──
    '/api/v1/data/tables': {
      get: { tags: ['Data'], summary: '数据表清单', responses: { '200': { description: '表清单' } } },
    },
    '/api/v1/data/tables/{id}/refresh': {
      post: { tags: ['Data'], summary: '刷新数据表统计', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: '刷新结果' } } },
    },
    '/api/v1/data/uploads': {
      get: { tags: ['Data'], summary: '上传记录列表', responses: { '200': { description: '上传记录' } } },
      post: { tags: ['Data'], summary: '上传文件', responses: { '200': { description: '上传结果' } } },
    },
    '/api/v1/data/exports': {
      get: { tags: ['Data'], summary: '导出记录列表', responses: { '200': { description: '导出记录' } } },
      post: { tags: ['Data'], summary: '创建导出任务', responses: { '200': { description: '导出结果' } } },
    },
    '/api/v1/data/quality': {
      get: { tags: ['Data'], summary: '数据质量报告', responses: { '200': { description: '数据质量' } } },
    },

    // ── Sessions ──
    '/api/v1/sessions/{id}': {
      get: { tags: ['Sessions'], summary: '场次详情', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: '场次详情' } } },
      patch: { tags: ['Sessions'], summary: '更新场次', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: '更新结果' } } },
    },
    '/api/v1/sessions': {
      post: { tags: ['Sessions'], summary: '创建场次', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: '创建结果' } } },
    },
    '/api/v1/sessions/{id}/finalize': {
      post: { tags: ['Sessions'], summary: '完结场次', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: '完结结果' } } },
    },
    '/api/v1/sessions/{id}/metrics': {
      get: { tags: ['Sessions'], summary: '场次指标', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: '指标数据' } } },
    },

    // ── AI ──
    '/api/v1/ai/sessions': {
      get: { tags: ['AI'], summary: '对话列表', responses: { '200': { description: '对话列表' } } },
    },
    '/api/v1/ai/chat': {
      post: { tags: ['AI'], summary: '发送消息', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'AI 回复' } } },
    },
    '/api/v1/ai/messages/{conversationId}': {
      get: { tags: ['AI'], summary: '对话消息历史', parameters: [{ name: 'conversationId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: '消息列表' } } },
    },

    // ── Livereg ──
    '/api/v1/livereg/form-data': {
      get: { tags: ['Livereg'], summary: '直播登记表单数据(主播/房间/运营)', responses: { '200': { description: '表单数据' } } },
    },
    '/api/v1/livereg/submit': {
      post: { tags: ['Livereg'], summary: '提交直播登记', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/LiveregSubmitRequest' } } } }, responses: { '200': { description: '提交结果' } } },
    },
  },

  components: {
    schemas: {
      // ── Common ──
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          timestamp: { type: 'string', format: 'date-time' },
          uptime: { type: 'number' },
          db: { type: 'string', example: 'connected' },
        },
      },
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: { type: 'object' },
        },
      },

      // ── Auth ──
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', example: 'admin' },
          password: { type: 'string', format: 'password', example: '123456' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/User' },
              sessionToken: { type: 'string' },
            },
          },
        },
      },
      UserInfo: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          role: { type: 'string' },
          realName: { type: 'string' },
        },
      },

      // ── User ──
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          real_name: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'manager', 'employee'] },
          status: { type: 'integer', enum: [0, 1] },
          last_login: { type: 'string', format: 'date-time' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      CreateUserRequest: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          realName: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'manager', 'employee'] },
          status: { type: 'integer', enum: [0, 1] },
        },
      },

      // ── Livereg ──
      LiveregSubmitRequest: {
        type: 'object',
        properties: {
          roomId: { type: 'integer' },
          anchorId: { type: 'integer' },
          date: { type: 'string', format: 'date' },
          startTime: { type: 'string', format: 'time' },
          endTime: { type: 'string', format: 'time' },
          title: { type: 'string' },
        },
      },
    },
  },

  // ── Security ──
  security: [{ cookieAuth: [] }],
}