/**
 * test/media-pipeline.test.ts — W11 媒体流水线单测
 *
 * 覆盖：SRT/时间轴解析、高光评分与去重、切片 SRT 生成、剪映草稿结构、文件名安全。
 * ffmpeg 真实渲染由 curl 实测覆盖（依赖系统二进制）。
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseLooseTimeline,
  parseManualTranscript,
  parseSrt,
  parseSrtTimestamp,
  assertAsrEndpointAllowed,
} from '../src/media/asr.js'
import {
  buildWindows,
  computeHighlights,
  dedupeHighlights,
  defaultTitle,
  densityScore,
  keywordScore,
  lengthScore,
  positionScore,
  scoreWindows,
} from '../src/media/highlights.js'
import { buildClipSrt, safeFileName, toSrtTime, assertAllowedExtension } from '../src/media/service.js'
import { buildDraftContent, safeDraftName } from '../src/media/jianying.js'

describe('W11 媒体：SRT 与时间轴解析', () => {
  test('SRT 时间戳解析为毫秒', () => {
    assert.equal(parseSrtTimestamp('00:00:01,200'), 1200)
    assert.equal(parseSrtTimestamp('01:02:03,004'), 3_723_004)
    assert.ok(Number.isNaN(parseSrtTimestamp('bad')))
  })

  test('标准 SRT 解析出片段与时间轴', () => {
    const srt = [
      '1',
      '00:00:00,000 --> 00:00:03,500',
      '欢迎来到直播间',
      '',
      '2',
      '00:00:03,500 --> 00:00:08,000',
      '今天推荐这款风衣',
    ].join('\n')
    const segments = parseSrt(srt)
    assert.equal(segments.length, 2)
    assert.equal(segments[0].startMs, 0)
    assert.equal(segments[0].endMs, 3500)
    assert.equal(segments[1].text, '今天推荐这款风衣')
  })

  test('SRT 容忍 BOM 与 CRLF', () => {
    const srt = '\uFEFF1\r\n00:00:01,000 --> 00:00:02,000\r\n内容\r\n'
    const segments = parseSrt(srt)
    assert.equal(segments.length, 1)
    assert.equal(segments[0].startMs, 1000)
  })

  test('非法时间区间被丢弃', () => {
    const srt = ['1', '00:00:05,000 --> 00:00:02,000', '倒序区间'].join('\n')
    assert.equal(parseSrt(srt).length, 0)
  })

  test('[mm:ss] 时间轴解析并修正重叠', () => {
    const content = ['[00:00] 开场', '[00:02] 卖点', '[00:05] 逼单'].join('\n')
    const segments = parseLooseTimeline(content)
    assert.equal(segments.length, 3)
    assert.equal(segments[0].startMs, 0)
    assert.equal(segments[1].startMs, 2000)
    // 首段结束时间被修正为下一段起点
    assert.equal(segments[0].endMs, 2000)
  })

  test('自动识别 SRT 与时间轴两种格式', () => {
    assert.equal(parseManualTranscript('1\n00:00:00,000 --> 00:00:01,000\nA').length, 1)
    assert.equal(parseManualTranscript('[00:00] A').length, 1)
    assert.equal(parseManualTranscript('无时间轴纯文本').length, 0)
  })

  test('ASR 内网地址默认拒绝，元数据永久拒绝', () => {
    const original = process.env.MEDIA_ALLOW_PRIVATE_ASR
    try {
      delete process.env.MEDIA_ALLOW_PRIVATE_ASR
      assert.match(String(assertAsrEndpointAllowed('http://127.0.0.1:9000/v1')), /内网/)
      assert.match(String(assertAsrEndpointAllowed('http://169.254.169.254/v1')), /元数据|链路本地/)
      assert.equal(assertAsrEndpointAllowed('https://api.openai.com/v1'), null)
    } finally {
      if (original === undefined) delete process.env.MEDIA_ALLOW_PRIVATE_ASR
      else process.env.MEDIA_ALLOW_PRIVATE_ASR = original
    }
  })
})

describe('W11 媒体：高光评分', () => {
  test('关键词得分随命中数上升并封顶', () => {
    assert.equal(keywordScore('普通描述'), 0)
    assert.ok(keywordScore('限时优惠，到手价 199，包邮') > 0)
    assert.equal(keywordScore('价格 优惠 福利 限时 到手价 券 链接 下单 尺码 面料'), 40)
  })

  test('密度得分在 3-6 字/秒最高', () => {
    const ideal = densityScore('一二三四五', 1000) // 5 字/秒
    const tooSlow = densityScore('一', 1000)
    const tooFast = densityScore('一'.repeat(20), 1000)
    assert.ok(ideal > tooSlow)
    assert.ok(ideal > tooFast)
  })

  test('时长得分在 35s 附近最高，超界为 0', () => {
    assert.ok(lengthScore(35_000) > lengthScore(15_000))
    assert.equal(lengthScore(5_000), 0)
    assert.equal(lengthScore(120_000), 0)
  })

  test('位置得分开场与结尾更高', () => {
    assert.equal(positionScore(0, 100_000), 15)
    assert.equal(positionScore(95_000, 100_000), 15)
    assert.equal(positionScore(50_000, 100_000), 5)
  })

  test('滑动窗口覆盖全时段且不越界', () => {
    const segments = Array.from({ length: 20 }, (_, i) => ({
      text: `片段${i}`,
      startMs: i * 5000,
      endMs: (i + 1) * 5000,
    }))
    const windows = buildWindows(segments, { windowMs: 40_000, stepMs: 20_000 })
    assert.ok(windows.length > 0)
    for (const win of windows) {
      assert.ok(win.endMs <= 100_000)
      assert.ok(win.endMs - win.startMs >= 12_000)
    }
  })

  test('空转写返回空候选', () => {
    assert.deepEqual(computeHighlights([]), [])
  })

  test('去重后不保留高度重叠窗口', () => {
    const candidates = scoreWindows(
      [
        { startMs: 0, endMs: 40_000, text: '限时优惠 到手价 包邮 尺码 面料' },
        { startMs: 5_000, endMs: 45_000, text: '限时优惠 到手价 包邮 尺码 面料' },
        { startMs: 60_000, endMs: 100_000, text: '库存最后 秒杀 赠品' },
      ],
      100_000
    )
    const picked = dedupeHighlights(candidates, { maxCount: 5 })
    assert.equal(picked.length, 2)
    // 保留高分且按时间排序
    assert.ok(picked[0].startMs < picked[1].startMs)
  })

  test('maxCount 限制生效', () => {
    const candidates = scoreWindows(
      Array.from({ length: 10 }, (_, i) => ({
        startMs: i * 50_000,
        endMs: i * 50_000 + 40_000,
        text: '限时优惠 到手价',
      })),
      500_000
    )
    assert.equal(dedupeHighlights(candidates, { maxCount: 3 }).length, 3)
  })

  test('默认标题优先取含信号词的短句', () => {
    const title = defaultTitle('今天天气不错。限时优惠到手价 199 元。欢迎下单。')
    assert.ok(title.includes('限时优惠'))
  })

  test('超长标题被截断', () => {
    const title = defaultTitle('限时优惠'.repeat(20), 10)
    assert.ok(title.length <= 11)
    assert.ok(title.endsWith('…'))
  })
})

describe('W11 媒体：切片字幕与文件安全', () => {
  test('SRT 时间格式补零', () => {
    assert.equal(toSrtTime(0), '00:00:00,000')
    assert.equal(toSrtTime(3_723_004), '01:02:03,004')
  })

  test('切片 SRT 时间相对切片起点', () => {
    const segments = [
      { text: '前一段', startMs: 0, endMs: 5_000 },
      { text: '切片内', startMs: 10_000, endMs: 15_000 },
      { text: '跨边界', startMs: 18_000, endMs: 25_000 },
    ]
    const srt = buildClipSrt(segments, 10_000, 20_000)
    assert.ok(srt.includes('00:00:00,000 --> 00:00:05,000'))
    assert.ok(srt.includes('切片内'))
    // 跨边界片段被裁剪到 20s
    assert.ok(srt.includes('00:00:08,000 --> 00:00:10,000'))
    assert.ok(!srt.includes('前一段'))
  })

  test('无交集时返回空 SRT', () => {
    assert.equal(buildClipSrt([{ text: 'A', startMs: 0, endMs: 1000 }], 5000, 9000).trim(), '')
  })

  test('文件名净化防止路径穿越', () => {
    const name = safeFileName('../../etc/passwd.mp4')
    assert.ok(!name.includes('..'))
    assert.ok(!name.includes('/'))
    assert.ok(name.endsWith('.mp4'))
  })

  test('扩展名白名单', () => {
    assert.doesNotThrow(() => assertAllowedExtension('a.mp4'))
    assert.doesNotThrow(() => assertAllowedExtension('a.MOV'))
    assert.throws(() => assertAllowedExtension('a.exe'), /不支持的文件类型/)
    assert.throws(() => assertAllowedExtension('noext'), /不支持的文件类型/)
  })
})

describe('W11 媒体：剪映草稿', () => {
  test('草稿结构包含画布、轨道与素材', () => {
    const content = buildDraftContent({
      outputDir: '/tmp/drafts',
      title: '测试场次',
      clips: [
        { videoPath: '/tmp/a.mp4', durationMs: 30_000 },
        { videoPath: '/tmp/b.mp4', durationMs: 20_000 },
      ],
    }) as any

    assert.equal(content.canvas_config.width, 1080)
    assert.equal(content.canvas_config.height, 1920)
    assert.equal(content.materials.videos.length, 2)
    assert.equal(content.tracks.length, 3)
    const videoTrack = content.tracks.find((t: any) => t.type === 'video')
    assert.equal(videoTrack.segments.length, 2)
    // 片段首尾相接
    assert.equal(videoTrack.segments[0].target_timerange.start, 0)
    assert.equal(videoTrack.segments[1].target_timerange.start, 30_000_000)
    assert.equal(content.duration, 50_000_000)
  })

  test('草稿名净化非法字符', () => {
    assert.equal(safeDraftName('a/b:c*d?'), 'a_b_c_d_')
    assert.equal(safeDraftName(''), 'draft')
  })
})