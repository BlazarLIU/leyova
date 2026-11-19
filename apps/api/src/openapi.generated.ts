/**
 * openapi.generated.ts — 自动生成的 OpenAPI 规格（P2-4）
 *
 * 由 scripts/generate-openapi.ts 从运行时真实路由清单生成，请勿手工编辑。
 * 重新生成：npm run openapi:gen -- --write
 */
export const openapiSpec = {
  "openapi": "3.0.3",
  "info": {
    "title": "leyova API v2",
    "description": "leyova 直播电商数据管理系统 API 接口文档\n\n> 本文档由 `npm run openapi:gen` 从运行时路由清单自动生成（P2-4），路径与代码保持一致。",
    "version": "2.0.0",
    "contact": {
      "name": "leyova Team"
    }
  },
  "servers": [
    {
      "url": "http://localhost:8788",
      "description": "Local API server"
    },
    {
      "url": "http://localhost:5513",
      "description": "Via Vite dev/preview proxy"
    }
  ],
  "components": {
    "schemas": {
      "HealthResponse": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string",
            "example": "ok"
          },
          "timestamp": {
            "type": "string",
            "format": "date-time"
          },
          "uptime": {
            "type": "number"
          },
          "db": {
            "type": "string",
            "example": "connected"
          }
        }
      },
      "ApiResponse": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "message": {
            "type": "string"
          },
          "data": {
            "type": "object"
          }
        }
      },
      "LoginRequest": {
        "type": "object",
        "required": [
          "username",
          "password"
        ],
        "properties": {
          "username": {
            "type": "string",
            "example": "admin"
          },
          "password": {
            "type": "string",
            "format": "password",
            "example": "123456"
          }
        }
      },
      "LoginResponse": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "data": {
            "type": "object",
            "properties": {
              "user": {
                "$ref": "#/components/schemas/User"
              },
              "sessionToken": {
                "type": "string"
              }
            }
          }
        }
      },
      "UserInfo": {
        "type": "object",
        "properties": {
          "username": {
            "type": "string"
          },
          "role": {
            "type": "string"
          },
          "realName": {
            "type": "string"
          }
        }
      },
      "User": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer"
          },
          "username": {
            "type": "string"
          },
          "real_name": {
            "type": "string"
          },
          "role": {
            "type": "string",
            "enum": [
              "super_admin",
              "admin",
              "ops_director",
              "operator",
              "ops_staff",
              "ad_buyer",
              "hrbp",
              "controller",
              "employee",
              "brand_viewer"
            ]
          },
          "status": {
            "type": "integer",
            "enum": [
              0,
              1
            ]
          },
          "last_login": {
            "type": "string",
            "format": "date-time"
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "CreateUserRequest": {
        "type": "object",
        "properties": {
          "username": {
            "type": "string"
          },
          "realName": {
            "type": "string"
          },
          "role": {
            "type": "string",
            "enum": [
              "super_admin",
              "admin",
              "ops_director",
              "operator",
              "ops_staff",
              "ad_buyer",
              "hrbp",
              "controller",
              "employee",
              "brand_viewer"
            ]
          },
          "status": {
            "type": "integer",
            "enum": [
              0,
              1
            ]
          }
        }
      },
      "LiveregSubmitRequest": {
        "type": "object",
        "properties": {
          "roomId": {
            "type": "integer"
          },
          "anchorId": {
            "type": "integer"
          },
          "date": {
            "type": "string",
            "format": "date"
          },
          "startTime": {
            "type": "string",
            "format": "time"
          },
          "endTime": {
            "type": "string",
            "format": "time"
          },
          "title": {
            "type": "string"
          }
        }
      }
    }
  },
  "security": [
    {
      "cookieAuth": []
    }
  ],
  "paths": {
    "/api/v1/access/capability-matrix": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/access/capability-matrix",
        "description": "GET /api/v1/access/capability-matrix",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/access/me": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/access/me",
        "description": "GET /api/v1/access/me",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/access/roles/{code}/grants": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/access/roles/{code}/grants",
        "description": "GET /api/v1/access/roles/{code}/grants",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/access/roles/{code}/grants",
        "description": "PUT /api/v1/access/roles/{code}/grants",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/access/users/{id}/overrides": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/access/users/{id}/overrides",
        "description": "GET /api/v1/access/users/{id}/overrides",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/access/users/{id}/overrides",
        "description": "PUT /api/v1/access/users/{id}/overrides",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/after-sales/overview": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/after-sales/overview",
        "description": "GET /api/v1/after-sales/overview",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/after-sales/rma-items": {
      "get": {
        "tags": [
          "AfterSales"
        ],
        "summary": "行级售后退换单列表 (Line RMA)",
        "description": "GET /api/v1/after-sales/rma-items",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "AfterSales"
        ],
        "summary": "申请行级售后退换",
        "description": "POST /api/v1/after-sales/rma-items",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/after-sales/rma-items/{id}/status": {
      "put": {
        "tags": [
          "AfterSales"
        ],
        "summary": "审核行级RMA并联动入库回仓",
        "description": "PUT /api/v1/after-sales/rma-items/{id}/status",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/after-sales/tickets": {
      "get": {
        "tags": [
          "AfterSales"
        ],
        "summary": "售后工单与退货原因归因闭环",
        "description": "GET /api/v1/after-sales/tickets",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/after-sales/tickets",
        "description": "POST /api/v1/after-sales/tickets",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/after-sales/tickets/{id}/handle": {
      "patch": {
        "tags": [
          "V1"
        ],
        "summary": "PATCH /api/v1/after-sales/tickets/{id}/handle",
        "description": "PATCH /api/v1/after-sales/tickets/{id}/handle",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ai/approve/{toolLogId}": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/ai/approve/{toolLogId}",
        "description": "POST /api/v1/ai/approve/{toolLogId}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ai/chat": {
      "post": {
        "tags": [
          "AI"
        ],
        "summary": "发送消息",
        "description": "POST /api/v1/ai/chat",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ai/chat/stream": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/ai/chat/stream",
        "description": "POST /api/v1/ai/chat/stream",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ai/context-bindings": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/ai/context-bindings",
        "description": "GET /api/v1/ai/context-bindings",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/ai/context-bindings",
        "description": "POST /api/v1/ai/context-bindings",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ai/context-bindings/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/ai/context-bindings/{id}",
        "description": "DELETE /api/v1/ai/context-bindings/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ai/daily-report": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/ai/daily-report",
        "description": "GET /api/v1/ai/daily-report",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ai/messages/{conversationId}": {
      "get": {
        "tags": [
          "AI"
        ],
        "summary": "对话消息历史",
        "description": "GET /api/v1/ai/messages/{conversationId}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ai/pending-approvals": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/ai/pending-approvals",
        "description": "GET /api/v1/ai/pending-approvals",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ai/reject/{toolLogId}": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/ai/reject/{toolLogId}",
        "description": "POST /api/v1/ai/reject/{toolLogId}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ai/sessions": {
      "get": {
        "tags": [
          "AI"
        ],
        "summary": "对话列表",
        "description": "GET /api/v1/ai/sessions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ai/sessions/{conversationId}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/ai/sessions/{conversationId}",
        "description": "DELETE /api/v1/ai/sessions/{conversationId}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ai/tool-logs": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/ai/tool-logs",
        "description": "GET /api/v1/ai/tool-logs",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/alerts/events": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/alerts/events",
        "description": "GET /api/v1/alerts/events",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/alerts/events/{id}/status": {
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/alerts/events/{id}/status",
        "description": "PUT /api/v1/alerts/events/{id}/status",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/alerts/events/resolve-all": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/alerts/events/resolve-all",
        "description": "POST /api/v1/alerts/events/resolve-all",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/alerts/rules": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/alerts/rules",
        "description": "GET /api/v1/alerts/rules",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/alerts/rules",
        "description": "POST /api/v1/alerts/rules",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/alerts/rules/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/alerts/rules/{id}",
        "description": "DELETE /api/v1/alerts/rules/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/alerts/rules/{id}",
        "description": "PUT /api/v1/alerts/rules/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/alerts/rules/test-webhook": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/alerts/rules/test-webhook",
        "description": "POST /api/v1/alerts/rules/test-webhook",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/analysis/metrics": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/analysis/metrics",
        "description": "GET /api/v1/analysis/metrics",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/analysis/platform-metrics/{platform}": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/analysis/platform-metrics/{platform}",
        "description": "GET /api/v1/analysis/platform-metrics/{platform}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/analysis/report": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/analysis/report",
        "description": "POST /api/v1/analysis/report",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/analysis/report/archive": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/analysis/report/archive",
        "description": "POST /api/v1/analysis/report/archive",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/analysis/run": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/analysis/run",
        "description": "POST /api/v1/analysis/run",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/analysis/runs": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/analysis/runs",
        "description": "GET /api/v1/analysis/runs",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/analysis/runs/{id}": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/analysis/runs/{id}",
        "description": "GET /api/v1/analysis/runs/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/analysis/tasks": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/analysis/tasks",
        "description": "GET /api/v1/analysis/tasks",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/analysis/tasks/convert": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/analysis/tasks/convert",
        "description": "POST /api/v1/analysis/tasks/convert",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/anchors": {
      "get": {
        "tags": [
          "Anchors"
        ],
        "summary": "主播列表",
        "description": "GET /api/v1/anchors",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/anchors/{id}": {
      "get": {
        "tags": [
          "Anchors"
        ],
        "summary": "主播详情",
        "description": "GET /api/v1/anchors/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/anchors/{id}/performance": {
      "get": {
        "tags": [
          "Anchors"
        ],
        "summary": "主播绩效数据",
        "description": "GET /api/v1/anchors/{id}/performance",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/anchors/list": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/anchors/list",
        "description": "GET /api/v1/anchors/list",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/anchors/my/performance": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/anchors/my/performance",
        "description": "GET /api/v1/anchors/my/performance",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/assortment/explain/{productId}": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/assortment/explain/{productId}",
        "description": "GET /api/v1/assortment/explain/{productId}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/assortment/recommend": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/assortment/recommend",
        "description": "GET /api/v1/assortment/recommend",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/attendance": {
      "get": {
        "tags": [
          "Personnel"
        ],
        "summary": "考勤数据(30天聚合)",
        "description": "GET /api/v1/attendance",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/auth/change-password": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/auth/change-password",
        "description": "POST /api/v1/auth/change-password",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object"
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        },
        "x-has-schema": true
      }
    },
    "/api/v1/auth/login": {
      "post": {
        "tags": [
          "Auth"
        ],
        "summary": "用户登录",
        "description": "POST /api/v1/auth/login",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object"
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        },
        "x-has-schema": true
      }
    },
    "/api/v1/auth/logout": {
      "post": {
        "tags": [
          "Auth"
        ],
        "summary": "用户退出",
        "description": "POST /api/v1/auth/logout",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/auth/me": {
      "get": {
        "tags": [
          "Auth"
        ],
        "summary": "当前用户信息",
        "description": "GET /api/v1/auth/me",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/bi/anomalies": {
      "get": {
        "tags": [
          "BI"
        ],
        "summary": "异常检测数据",
        "description": "GET /api/v1/bi/anomalies",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/bi/compare": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/bi/compare",
        "description": "GET /api/v1/bi/compare",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/bi/dashboard": {
      "get": {
        "tags": [
          "BI"
        ],
        "summary": "BI 仪表盘数据",
        "description": "GET /api/v1/bi/dashboard",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/bi/metric-query": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/bi/metric-query",
        "description": "GET /api/v1/bi/metric-query",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/bi/refund": {
      "get": {
        "tags": [
          "BI"
        ],
        "summary": "售后退款归因与平台退款指标统计",
        "description": "GET /api/v1/bi/refund",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/caliber": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/caliber",
        "description": "GET /api/v1/caliber",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/caliber/{platform}": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/caliber/{platform}",
        "description": "GET /api/v1/caliber/{platform}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/caliber/check": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/caliber/check",
        "description": "POST /api/v1/caliber/check",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/caliber/metrics": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/caliber/metrics",
        "description": "GET /api/v1/caliber/metrics",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/campaign-plan/generate": {
      "post": {
        "tags": [
          "CampaignPlan"
        ],
        "summary": "一键生成12模块全域运营方案",
        "description": "POST /api/v1/campaign-plan/generate",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/campaign-plan/plans/{id}": {
      "get": {
        "tags": [
          "CampaignPlan"
        ],
        "summary": "运营方案实例详情",
        "description": "GET /api/v1/campaign-plan/plans/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "patch": {
        "tags": [
          "CampaignPlan"
        ],
        "summary": "审批或修改运营方案状态",
        "description": "PATCH /api/v1/campaign-plan/plans/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/campaign-plan/plans/{id}/dispatch": {
      "post": {
        "tags": [
          "CampaignPlan"
        ],
        "summary": "运营方案审批后自动拆解下发（话术库+排品+投流计划）",
        "description": "POST /api/v1/campaign-plan/plans/{id}/dispatch",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/campaign-plan/templates": {
      "get": {
        "tags": [
          "CampaignPlan"
        ],
        "summary": "运营方案模板列表",
        "description": "GET /api/v1/campaign-plan/templates",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/compliance/changes": {
      "get": {
        "tags": [
          "ComplianceRules"
        ],
        "summary": "合规变更事件流与未读统计",
        "description": "GET /api/v1/compliance/changes",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/compliance/changes/{id}/ack": {
      "post": {
        "tags": [
          "ComplianceRules"
        ],
        "summary": "运营确认已读并标记处理",
        "description": "POST /api/v1/compliance/changes/{id}/ack",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/compliance/changes/{id}/assessment": {
      "get": {
        "tags": [
          "ComplianceRules"
        ],
        "summary": "变更对应AI风险评估详情",
        "description": "GET /api/v1/compliance/changes/{id}/assessment",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/compliance/events": {
      "get": {
        "tags": [
          "Compliance"
        ],
        "summary": "2026 平台合规与自动跟价风控事件台账",
        "description": "GET /api/v1/compliance/events",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/compliance/events",
        "description": "POST /api/v1/compliance/events",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/compliance/events/{id}": {
      "patch": {
        "tags": [
          "V1"
        ],
        "summary": "PATCH /api/v1/compliance/events/{id}",
        "description": "PATCH /api/v1/compliance/events/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/compliance/reminders": {
      "get": {
        "tags": [
          "ComplianceRules"
        ],
        "summary": "平台大促与活动报名提醒",
        "description": "GET /api/v1/compliance/reminders",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/compliance/rules": {
      "get": {
        "tags": [
          "ComplianceRules"
        ],
        "summary": "合规规则快照列表",
        "description": "GET /api/v1/compliance/rules",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/compliance/rules/{id}": {
      "get": {
        "tags": [
          "ComplianceRules"
        ],
        "summary": "规则详情与历史抓取版本",
        "description": "GET /api/v1/compliance/rules/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/compliance/rules/manual": {
      "post": {
        "tags": [
          "ComplianceRules"
        ],
        "summary": "手工补录平台规则（拼多多等受限渠道兜底）",
        "description": "POST /api/v1/compliance/rules/manual",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/compliance/scan": {
      "post": {
        "tags": [
          "ComplianceRules"
        ],
        "summary": "手动即时触发全网规则巡检扫描",
        "description": "POST /api/v1/compliance/scan",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/content/assets": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/content/assets",
        "description": "GET /api/v1/content/assets",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/content/assets/{id}/derive": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/content/assets/{id}/derive",
        "description": "POST /api/v1/content/assets/{id}/derive",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/content/attribution": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/content/attribution",
        "description": "GET /api/v1/content/attribution",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/content/attribution",
        "description": "POST /api/v1/content/attribution",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/content/projects": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/content/projects",
        "description": "GET /api/v1/content/projects",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/content/projects",
        "description": "POST /api/v1/content/projects",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/content/providers": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/content/providers",
        "description": "GET /api/v1/content/providers",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/content/providers",
        "description": "POST /api/v1/content/providers",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/content/providers/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/content/providers/{id}",
        "description": "DELETE /api/v1/content/providers/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/content/providers/{id}",
        "description": "PUT /api/v1/content/providers/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/content/providers/{id}/object-info": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/content/providers/{id}/object-info",
        "description": "GET /api/v1/content/providers/{id}/object-info",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/content/providers/{id}/test": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/content/providers/{id}/test",
        "description": "POST /api/v1/content/providers/{id}/test",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/content/schedules": {
      "get": {
        "tags": [
          "Content"
        ],
        "summary": "内容选题策划至多平台发布追踪工作流",
        "description": "GET /api/v1/content/schedules",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "Content"
        ],
        "summary": "创建内容排期",
        "description": "POST /api/v1/content/schedules",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/content/schedules/{id}/stage": {
      "patch": {
        "tags": [
          "V1"
        ],
        "summary": "PATCH /api/v1/content/schedules/{id}/stage",
        "description": "PATCH /api/v1/content/schedules/{id}/stage",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/content/tasks": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/content/tasks",
        "description": "GET /api/v1/content/tasks",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/content/tasks",
        "description": "POST /api/v1/content/tasks",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/content/tasks/{id}": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/content/tasks/{id}",
        "description": "GET /api/v1/content/tasks/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/content/video-metrics": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/content/video-metrics",
        "description": "GET /api/v1/content/video-metrics",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/content/video-metrics",
        "description": "POST /api/v1/content/video-metrics",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/cs/agents": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/cs/agents",
        "description": "GET /api/v1/cs/agents",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/cs/agents",
        "description": "POST /api/v1/cs/agents",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/cs/overview": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/cs/overview",
        "description": "GET /api/v1/cs/overview",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/cs/sessions": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/cs/sessions",
        "description": "GET /api/v1/cs/sessions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/cs/sessions",
        "description": "POST /api/v1/cs/sessions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/clean-rules": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/data/clean-rules",
        "description": "GET /api/v1/data/clean-rules",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/data/clean-rules",
        "description": "POST /api/v1/data/clean-rules",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/clean-rules/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/data/clean-rules/{id}",
        "description": "DELETE /api/v1/data/clean-rules/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/data/clean-rules/{id}",
        "description": "PUT /api/v1/data/clean-rules/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/clean-rules/test": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/data/clean-rules/test",
        "description": "POST /api/v1/data/clean-rules/test",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/exports": {
      "get": {
        "tags": [
          "Data"
        ],
        "summary": "导出记录列表",
        "description": "GET /api/v1/data/exports",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "Data"
        ],
        "summary": "创建导出任务",
        "description": "POST /api/v1/data/exports",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/live": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/data/live",
        "description": "GET /api/v1/data/live",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/live/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/data/live/{id}",
        "description": "DELETE /api/v1/data/live/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/data/live/{id}",
        "description": "GET /api/v1/data/live/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/data/live/{id}",
        "description": "PUT /api/v1/data/live/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/quality": {
      "get": {
        "tags": [
          "Data"
        ],
        "summary": "数据质量报告",
        "description": "GET /api/v1/data/quality",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/tables": {
      "get": {
        "tags": [
          "Data"
        ],
        "summary": "数据表清单",
        "description": "GET /api/v1/data/tables",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/tables/{id}/refresh": {
      "post": {
        "tags": [
          "Data"
        ],
        "summary": "刷新数据表统计",
        "description": "POST /api/v1/data/tables/{id}/refresh",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/upload-preview": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/data/upload-preview",
        "description": "POST /api/v1/data/upload-preview",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/uploaded-data/anchor": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/data/uploaded-data/anchor",
        "description": "GET /api/v1/data/uploaded-data/anchor",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/uploaded-data/anchor/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/data/uploaded-data/anchor/{id}",
        "description": "DELETE /api/v1/data/uploaded-data/anchor/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/uploaded-data/anchor/batch-delete": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/data/uploaded-data/anchor/batch-delete",
        "description": "POST /api/v1/data/uploaded-data/anchor/batch-delete",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/uploaded-data/channel": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/data/uploaded-data/channel",
        "description": "GET /api/v1/data/uploaded-data/channel",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/uploaded-data/channel/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/data/uploaded-data/channel/{id}",
        "description": "DELETE /api/v1/data/uploaded-data/channel/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/uploaded-data/channel/batch-delete": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/data/uploaded-data/channel/batch-delete",
        "description": "POST /api/v1/data/uploaded-data/channel/batch-delete",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/uploads": {
      "get": {
        "tags": [
          "Data"
        ],
        "summary": "上传记录列表",
        "description": "GET /api/v1/data/uploads",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "Data"
        ],
        "summary": "上传文件",
        "description": "POST /api/v1/data/uploads",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/uploads/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/data/uploads/{id}",
        "description": "DELETE /api/v1/data/uploads/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/data/uploads/{id}/download": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/data/uploads/{id}/download",
        "description": "GET /api/v1/data/uploads/{id}/download",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/douyin/shop/{id}/anchors": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/douyin/shop/{id}/anchors",
        "description": "GET /api/v1/douyin/shop/{id}/anchors",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/douyin/shop/{id}/channels": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/douyin/shop/{id}/channels",
        "description": "GET /api/v1/douyin/shop/{id}/channels",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/douyin/shop/{id}/metrics": {
      "get": {
        "tags": [
          "Platforms"
        ],
        "summary": "抖音店铺核心指标（含跨平台店铺校验）",
        "description": "GET /api/v1/douyin/shop/{id}/metrics",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/finance/accounting-subjects": {
      "get": {
        "tags": [
          "Finance"
        ],
        "summary": "会计科目主档字典",
        "description": "GET /api/v1/finance/accounting-subjects",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/finance/gl-vouchers": {
      "get": {
        "tags": [
          "Finance"
        ],
        "summary": "会计总账凭证列表",
        "description": "GET /api/v1/finance/gl-vouchers",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "Finance"
        ],
        "summary": "录入复式记账总账凭证",
        "description": "POST /api/v1/finance/gl-vouchers",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/finance/gl-vouchers/{id}": {
      "get": {
        "tags": [
          "Finance"
        ],
        "summary": "凭证详情与借贷明细",
        "description": "GET /api/v1/finance/gl-vouchers/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/finance/sessions/{sessionId}/voucher-chain": {
      "get": {
        "tags": [
          "Finance"
        ],
        "summary": "直播单场净利凭证链完整追溯",
        "description": "GET /api/v1/finance/sessions/{sessionId}/voucher-chain",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/finance/trial-balance": {
      "get": {
        "tags": [
          "Finance"
        ],
        "summary": "会计期间试算平衡表",
        "description": "GET /api/v1/finance/trial-balance",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/fulfillment/overview": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/fulfillment/overview",
        "description": "GET /api/v1/fulfillment/overview",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/fulfillment/sla-rules": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/fulfillment/sla-rules",
        "description": "GET /api/v1/fulfillment/sla-rules",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/fulfillment/waybills": {
      "get": {
        "tags": [
          "Fulfillment"
        ],
        "summary": "多平台 48h 履约 SLA 监控与赔付风控运单",
        "description": "GET /api/v1/fulfillment/waybills",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/fulfillment/waybills",
        "description": "POST /api/v1/fulfillment/waybills",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/fulfillment/waybills/{id}/dispatch": {
      "patch": {
        "tags": [
          "V1"
        ],
        "summary": "PATCH /api/v1/fulfillment/waybills/{id}/dispatch",
        "description": "PATCH /api/v1/fulfillment/waybills/{id}/dispatch",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/batches": {
      "get": {
        "tags": [
          "Governance"
        ],
        "summary": "数据治理接入批次与质量校验发布闸门清单",
        "description": "GET /api/v1/governance/batches",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/batches/{id}": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/governance/batches/{id}",
        "description": "GET /api/v1/governance/batches/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/batches/{id}/clean": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/governance/batches/{id}/clean",
        "description": "POST /api/v1/governance/batches/{id}/clean",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/batches/{id}/issues": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/governance/batches/{id}/issues",
        "description": "GET /api/v1/governance/batches/{id}/issues",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/batches/{id}/publish": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/governance/batches/{id}/publish",
        "description": "POST /api/v1/governance/batches/{id}/publish",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/batches/{id}/quarantine": {
      "get": {
        "tags": [
          "Governance"
        ],
        "summary": "查询批次质量隔离区异常数据",
        "description": "GET /api/v1/governance/batches/{id}/quarantine",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "Governance"
        ],
        "summary": "写入批次数据质量隔离区",
        "description": "POST /api/v1/governance/batches/{id}/quarantine",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/batches/{id}/reconcile": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/governance/batches/{id}/reconcile",
        "description": "POST /api/v1/governance/batches/{id}/reconcile",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/batches/{id}/run-quality-gates": {
      "post": {
        "tags": [
          "Governance"
        ],
        "summary": "执行 8 条 SQL 质量门禁断言评估",
        "description": "POST /api/v1/governance/batches/{id}/run-quality-gates",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/batches/{id}/staging-load": {
      "post": {
        "tags": [
          "Governance"
        ],
        "summary": "集合式批量暂存与哨兵去重",
        "description": "POST /api/v1/governance/batches/{id}/staging-load",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/batches/{id}/validate": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/governance/batches/{id}/validate",
        "description": "POST /api/v1/governance/batches/{id}/validate",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/entity-aliases": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/governance/entity-aliases",
        "description": "GET /api/v1/governance/entity-aliases",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/governance/entity-aliases",
        "description": "POST /api/v1/governance/entity-aliases",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/entity-aliases/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/governance/entity-aliases/{id}",
        "description": "DELETE /api/v1/governance/entity-aliases/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/field-mappings": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/governance/field-mappings",
        "description": "GET /api/v1/governance/field-mappings",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/governance/field-mappings",
        "description": "POST /api/v1/governance/field-mappings",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/ingest/api": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/governance/ingest/api",
        "description": "POST /api/v1/governance/ingest/api",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/ingest/file": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/governance/ingest/file",
        "description": "POST /api/v1/governance/ingest/file",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/issues/{id}/resolve": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/governance/issues/{id}/resolve",
        "description": "POST /api/v1/governance/issues/{id}/resolve",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/platforms/specs": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/governance/platforms/specs",
        "description": "GET /api/v1/governance/platforms/specs",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/publishes/{id}/reverse": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/governance/publishes/{id}/reverse",
        "description": "POST /api/v1/governance/publishes/{id}/reverse",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/governance/quarantine/{id}/status": {
      "put": {
        "tags": [
          "Governance"
        ],
        "summary": "处置隔离区异常行状态",
        "description": "PUT /api/v1/governance/quarantine/{id}/status",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/health": {
      "get": {
        "tags": [
          "Health"
        ],
        "summary": "服务健康检查与 DB 连通性探针",
        "description": "GET /api/v1/health",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/hrbp/attendance": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/hrbp/attendance",
        "description": "GET /api/v1/hrbp/attendance",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/hrbp/efficiency/anchors": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/hrbp/efficiency/anchors",
        "description": "GET /api/v1/hrbp/efficiency/anchors",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/hrbp/efficiency/growth": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/hrbp/efficiency/growth",
        "description": "GET /api/v1/hrbp/efficiency/growth",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/hrbp/efficiency/risk": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/hrbp/efficiency/risk",
        "description": "GET /api/v1/hrbp/efficiency/risk",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/hrbp/efficiency/summary": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/hrbp/efficiency/summary",
        "description": "GET /api/v1/hrbp/efficiency/summary",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/hrbp/efficiency/utilization": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/hrbp/efficiency/utilization",
        "description": "GET /api/v1/hrbp/efficiency/utilization",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/hrbp/overview": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/hrbp/overview",
        "description": "GET /api/v1/hrbp/overview",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/hrbp/performance": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/hrbp/performance",
        "description": "GET /api/v1/hrbp/performance",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/hrbp/recruitment/auditions": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/hrbp/recruitment/auditions",
        "description": "POST /api/v1/hrbp/recruitment/auditions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/hrbp/recruitment/candidates": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/hrbp/recruitment/candidates",
        "description": "GET /api/v1/hrbp/recruitment/candidates",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/hrbp/recruitment/candidates",
        "description": "POST /api/v1/hrbp/recruitment/candidates",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/hrbp/recruitment/candidates/{id}/onboard": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/hrbp/recruitment/candidates/{id}/onboard",
        "description": "POST /api/v1/hrbp/recruitment/candidates/{id}/onboard",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/hrbp/training": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/hrbp/training",
        "description": "GET /api/v1/hrbp/training",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ingest/detect-template": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/ingest/detect-template",
        "description": "POST /api/v1/ingest/detect-template",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ingest/facts": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/ingest/facts",
        "description": "GET /api/v1/ingest/facts",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ingest/fingerprint": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/ingest/fingerprint",
        "description": "POST /api/v1/ingest/fingerprint",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ingest/jobs": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/ingest/jobs",
        "description": "GET /api/v1/ingest/jobs",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ingest/manual-upload": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/ingest/manual-upload",
        "description": "POST /api/v1/ingest/manual-upload",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ingest/mappings": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/ingest/mappings",
        "description": "POST /api/v1/ingest/mappings",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ingest/platform-templates": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/ingest/platform-templates",
        "description": "GET /api/v1/ingest/platform-templates",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ingest/platform-templates/{code}": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/ingest/platform-templates/{code}",
        "description": "GET /api/v1/ingest/platform-templates/{code}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ingest/preview": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/ingest/preview",
        "description": "POST /api/v1/ingest/preview",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ingest/stats": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/ingest/stats",
        "description": "GET /api/v1/ingest/stats",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ingest/sync": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/ingest/sync",
        "description": "POST /api/v1/ingest/sync",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ingest/templates": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/ingest/templates",
        "description": "GET /api/v1/ingest/templates",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/insights/douyin/short-video-funnel": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/insights/douyin/short-video-funnel",
        "description": "GET /api/v1/insights/douyin/short-video-funnel",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/insights/douyin/three-pools": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/insights/douyin/three-pools",
        "description": "GET /api/v1/insights/douyin/three-pools",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/insights/taobao/shop-session-link": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/insights/taobao/shop-session-link",
        "description": "GET /api/v1/insights/taobao/shop-session-link",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/insights/taobao/three-sources": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/insights/taobao/three-sources",
        "description": "GET /api/v1/insights/taobao/three-sources",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/insights/tmall/brand-sessions": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/insights/tmall/brand-sessions",
        "description": "GET /api/v1/insights/tmall/brand-sessions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/insights/tmall/live-promo-link": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/insights/tmall/live-promo-link",
        "description": "GET /api/v1/insights/tmall/live-promo-link",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/insights/tmall/promotion-layers": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/insights/tmall/promotion-layers",
        "description": "GET /api/v1/insights/tmall/promotion-layers",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/insights/wechat/affiliate": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/insights/wechat/affiliate",
        "description": "GET /api/v1/insights/wechat/affiliate",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/insights/wechat/content": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/insights/wechat/content",
        "description": "GET /api/v1/insights/wechat/content",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/insights/wechat/private-public-split": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/insights/wechat/private-public-split",
        "description": "GET /api/v1/insights/wechat/private-public-split",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/insights/xiaohongshu/buyer-profile": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/insights/xiaohongshu/buyer-profile",
        "description": "GET /api/v1/insights/xiaohongshu/buyer-profile",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/insights/xiaohongshu/dandelion": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/insights/xiaohongshu/dandelion",
        "description": "GET /api/v1/insights/xiaohongshu/dandelion",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/insights/xiaohongshu/note-to-live": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/insights/xiaohongshu/note-to-live",
        "description": "GET /api/v1/insights/xiaohongshu/note-to-live",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/insights/xiaohongshu/traffic-sources": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/insights/xiaohongshu/traffic-sources",
        "description": "GET /api/v1/insights/xiaohongshu/traffic-sources",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/inventory/channel-listings": {
      "get": {
        "tags": [
          "Inventory"
        ],
        "summary": "各渠道商品定价与库存配额",
        "description": "GET /api/v1/inventory/channel-listings",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "Inventory"
        ],
        "summary": "创建/绑定渠道定价与配额",
        "description": "POST /api/v1/inventory/channel-listings",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/inventory/channel-listings/{id}": {
      "put": {
        "tags": [
          "Inventory"
        ],
        "summary": "调整渠道定价与配额",
        "description": "PUT /api/v1/inventory/channel-listings/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/inventory/ledger": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/inventory/ledger",
        "description": "GET /api/v1/inventory/ledger",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/inventory/overview": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/inventory/overview",
        "description": "GET /api/v1/inventory/overview",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/inventory/products": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/inventory/products",
        "description": "GET /api/v1/inventory/products",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/inventory/products",
        "description": "POST /api/v1/inventory/products",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/inventory/reservations": {
      "get": {
        "tags": [
          "Inventory"
        ],
        "summary": "库存预留记录列表",
        "description": "GET /api/v1/inventory/reservations",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/inventory/reservations/{reservationNo}/commit": {
      "post": {
        "tags": [
          "Inventory"
        ],
        "summary": "支付完成核销预留出库",
        "description": "POST /api/v1/inventory/reservations/{reservationNo}/commit",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/inventory/reservations/{reservationNo}/release": {
      "post": {
        "tags": [
          "Inventory"
        ],
        "summary": "订单取消或超时释放预留",
        "description": "POST /api/v1/inventory/reservations/{reservationNo}/release",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/inventory/reservations/reserve": {
      "post": {
        "tags": [
          "Inventory"
        ],
        "summary": "原子悲观锁预留库存防超卖",
        "description": "POST /api/v1/inventory/reservations/reserve",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/inventory/sku-mappings": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/inventory/sku-mappings",
        "description": "POST /api/v1/inventory/sku-mappings",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/inventory/stock/adjust": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/inventory/stock/adjust",
        "description": "POST /api/v1/inventory/stock/adjust",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/kb/config": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/kb/config",
        "description": "GET /api/v1/kb/config",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/kb/config",
        "description": "PUT /api/v1/kb/config",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/kb/search": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/kb/search",
        "description": "POST /api/v1/kb/search",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/kb/status": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/kb/status",
        "description": "GET /api/v1/kb/status",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/kb/test": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/kb/test",
        "description": "POST /api/v1/kb/test",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/kol/cooperations": {
      "get": {
        "tags": [
          "KOL"
        ],
        "summary": "外部达人档案与带货佣金台账",
        "description": "GET /api/v1/kol/cooperations",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/kol/cooperations",
        "description": "POST /api/v1/kol/cooperations",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/kol/cooperations/{id}/settle": {
      "patch": {
        "tags": [
          "V1"
        ],
        "summary": "PATCH /api/v1/kol/cooperations/{id}/settle",
        "description": "PATCH /api/v1/kol/cooperations/{id}/settle",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/kol/overview": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/kol/overview",
        "description": "GET /api/v1/kol/overview",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/kol/profiles": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/kol/profiles",
        "description": "GET /api/v1/kol/profiles",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/kol/profiles",
        "description": "POST /api/v1/kol/profiles",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/kuaishou/shop/{id}/ad-roi": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/kuaishou/shop/{id}/ad-roi",
        "description": "GET /api/v1/kuaishou/shop/{id}/ad-roi",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/kuaishou/shop/{id}/fans": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/kuaishou/shop/{id}/fans",
        "description": "GET /api/v1/kuaishou/shop/{id}/fans",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/kuaishou/shop/{id}/indirect-gmv": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/kuaishou/shop/{id}/indirect-gmv",
        "description": "GET /api/v1/kuaishou/shop/{id}/indirect-gmv",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/kuaishou/shop/{id}/traffic-split": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/kuaishou/shop/{id}/traffic-split",
        "description": "GET /api/v1/kuaishou/shop/{id}/traffic-split",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/livereg/form-data": {
      "get": {
        "tags": [
          "Livereg"
        ],
        "summary": "直播登记表单数据(主播/房间/运营)",
        "description": "GET /api/v1/livereg/form-data",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/livereg/submit": {
      "post": {
        "tags": [
          "Livereg"
        ],
        "summary": "提交直播登记",
        "description": "POST /api/v1/livereg/submit",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/maintenance/aggregate": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/maintenance/aggregate",
        "description": "POST /api/v1/maintenance/aggregate",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/maintenance/aggregate-status": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/maintenance/aggregate-status",
        "description": "GET /api/v1/maintenance/aggregate-status",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/maintenance/partitions": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/maintenance/partitions",
        "description": "GET /api/v1/maintenance/partitions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/maintenance/partitions",
        "description": "POST /api/v1/maintenance/partitions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/members/overview": {
      "get": {
        "tags": [
          "Growth"
        ],
        "summary": "会员资产分级与私域复购留存总览",
        "description": "GET /api/v1/members/overview",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/members/summary": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/members/summary",
        "description": "POST /api/v1/members/summary",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/metrics": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/metrics",
        "description": "GET /api/v1/metrics",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/net-roi/ad-plans": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/net-roi/ad-plans",
        "description": "GET /api/v1/net-roi/ad-plans",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/net-roi/ad-plans",
        "description": "POST /api/v1/net-roi/ad-plans",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/net-roi/ad-plans/{id}": {
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/net-roi/ad-plans/{id}",
        "description": "PUT /api/v1/net-roi/ad-plans/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/net-roi/ad-plans/{id}/receipt": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/net-roi/ad-plans/{id}/receipt",
        "description": "POST /api/v1/net-roi/ad-plans/{id}/receipt",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/net-roi/ad-spend": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/net-roi/ad-spend",
        "description": "GET /api/v1/net-roi/ad-spend",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/net-roi/ad-spend",
        "description": "POST /api/v1/net-roi/ad-spend",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/net-roi/attribution-windows": {
      "get": {
        "tags": [
          "NetROI"
        ],
        "summary": "7大平台官方广告归因窗口与结算周期字典",
        "description": "GET /api/v1/net-roi/attribution-windows",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/net-roi/overview": {
      "get": {
        "tags": [
          "NetROI"
        ],
        "summary": "T+0 消耗归因 vs T+7 净成交 ROI 双时间线总览",
        "description": "GET /api/v1/net-roi/overview",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/net-roi/settlement-cycles": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/net-roi/settlement-cycles",
        "description": "GET /api/v1/net-roi/settlement-cycles",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/net-roi/settlement-cycles",
        "description": "POST /api/v1/net-roi/settlement-cycles",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/omnichannel/capabilities": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/omnichannel/capabilities",
        "description": "GET /api/v1/omnichannel/capabilities",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/omnichannel/overview": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/omnichannel/overview",
        "description": "GET /api/v1/omnichannel/overview",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/omnichannel/platforms": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/omnichannel/platforms",
        "description": "GET /api/v1/omnichannel/platforms",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/omnichannel/shop/{id}": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/omnichannel/shop/{id}",
        "description": "GET /api/v1/omnichannel/shop/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/omnichannel/shop/{id}/products": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/omnichannel/shop/{id}/products",
        "description": "GET /api/v1/omnichannel/shop/{id}/products",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/omnichannel/shops": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/omnichannel/shops",
        "description": "GET /api/v1/omnichannel/shops",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/omnichannel/trend": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/omnichannel/trend",
        "description": "GET /api/v1/omnichannel/trend",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ops/capabilities": {
      "get": {
        "tags": [
          "Ops"
        ],
        "summary": "主播能力评分",
        "description": "GET /api/v1/ops/capabilities",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ops/goal-tracking": {
      "get": {
        "tags": [
          "Ops"
        ],
        "summary": "目标跟踪列表",
        "description": "GET /api/v1/ops/goal-tracking",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/ops/goal-tracking",
        "description": "POST /api/v1/ops/goal-tracking",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ops/goal-tracking/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/ops/goal-tracking/{id}",
        "description": "DELETE /api/v1/ops/goal-tracking/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/ops/goal-tracking/{id}",
        "description": "PUT /api/v1/ops/goal-tracking/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ops/issue-library": {
      "get": {
        "tags": [
          "Ops"
        ],
        "summary": "问题库列表",
        "description": "GET /api/v1/ops/issue-library",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/ops/issue-library",
        "description": "POST /api/v1/ops/issue-library",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ops/issue-library/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/ops/issue-library/{id}",
        "description": "DELETE /api/v1/ops/issue-library/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/ops/issue-library/{id}",
        "description": "PUT /api/v1/ops/issue-library/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ops/room-health": {
      "get": {
        "tags": [
          "Ops"
        ],
        "summary": "房间健康度列表",
        "description": "GET /api/v1/ops/room-health",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ops/script-library": {
      "get": {
        "tags": [
          "Ops"
        ],
        "summary": "话术库列表",
        "description": "GET /api/v1/ops/script-library",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/ops/script-library",
        "description": "POST /api/v1/ops/script-library",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ops/script-library/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/ops/script-library/{id}",
        "description": "DELETE /api/v1/ops/script-library/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/ops/script-library/{id}",
        "description": "PUT /api/v1/ops/script-library/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ops/session-plans": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/ops/session-plans",
        "description": "GET /api/v1/ops/session-plans",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/ops/session-plans",
        "description": "POST /api/v1/ops/session-plans",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ops/session-plans/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/ops/session-plans/{id}",
        "description": "DELETE /api/v1/ops/session-plans/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/ops/session-plans/{id}",
        "description": "PUT /api/v1/ops/session-plans/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/orders/{orderId}/events": {
      "post": {
        "tags": [
          "Orders"
        ],
        "summary": "记录订单状态变更事件",
        "description": "POST /api/v1/orders/{orderId}/events",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/orders/{orderId}/timeline": {
      "get": {
        "tags": [
          "Orders"
        ],
        "summary": "订单全生命周期不可篡改事件流时间轴",
        "description": "GET /api/v1/orders/{orderId}/timeline",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/overview/activities": {
      "get": {
        "tags": [
          "Dashboard"
        ],
        "summary": "最近活动列表",
        "description": "GET /api/v1/overview/activities",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/overview/analytics": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/overview/analytics",
        "description": "GET /api/v1/overview/analytics",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/overview/cockpit": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/overview/cockpit",
        "description": "GET /api/v1/overview/cockpit",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/overview/daily-report": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/overview/daily-report",
        "description": "GET /api/v1/overview/daily-report",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/overview/daily-reports": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/overview/daily-reports",
        "description": "GET /api/v1/overview/daily-reports",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/overview/live-monitor": {
      "get": {
        "tags": [
          "Dashboard"
        ],
        "summary": "直播实时监控数据",
        "description": "GET /api/v1/overview/live-monitor",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/overview/patrol-records": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/overview/patrol-records",
        "description": "GET /api/v1/overview/patrol-records",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/overview/patrol-summary": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/overview/patrol-summary",
        "description": "GET /api/v1/overview/patrol-summary",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/overview/sessions": {
      "get": {
        "tags": [
          "Dashboard"
        ],
        "summary": "直播间场次列表",
        "description": "GET /api/v1/overview/sessions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/overview/stats": {
      "get": {
        "tags": [
          "Dashboard"
        ],
        "summary": "Dashboard 核心统计数据",
        "description": "GET /api/v1/overview/stats",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/personnel/anchors": {
      "get": {
        "tags": [
          "Personnel"
        ],
        "summary": "人员管理-主播列表",
        "description": "GET /api/v1/personnel/anchors",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "Personnel"
        ],
        "summary": "添加主播",
        "description": "POST /api/v1/personnel/anchors",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/personnel/anchors/{id}": {
      "delete": {
        "tags": [
          "Personnel"
        ],
        "summary": "删除主播",
        "description": "DELETE /api/v1/personnel/anchors/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/personnel/anchors/{id}",
        "description": "PUT /api/v1/personnel/anchors/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/personnel/managers": {
      "get": {
        "tags": [
          "Personnel"
        ],
        "summary": "人员管理-经理列表",
        "description": "GET /api/v1/personnel/managers",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "Personnel"
        ],
        "summary": "添加经理",
        "description": "POST /api/v1/personnel/managers",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/personnel/managers/{id}": {
      "delete": {
        "tags": [
          "Personnel"
        ],
        "summary": "删除经理",
        "description": "DELETE /api/v1/personnel/managers/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/personnel/operators": {
      "get": {
        "tags": [
          "Personnel"
        ],
        "summary": "人员管理-运营列表",
        "description": "GET /api/v1/personnel/operators",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "Personnel"
        ],
        "summary": "添加运营",
        "description": "POST /api/v1/personnel/operators",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/personnel/operators/{id}": {
      "delete": {
        "tags": [
          "Personnel"
        ],
        "summary": "删除运营",
        "description": "DELETE /api/v1/personnel/operators/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/personnel/operators/{id}",
        "description": "PUT /api/v1/personnel/operators/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/platforms": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/platforms",
        "description": "GET /api/v1/platforms",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/platforms/{code}": {
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/platforms/{code}",
        "description": "PUT /api/v1/platforms/{code}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/platforms/{code}/oauth/callback": {
      "post": {
        "tags": [
          "Platforms"
        ],
        "summary": "开放平台 OAuth 授权码换取 Token 并 AES-256-GCM 加密入库（仅管理员）",
        "description": "POST /api/v1/platforms/{code}/oauth/callback",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/platforms/{code}/oauth/url": {
      "get": {
        "tags": [
          "Platforms"
        ],
        "summary": "生成开放平台 OAuth 授权跳转 URL（仅管理员）",
        "description": "GET /api/v1/platforms/{code}/oauth/url",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/platforms/{code}/shops": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/platforms/{code}/shops",
        "description": "GET /api/v1/platforms/{code}/shops",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/platforms/{code}/shops/{shopId}/credentials": {
      "post": {
        "tags": [
          "Platforms"
        ],
        "summary": "AES-256-GCM 加密配置店铺开放平台凭证或切换授权状态（仅管理员）",
        "description": "POST /api/v1/platforms/{code}/shops/{shopId}/credentials",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/platforms/permissions": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/platforms/permissions",
        "description": "GET /api/v1/platforms/permissions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/platforms/permissions",
        "description": "PUT /api/v1/platforms/permissions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/promotions/rules": {
      "get": {
        "tags": [
          "Growth"
        ],
        "summary": "大促 5 层叠加优惠规则列表",
        "description": "GET /api/v1/promotions/rules",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "Growth"
        ],
        "summary": "创建大促叠加优惠规则",
        "description": "POST /api/v1/promotions/rules",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/promotions/rules/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/promotions/rules/{id}",
        "description": "DELETE /api/v1/promotions/rules/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/promotions/simulate": {
      "post": {
        "tags": [
          "Growth"
        ],
        "summary": "大促 5 层叠加折后价与净毛利试算（非财务角色自动脱敏成本）",
        "description": "POST /api/v1/promotions/simulate",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/ready": {
      "get": {
        "tags": [
          "Health"
        ],
        "summary": "服务就绪探针（验证数据库连接与核心表就绪状态）",
        "description": "GET /api/v1/ready",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/resources/dict-items": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/resources/dict-items",
        "description": "GET /api/v1/resources/dict-items",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object"
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        },
        "x-has-schema": true
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/resources/dict-items",
        "description": "POST /api/v1/resources/dict-items",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object"
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        },
        "x-has-schema": true
      }
    },
    "/api/v1/resources/dict-items/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/resources/dict-items/{id}",
        "description": "DELETE /api/v1/resources/dict-items/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object"
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        },
        "x-has-schema": true
      },
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/resources/dict-items/{id}",
        "description": "GET /api/v1/resources/dict-items/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object"
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        },
        "x-has-schema": true
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/resources/dict-items/{id}",
        "description": "PUT /api/v1/resources/dict-items/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object"
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        },
        "x-has-schema": true
      }
    },
    "/api/v1/review/anchors": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/review/anchors",
        "description": "GET /api/v1/review/anchors",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/review/channels": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/review/channels",
        "description": "GET /api/v1/review/channels",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/review/channels/{channel}": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/review/channels/{channel}",
        "description": "GET /api/v1/review/channels/{channel}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/review/compare": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/review/compare",
        "description": "GET /api/v1/review/compare",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/review/funnel": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/review/funnel",
        "description": "GET /api/v1/review/funnel",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/review/funnel-data": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/review/funnel-data",
        "description": "GET /api/v1/review/funnel-data",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/review/live-rooms": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/review/live-rooms",
        "description": "GET /api/v1/review/live-rooms",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/review/overview": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/review/overview",
        "description": "GET /api/v1/review/overview",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/review/products": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/review/products",
        "description": "GET /api/v1/review/products",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/review/related-issues": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/review/related-issues",
        "description": "GET /api/v1/review/related-issues",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/review/session-info": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/review/session-info",
        "description": "GET /api/v1/review/session-info",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/review/sessions": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/review/sessions",
        "description": "GET /api/v1/review/sessions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/review/short-videos": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/review/short-videos",
        "description": "GET /api/v1/review/short-videos",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/schedule/apply-recommendation": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/schedule/apply-recommendation",
        "description": "POST /api/v1/schedule/apply-recommendation",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/schedule/calendar": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/schedule/calendar",
        "description": "GET /api/v1/schedule/calendar",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/schedule/day-status": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/schedule/day-status",
        "description": "GET /api/v1/schedule/day-status",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/schedule/day-status",
        "description": "PUT /api/v1/schedule/day-status",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/schedule/meta": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/schedule/meta",
        "description": "GET /api/v1/schedule/meta",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/schedule/my": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/schedule/my",
        "description": "GET /api/v1/schedule/my",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/schedule/my/leave": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/schedule/my/leave",
        "description": "POST /api/v1/schedule/my/leave",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/schedule/recommendations": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/schedule/recommendations",
        "description": "GET /api/v1/schedule/recommendations",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/schedule/sessions": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/schedule/sessions",
        "description": "GET /api/v1/schedule/sessions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/schedule/sessions",
        "description": "POST /api/v1/schedule/sessions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/schedule/sessions/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/schedule/sessions/{id}",
        "description": "DELETE /api/v1/schedule/sessions/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/schedule/sessions/{id}",
        "description": "PUT /api/v1/schedule/sessions/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/schedule/sessions/{id}/staff": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/schedule/sessions/{id}/staff",
        "description": "POST /api/v1/schedule/sessions/{id}/staff",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/schedule/staff-roles": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/schedule/staff-roles",
        "description": "GET /api/v1/schedule/staff-roles",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/scripts/templates": {
      "get": {
        "tags": [
          "Scripts"
        ],
        "summary": "话术模板列表",
        "description": "GET /api/v1/scripts/templates",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/scripts/templates",
        "description": "POST /api/v1/scripts/templates",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/search-keywords": {
      "get": {
        "tags": [
          "Search"
        ],
        "summary": "全平台搜索词卡位排名与小红书笔记搜索词联合分析",
        "description": "GET /api/v1/search-keywords",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/search-keywords",
        "description": "POST /api/v1/search-keywords",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/selection/categories": {
      "get": {
        "tags": [
          "Selection"
        ],
        "summary": "商品类目树与信号源权重",
        "description": "GET /api/v1/selection/categories",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/selection/recommend": {
      "post": {
        "tags": [
          "Selection"
        ],
        "summary": "全品类多因子选品推荐运行",
        "description": "POST /api/v1/selection/recommend",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/selection/recommendations": {
      "get": {
        "tags": [
          "Selection"
        ],
        "summary": "历史选品推荐记录分页列表",
        "description": "GET /api/v1/selection/recommendations",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/selection/recommendations/{id}": {
      "get": {
        "tags": [
          "Selection"
        ],
        "summary": "选品推荐详情与商品明细",
        "description": "GET /api/v1/selection/recommendations/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/selection/recommendations/{id}/adopt": {
      "post": {
        "tags": [
          "Selection"
        ],
        "summary": "采纳选品推荐方案",
        "description": "POST /api/v1/selection/recommendations/{id}/adopt",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/sessions": {
      "post": {
        "tags": [
          "Sessions"
        ],
        "summary": "创建场次",
        "description": "POST /api/v1/sessions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/sessions/{id}": {
      "get": {
        "tags": [
          "Sessions"
        ],
        "summary": "场次详情",
        "description": "GET /api/v1/sessions/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "patch": {
        "tags": [
          "Sessions"
        ],
        "summary": "更新场次",
        "description": "PATCH /api/v1/sessions/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/sessions/{id}/cancel": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/sessions/{id}/cancel",
        "description": "POST /api/v1/sessions/{id}/cancel",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/sessions/{id}/finalize": {
      "post": {
        "tags": [
          "Sessions"
        ],
        "summary": "完结场次",
        "description": "POST /api/v1/sessions/{id}/finalize",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/sessions/{id}/full-trace": {
      "get": {
        "tags": [
          "Sessions"
        ],
        "summary": "场次全链路穿透查询（人货场+排品+投流+PnL+履约售后）",
        "description": "GET /api/v1/sessions/{id}/full-trace",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/sessions/{id}/metrics": {
      "get": {
        "tags": [
          "Sessions"
        ],
        "summary": "场次指标",
        "description": "GET /api/v1/sessions/{id}/metrics",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/sessions/{id}/pnl": {
      "get": {
        "tags": [
          "Sessions"
        ],
        "summary": "场次真实盈亏核算（缺项返回null）",
        "description": "GET /api/v1/sessions/{id}/pnl",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/sessions/{id}/slots": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/sessions/{id}/slots",
        "description": "GET /api/v1/sessions/{id}/slots",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/sessions/{id}/slots",
        "description": "PUT /api/v1/sessions/{id}/slots",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/sessions/{id}/start": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/sessions/{id}/start",
        "description": "POST /api/v1/sessions/{id}/start",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/alerts": {
      "get": {
        "tags": [
          "System"
        ],
        "summary": "告警中心列表",
        "description": "GET /api/v1/system/alerts",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/audit-logs": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/system/audit-logs",
        "description": "GET /api/v1/system/audit-logs",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/competitors": {
      "get": {
        "tags": [
          "System"
        ],
        "summary": "竞品监控列表",
        "description": "GET /api/v1/system/competitors",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/system/competitors",
        "description": "POST /api/v1/system/competitors",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/config": {
      "get": {
        "tags": [
          "System"
        ],
        "summary": "系统配置",
        "description": "GET /api/v1/system/config",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "System"
        ],
        "summary": "更新系统配置",
        "description": "PUT /api/v1/system/config",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/custom-fields/definitions": {
      "get": {
        "tags": [
          "System"
        ],
        "summary": "实体自定义字段元定义列表",
        "description": "GET /api/v1/system/custom-fields/definitions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "System"
        ],
        "summary": "新增自定义字段定义",
        "description": "POST /api/v1/system/custom-fields/definitions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/custom-fields/definitions/{id}": {
      "delete": {
        "tags": [
          "System"
        ],
        "summary": "停用自定义字段定义",
        "description": "DELETE /api/v1/system/custom-fields/definitions/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "System"
        ],
        "summary": "更新自定义字段定义",
        "description": "PUT /api/v1/system/custom-fields/definitions/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/custom-fields/values": {
      "get": {
        "tags": [
          "System"
        ],
        "summary": "获取指定实体的自定义字段值",
        "description": "GET /api/v1/system/custom-fields/values",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/custom-fields/values/batch-save": {
      "post": {
        "tags": [
          "System"
        ],
        "summary": "批量校验并保存实体自定义字段",
        "description": "POST /api/v1/system/custom-fields/values/batch-save",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/dict": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/system/dict",
        "description": "GET /api/v1/system/dict",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/system/dict",
        "description": "POST /api/v1/system/dict",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/dict/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/system/dict/{id}",
        "description": "DELETE /api/v1/system/dict/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/system/dict/{id}",
        "description": "PUT /api/v1/system/dict/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/jobs": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/system/jobs",
        "description": "GET /api/v1/system/jobs",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/system/jobs",
        "description": "POST /api/v1/system/jobs",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/jobs/{id}": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/system/jobs/{id}",
        "description": "GET /api/v1/system/jobs/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/jobs/{id}/cancel": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/system/jobs/{id}/cancel",
        "description": "POST /api/v1/system/jobs/{id}/cancel",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/module-parameters": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/system/module-parameters",
        "description": "GET /api/v1/system/module-parameters",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/system/module-parameters",
        "description": "PUT /api/v1/system/module-parameters",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/module-parameters/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/system/module-parameters/{id}",
        "description": "DELETE /api/v1/system/module-parameters/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/module-parameters/resolve": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/system/module-parameters/resolve",
        "description": "GET /api/v1/system/module-parameters/resolve",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/modules": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/system/modules",
        "description": "GET /api/v1/system/modules",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/modules/{code}/enabled": {
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/system/modules/{code}/enabled",
        "description": "PUT /api/v1/system/modules/{code}/enabled",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/multi-room": {
      "get": {
        "tags": [
          "System"
        ],
        "summary": "多房间概览数据",
        "description": "GET /api/v1/system/multi-room",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/promotions": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/system/promotions",
        "description": "GET /api/v1/system/promotions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/system/promotions",
        "description": "POST /api/v1/system/promotions",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/roles": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/system/roles",
        "description": "GET /api/v1/system/roles",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/system/roles",
        "description": "POST /api/v1/system/roles",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/roles/{code}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/system/roles/{code}",
        "description": "DELETE /api/v1/system/roles/{code}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/system/roles/{code}",
        "description": "PUT /api/v1/system/roles/{code}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/roles/modules": {
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/system/roles/modules",
        "description": "PUT /api/v1/system/roles/modules",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/rooms": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/system/rooms",
        "description": "GET /api/v1/system/rooms",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/system/rooms",
        "description": "POST /api/v1/system/rooms",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/rooms/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/system/rooms/{id}",
        "description": "DELETE /api/v1/system/rooms/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/system/rooms/{id}",
        "description": "PUT /api/v1/system/rooms/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/target-templates": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/system/target-templates",
        "description": "GET /api/v1/system/target-templates",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/system/target-templates",
        "description": "POST /api/v1/system/target-templates",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/target-templates/{id}": {
      "delete": {
        "tags": [
          "V1"
        ],
        "summary": "DELETE /api/v1/system/target-templates/{id}",
        "description": "DELETE /api/v1/system/target-templates/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/system/target-templates/{id}",
        "description": "PUT /api/v1/system/target-templates/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/target-templates/{id}/apply": {
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/system/target-templates/{id}/apply",
        "description": "POST /api/v1/system/target-templates/{id}/apply",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/tasks": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/system/tasks",
        "description": "GET /api/v1/system/tasks",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "V1"
        ],
        "summary": "POST /api/v1/system/tasks",
        "description": "POST /api/v1/system/tasks",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/tasks/{id}/status": {
      "put": {
        "tags": [
          "V1"
        ],
        "summary": "PUT /api/v1/system/tasks/{id}/status",
        "description": "PUT /api/v1/system/tasks/{id}/status",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/users": {
      "get": {
        "tags": [
          "System"
        ],
        "summary": "用户列表",
        "description": "GET /api/v1/system/users",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "post": {
        "tags": [
          "System"
        ],
        "summary": "创建用户",
        "description": "POST /api/v1/system/users",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/system/users/{id}": {
      "delete": {
        "tags": [
          "System"
        ],
        "summary": "删除用户",
        "description": "DELETE /api/v1/system/users/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      },
      "put": {
        "tags": [
          "System"
        ],
        "summary": "更新用户",
        "description": "PUT /api/v1/system/users/{id}",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/taobao/shop/{id}/ad-reconciliation": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/taobao/shop/{id}/ad-reconciliation",
        "description": "GET /api/v1/taobao/shop/{id}/ad-reconciliation",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/taobao/shop/{id}/channels": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/taobao/shop/{id}/channels",
        "description": "GET /api/v1/taobao/shop/{id}/channels",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/taobao/shop/{id}/dsr": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/taobao/shop/{id}/dsr",
        "description": "GET /api/v1/taobao/shop/{id}/dsr",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/taobao/shop/{id}/metrics": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/taobao/shop/{id}/metrics",
        "description": "GET /api/v1/taobao/shop/{id}/metrics",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/taobao/shop/{id}/products": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/taobao/shop/{id}/products",
        "description": "GET /api/v1/taobao/shop/{id}/products",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/tmall/brands": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/tmall/brands",
        "description": "GET /api/v1/tmall/brands",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/tmall/promo-compare": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/tmall/promo-compare",
        "description": "GET /api/v1/tmall/promo-compare",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/tmall/promotion-layers": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/tmall/promotion-layers",
        "description": "GET /api/v1/tmall/promotion-layers",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/tmall/shop/{id}/overview": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/tmall/shop/{id}/overview",
        "description": "GET /api/v1/tmall/shop/{id}/overview",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/training/plans": {
      "get": {
        "tags": [
          "Training"
        ],
        "summary": "培训计划列表",
        "description": "GET /api/v1/training/plans",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/training/records": {
      "get": {
        "tags": [
          "Training"
        ],
        "summary": "培训记录列表",
        "description": "GET /api/v1/training/records",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/weather/cities": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/weather/cities",
        "description": "GET /api/v1/weather/cities",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/weather/recommendation": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/weather/recommendation",
        "description": "GET /api/v1/weather/recommendation",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/wechat/affiliate": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/wechat/affiliate",
        "description": "GET /api/v1/wechat/affiliate",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/wechat/content": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/wechat/content",
        "description": "GET /api/v1/wechat/content",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/wechat/private-public": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/wechat/private-public",
        "description": "GET /api/v1/wechat/private-public",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/wechat/settlement": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/wechat/settlement",
        "description": "GET /api/v1/wechat/settlement",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/wechat/shop/{id}/overview": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/wechat/shop/{id}/overview",
        "description": "GET /api/v1/wechat/shop/{id}/overview",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/xiaohongshu/aips": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/xiaohongshu/aips",
        "description": "GET /api/v1/xiaohongshu/aips",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/xiaohongshu/funnel": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/xiaohongshu/funnel",
        "description": "GET /api/v1/xiaohongshu/funnel",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/xiaohongshu/notes": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/xiaohongshu/notes",
        "description": "GET /api/v1/xiaohongshu/notes",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/xiaohongshu/on-offsite": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/xiaohongshu/on-offsite",
        "description": "GET /api/v1/xiaohongshu/on-offsite",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    },
    "/api/v1/xiaohongshu/search": {
      "get": {
        "tags": [
          "V1"
        ],
        "summary": "GET /api/v1/xiaohongshu/search",
        "description": "GET /api/v1/xiaohongshu/search",
        "responses": {
          "200": {
            "description": "请求成功",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "未登录或会话过期"
          },
          "403": {
            "description": "无权访问该资源"
          },
          "404": {
            "description": "资源不存在"
          },
          "500": {
            "description": "服务内部错误"
          }
        }
      }
    }
  }
} as const
