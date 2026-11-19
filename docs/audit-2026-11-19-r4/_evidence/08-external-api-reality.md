# 证据 08 · 外部 API 真实性与接入条件（官方来源核实）

> 采集时间：2026-11-19，来源为各平台/厂商官方文档（URL 见文末）
> 用途：判定系统「接不通」是能力问题还是外部合规必然

## 1. 七个 API 的接入条件

| API | 官方入口 | 资质要求 | 费用 | 可行性 | 主要坑 |
|---|---|---|---|---|---|
| 豆包（火山方舟） | https://www.volcengine.com/product/ark | 火山账号 + 实名；**个人已开放** | 按 token（约 6/30 元每百万输入/输出，随模型变） | **高（当天可通）** | 模型版本迭代快；内容安全自理；公众服务备案 |
| 通义千问（百炼） | https://help.aliyun.com/zh/model-studio | 阿里云账号 + 实名 | 按 token；新用户约 7000 万 tokens/90 天；ASR 0.00033 元/秒（≈1.19 元/小时） | **高（即时）** | 免费额度限地域/模型；限流 |
| 抖音开放平台 / 抖店 | https://developer.open-douyin.com ；https://op.jinritemai.com | 抖店自研需**软著 + 开发者/店铺/软著主体一致或强关联**，自研**只能自用**；服务市场需成立 1 年+、注册资金 ≥100 万、保证金 2 万、员工 20 人+ | API 免费；保证金 2 万 | **中**（自研易，多品牌难） | 自研不能服务无关联多品牌；token 默认 7 天；类目权限 |
| 巨量千川 API | https://open.oceanengine.com | **企业认证 + 资质 + CA 签章 + 合同**；**不支持个人**；一个主体只能认证一个开发者账户 | 接入免费；广告消耗另计 | **中（2–6 周）** | 权限点逐项申请；口径随产品变化；数据延迟 |
| 剪映 / CapCut | https://www.jianying.com ；https://www.capcut.com/openapi.yaml ；https://www.volcengine.com/product/CK | **剪映专业版无公开编辑/渲染 API**；CapCut OpenAPI 定位 ChatGPT Plugin，能力有限；模板化视频走火山 Kickart / 剪同款 | 按调用/商务报价 | **低–中**（模板可行，任意剪辑不可行） | 社区「剪映小助手」非官方、易碎；不要承诺「官方剪映 API」 |
| 数字人（火山/硅基/智影） | https://www.volcengine.com/product/avatar | 火山需商务开通；实时互动数字人 **1 并发 3 万元/月、30 万元/年** | 按路数/合成计费 | **中（2–6 周）** | 平台注册 + **强制标识**；纯 AI 驱动受限；口型/延迟 |
| ASR（阿里/腾讯/讯飞/火山） | https://help.aliyun.com/zh/model-studio/fun-asr-realtime ；https://cloud.tencent.com/document/product/1093/35686 | 实名即可 | 约 1.2–1.5 元/小时 | **技术可行** | **拿不到平台原始音频流**；方言/错字；1–3 秒延迟 |

## 2. 对系统的直接含义

1. **豆包 / 通义**：个人实名即可接入，改 env 就能通 → 「已支持多 Provider」是可信的，但当前 `deepseek-chat` 404 说明配置层没校验。
2. **千川**：需企业资质 + CA 签章 + 2–6 周，不是「写个 adapter」就能接。
3. **剪映**：官方没有通用剪辑 API。系统若宣称「剪映开放 API 打通」，**技术上不成立**；只能走火山 Kickart 模板或非官方草稿方案。
4. **数字人**：平台要求注册/审核 + 持续标识，且纯 AI 驱动在部分平台被限制；成本 3 万/月/并发量级。
5. **ASR 实时**：技术可行，但第三方拿不到平台直播音频流 → 「实时违禁词拦截」只能是现场采集或平台合作。
6. **多品牌代运营**：抖店自研应用只允许自用，服务无关联多品牌必须走服务市场（资金/人员门槛）→ 系统的「22 店铺、20 个 manual_only」不是纯粹工程问题。

## 3. 来源 URL

- 抖店自用型应用入驻：https://op.jinritemai.com/docs/guide-d/140/583
- 抖店服务市场入驻：https://op.jinritemai.com/docs/api-do/170/8421
- 巨量引擎开发者注册：https://open.oceanengine.com/labels/41/docs/1746489101948942
- 淘宝开放平台自研限制：https://developer.alibaba.com/docs/doc.htm?treeId=478&articleId=101564&docType=1
- 微信小店数据分析（权限集 175）：https://developers.weixin.qq.com/doc/store/shop/guide/operation/analytics
- 快手电商开放平台：https://open.kwaixiaodian.com/
- 小红书开放平台：https://open.xiaohongshu.com
- 拼多多开放平台：https://open.pinduoduo.com/application/document/browse?idStr=7F141C961965F748
- 火山方舟：https://www.volcengine.com/product/ark
- 阿里百炼 ASR：https://help.aliyun.com/zh/model-studio/fun-asr-realtime
- 火山 Kickart 剪同款：https://www.volcengine.com/docs/6664/105157
- 火山数字人计费：https://docs.volcengine.com/docs/video-live/ai-digital-human-billing
- 《直播电商监督管理办法》：https://www.gov.cn/gongbao/2026/issue_12666/202604/content_7065114.html
- 《AI 生成合成内容标识办法》：https://www.gov.cn/zhengce/zhengceku/202503/content_7014286.htm
