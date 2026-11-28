/**
 * video-render-plan.test.ts — 渲染计划器与质检跳过规则（纯函数）
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTemplateDsl, runQualityGate, type TemplateDsl } from '../src/video/assembly.js'
import {
  aspectSize,
  buildRenderGraph,
  buildRenderShots,
  buildSrt,
  buildSubtitleSegments,
  collectSlotAssets,
  type RenderShot,
  type ShotRow,
} from '../src/video/renderer.js'

const dsl: TemplateDsl = parseTemplateDsl({
  template: 'plan_test',
  type: 'assembly',
  aspect: '9:16',
  duration: { min: 3, max: 6 },
  slots: [
    { key: 'hook', type: 'text', required: true },
    { key: 'product_images', type: 'image_list', required: true, countMin: 1, countMax: 3 },
    { key: 'material_clips', type: 'video_list' },
    { key: 'cta', type: 'text', required: true },
  ],
  audio: { loudness: -14, bgm: '' },
  subtitles: { safe_area: true },
  rules: { brand_logo: 'off', ai_label: 'off' },
})

describe('视频渲染计划器', () => {
  test('槽位素材按类型收集，图片与视频分流', () => {
    const assets = collectSlotAssets(dsl, {
      product_images: ['/tmp/a.png', '/tmp/b.jpg'],
      material_clips: ['/tmp/c.mp4'],
    })
    assert.deepEqual(assets.images, ['/tmp/a.png', '/tmp/b.jpg'])
    assert.deepEqual(assets.videos, ['/tmp/c.mp4'])
  })

  test('镜头分配素材：图片优先，缺失时回退纯色卡', () => {
    const rows: ShotRow[] = [
      { seq: 0, shot_type: 'hook', title: '开场', script_text: '开场', subtitle_text: '开场', duration_ms: 1000 },
      { seq: 1, shot_type: 'scene', title: '卖点', script_text: '卖点', subtitle_text: '卖点', duration_ms: 1000 },
    ]
    const withImages = buildRenderShots({ shots: rows, images: ['/tmp/a.png'], videos: [] })
    assert.equal(withImages[0].assetKind, 'image')
    assert.equal(withImages[1].assetPath, '/tmp/a.png')

    const none = buildRenderShots({ shots: rows, images: [], videos: [] })
    assert.equal(none[0].assetKind, null)
    assert.equal(none[0].assetPath, '')
  })

  test('字幕按安全区切块，时间轴有序且不越界', () => {
    const shots: RenderShot[] = [
      {
        seq: 0,
        shotType: 'hook',
        text: '这是一段明显超过二十个字符的开场钩子文案用于验证自动切块',
        subtitleText: '这是一段明显超过二十个字符的开场钩子文案用于验证自动切块',
        durationMs: 4000,
        assetPath: '',
        assetKind: null,
      },
    ]
    const segments = buildSubtitleSegments(shots, 20)
    assert.ok(segments.length >= 2)
    assert.ok(segments.every((seg) => seg.text.length <= 20))
    assert.ok(segments.every((seg) => seg.endMs > seg.startMs))
    assert.ok(segments.every((seg, i) => i === 0 || seg.startMs >= segments[i - 1].startMs))
    assert.equal(segments[segments.length - 1].endMs, 4000)

    const srt = buildSrt(segments)
    assert.match(srt, /^1\n00:00:00,000 --> /)
    assert.match(srt, /\n\n2\n/)
  })

  test('画幅尺寸：9:16 / 16:9 / 1:1 短边 1080 且为偶数', () => {
    assert.deepEqual(aspectSize('9:16'), { width: 1080, height: 1920 })
    assert.deepEqual(aspectSize('16:9'), { width: 1920, height: 1080 })
    assert.deepEqual(aspectSize('1:1'), { width: 1080, height: 1080 })
  })

  test('无音频无 Logo 时生成 anullsrc，且不生成 overlay/loudnorm', () => {
    const shots = buildRenderShots({
      shots: [{ seq: 0, shot_type: 'scene', title: '镜头', script_text: '镜头', subtitle_text: '镜头', duration_ms: 2000 }],
      images: [],
      videos: [],
    })
    const graph = buildRenderGraph({
      shots,
      width: 1080,
      height: 1920,
      outputPath: '/tmp/out.mp4',
      subtitlePath: '/tmp/out.srt',
      subtitleSegments: [{ startMs: 0, endMs: 2000, text: '镜头' }],
    })
    const joined = graph.args.join(' ')
    assert.equal(graph.hasAudio, false)
    assert.equal(graph.hasLogo, false)
    assert.match(joined, /anullsrc=r=48000:cl=stereo/)
    assert.match(joined, /concat=n=1:v=1:a=0/)
    assert.match(joined, /subtitles=/)
    assert.doesNotMatch(joined, /loudnorm=/)
    assert.doesNotMatch(joined, /overlay=/)
  })

  test('有 BGM/Logo/AI 标识时生成对应滤镜链', () => {
    const shots = buildRenderShots({
      shots: [{ seq: 0, shot_type: 'scene', title: '镜头', script_text: '镜头', subtitle_text: '镜头', duration_ms: 2000 }],
      images: [],
      videos: [],
    })
    const graph = buildRenderGraph({
      shots,
      width: 1080,
      height: 1920,
      outputPath: '/tmp/out.mp4',
      subtitlePath: '/tmp/out.srt',
      subtitleSegments: [{ startMs: 0, endMs: 2000, text: '镜头' }],
      bgmPath: '/tmp/bgm.mp3',
      logoPath: '/tmp/logo.png',
      aiLabelText: 'AI 生成内容',
      fontPath: '/tmp/font.ttc',
      loudness: -14,
    })
    const joined = graph.args.join(' ')
    assert.equal(graph.hasAudio, true)
    assert.equal(graph.hasLogo, true)
    assert.equal(graph.hasAiLabel, true)
    assert.match(joined, /loudnorm=I=-14:TP=-1.5:LRA=11/)
    assert.match(joined, /overlay=W-w-32:H-h-32/)
    assert.match(joined, /drawtext=fontfile=.*AI 生成内容/)
  })

  test('未配置音频/Logo 时质检跳过对应硬性项', () => {
    const gate = runQualityGate({
      dsl,
      durationMs: 4000,
      width: 1080,
      height: 1920,
      loudness: null,
      subtitleSegments: [{ startMs: 0, endMs: 4000, text: '短字幕' }],
      audioExpected: false,
      logoExpected: false,
    })
    assert.equal(gate.passed, true)
    const loudness = gate.checks.find((check) => check.key === 'loudness')
    assert.match(loudness?.detail || '', /未配置音频/)
    const silence = gate.checks.find((check) => check.key === 'silence')
    assert.match(silence?.detail || '', /未配置音频/)
  })
})
