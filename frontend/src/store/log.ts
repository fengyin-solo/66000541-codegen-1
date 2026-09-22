import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import type { AnalysisResult, AlertRule } from '@/types'

type Stage = 'idle' | 'generated' | 'detected'
type TaskKind = 'generate' | 'detect'

const STORAGE_KEY = 'log-flow-state'

export const useLogStore = defineStore('log', () => {
  const result = ref<AnalysisResult | null>(null)
  const searchQuery = ref('')
  const logType = ref('nginx')
  // 流程阶段：idle=未生成，generated=已生成未检测，detected=已检测
  const stage = ref<Stage>('idle')
  // 当前正在执行的任务，同一时刻只允许一个
  const running = ref<TaskKind | null>(null)
  const failure = ref<{ task: TaskKind; message: string } | null>(null)
  const generatedCount = ref(0)
  const anomalyWindows = ref(0)
  const anomalyEntries = ref(0)
  let taskSeq = 0
  const rules = ref<AlertRule[]>([
    { id:1, name:'高频ERROR', type:'level', threshold:5, enabled:true },
    { id:2, name:'异常流量', type:'count', threshold:200, enabled:false },
    { id:3, name:'关键词命中', type:'keyword', threshold:0, enabled:true }
  ])

  // 恢复上次会话的类型、阶段与统计（须在 watch 注册之前，避免被当成切换）
  restore()

  // 切换日志类型：作废进行中的任务并清空旧数据，回到未生成
  watch(logType, () => {
    taskSeq++
    running.value = null
    failure.value = null
    result.value = null
    stage.value = 'idle'
    generatedCount.value = 0
    anomalyWindows.value = 0
    anomalyEntries.value = 0
  })

  // 关键状态变化时持久化，刷新后停在同一类型与阶段
  watch([logType, stage, generatedCount, anomalyWindows, anomalyEntries, result], persist)

  const stageText = computed(() => {
    if (running.value === 'generate') return '生成中…'
    if (running.value === 'detect') return '检测中…'
    if (failure.value) return (failure.value.task === 'generate' ? '生成' : '检测') + '失败'
    if (stage.value === 'detected') return '已检测'
    if (stage.value === 'generated') return '已生成 · 未检测'
    return '未生成'
  })

  async function generate() {
    if (running.value) return
    running.value = 'generate'
    failure.value = null
    const ticket = ++taskSeq
    try {
      const { data } = await axios.post<AnalysisResult>('/api/generate', { type: logType.value, count: 1000 })
      if (ticket !== taskSeq) return // 过期结果直接丢弃，避免叠加
      result.value = data
      generatedCount.value = data.totalLogs
      anomalyWindows.value = 0
      anomalyEntries.value = 0
      stage.value = 'generated' // 重新生成后回到未检测
    } catch (e) {
      if (ticket !== taskSeq) return
      failure.value = { task: 'generate', message: errMessage(e) }
    } finally {
      if (ticket === taskSeq) running.value = null
    }
  }

  async function detect() {
    if (!result.value || running.value) return
    running.value = 'detect'
    failure.value = null
    const ticket = ++taskSeq
    try {
      const { data } = await axios.post<AnalysisResult>('/api/detect', {
        logs: result.value.logs,
        rules: rules.value.filter(r => r.enabled),
        query: searchQuery.value
      })
      if (ticket !== taskSeq) return
      result.value = data
      const anoms = data.anomalies.filter(a => a.isAnomaly)
      anomalyWindows.value = anoms.length
      anomalyEntries.value = anoms.reduce((sum, a) => sum + (data.windows[a.windowIndex]?.count || 0), 0)
      stage.value = 'detected'
    } catch (e) {
      if (ticket !== taskSeq) return
      failure.value = { task: 'detect', message: errMessage(e) }
    } finally {
      if (ticket === taskSeq) running.value = null
    }
  }

  function retry() {
    const task = failure.value?.task
    if (!task || running.value) return
    failure.value = null
    if (task === 'generate') return generate()
    return detect()
  }

  function errMessage(e: unknown): string {
    const err = e as any
    const detail = err?.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return detail.map((d: any) => d?.msg || JSON.stringify(d)).join('；')
    if (err?.code === 'ERR_NETWORK') return '无法连接后端服务'
    return err?.message || '未知错误'
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        logType: logType.value,
        stage: stage.value,
        generatedCount: generatedCount.value,
        anomalyWindows: anomalyWindows.value,
        anomalyEntries: anomalyEntries.value,
        result: result.value
      }))
    } catch { /* 存储不可用或超限时忽略 */ }
  }

  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const s = JSON.parse(raw)
      if (typeof s?.logType === 'string') logType.value = s.logType
      if (s?.stage === 'idle' || s?.stage === 'generated' || s?.stage === 'detected') stage.value = s.stage
      if (typeof s?.generatedCount === 'number') generatedCount.value = s.generatedCount
      if (typeof s?.anomalyWindows === 'number') anomalyWindows.value = s.anomalyWindows
      if (typeof s?.anomalyEntries === 'number') anomalyEntries.value = s.anomalyEntries
      if (s?.result && Array.isArray(s.result.logs)) result.value = s.result
    } catch { /* 缓存损坏时忽略 */ }
  }

  return { result, searchQuery, logType, rules, stage, stageText, running, failure, generatedCount, anomalyWindows, anomalyEntries, generate, detect, retry }
})
