import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import type { AnalysisResult, AlertRule } from '@/types'

export type Stage = 'idle' | 'generated' | 'detected'
export type TaskAction = 'generate' | 'detect'
export interface TaskError { action: TaskAction; message: string }

const STORAGE_KEY = 'log-platform-flow'

function loadPersisted(): { logType: string; stage: Stage; result: AnalysisResult | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) throw new Error('empty')
    const s = JSON.parse(raw)
    if (!s || !s.result) throw new Error('no result')
    return {
      logType: typeof s.logType === 'string' ? s.logType : 'nginx',
      stage: s.stage === 'detected' || s.stage === 'generated' ? s.stage : 'idle',
      result: s.result as AnalysisResult
    }
  } catch {
    return { logType: 'nginx', stage: 'idle', result: null }
  }
}

function errMessage(e: unknown, fallback: string): string {
  const anyErr = e as any
  return anyErr?.response?.data?.detail || anyErr?.message || fallback
}

export const useLogStore = defineStore('log', () => {
  const persisted = loadPersisted()
  const result = ref<AnalysisResult | null>(persisted.result)
  const searchQuery = ref('')
  const logType = ref(persisted.logType)
  const stage = ref<Stage>(persisted.stage)
  const error = ref<TaskError | null>(null)
  // 同一时刻只允许一个任务在跑：generate / detect / null
  const pending = ref<TaskAction | null>(null)
  const rules = ref<AlertRule[]>([
    { id:1, name:'高频ERROR', type:'level', threshold:5, enabled:true },
    { id:2, name:'异常流量', type:'count', threshold:200, enabled:false },
    { id:3, name:'关键词命中', type:'keyword', threshold:0, enabled:true }
  ])

  const loading = computed(() => pending.value !== null)
  const anomalyWindows = computed(() => result.value ? result.value.anomalies.filter(a => a.isAnomaly) : [])
  const anomalyWindowCount = computed(() => anomalyWindows.value.length)
  const anomalyEntryCount = computed(() =>
    anomalyWindows.value.reduce((sum, a) => sum + (result.value?.windows[a.windowIndex]?.count ?? 0), 0)
  )
  const stageLabel = computed(() =>
    stage.value === 'detected' ? '已检测' : stage.value === 'generated' ? '已生成 · 未检测' : '未生成'
  )

  // 刷新后仍停在同一类型与阶段
  watch([logType, stage, result], () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        logType: logType.value, stage: stage.value, result: result.value
      }))
    } catch { /* 存储超限等情况忽略 */ }
  })

  // 切换类型：旧结果失效，状态回到未检测
  watch(logType, () => {
    result.value = null
    stage.value = 'idle'
    error.value = null
  })

  async function generate() {
    if (pending.value) return // 连续点击不叠加
    pending.value = 'generate'
    error.value = null
    if (stage.value === 'detected') stage.value = 'generated' // 重新生成，回到未检测
    try {
      const { data } = await axios.post('/api/generate', { type: logType.value, count: 1000 })
      result.value = data
      stage.value = 'generated'
    } catch (e) {
      error.value = { action: 'generate', message: errMessage(e, '日志生成请求失败') }
      if (!result.value) stage.value = 'idle'
    } finally {
      pending.value = null
    }
  }

  async function detect() {
    if (!result.value || pending.value) return
    pending.value = 'detect'
    error.value = null
    try {
      const { data } = await axios.post('/api/detect', {
        logs: result.value.logs,
        rules: rules.value.filter(r => r.enabled),
        query: searchQuery.value
      })
      result.value = data
      stage.value = 'detected'
    } catch (e) {
      error.value = { action: 'detect', message: errMessage(e, '异常检测请求失败') }
      stage.value = 'generated'
    } finally {
      pending.value = null
    }
  }

  async function retry() {
    const action = error.value?.action
    if (!action || pending.value) return
    if (action === 'generate') await generate()
    else await detect()
  }

  return {
    result, loading, searchQuery, logType, rules, generate, detect,
    stage, stageLabel, pending, error, retry,
    anomalyWindowCount, anomalyEntryCount
  }
})
