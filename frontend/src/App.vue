<template>
  <div class="app-root">
    <header class="top-bar">
      <h1>📊 分布式日志聚合与智能异常检测平台</h1>
      <div class="toolbar">
        <el-select v-model="store.logType" size="small" style="width:140px">
          <el-option v-for="t in ['nginx','apache','json_app','custom']" :key="t" :label="t" :value="t"/>
        </el-select>
        <el-input v-model="store.searchQuery" placeholder="搜索关键词..." size="small" style="width:200px" clearable/>
        <el-button size="small" @click="store.generate()" :loading="store.running==='generate'" :disabled="store.running!==null">🔍 生成日志</el-button>
        <el-button size="small" type="warning" @click="store.detect()" :loading="store.running==='detect'" :disabled="!store.result||store.running!==null">⚠ 检测异常</el-button>
      </div>
    </header>
    <div class="flow-bar">
      <div class="flow-steps">
        <div class="fstep" :class="stepClass('generate')"><span class="fdot">1</span><span>生成日志</span></div>
        <div class="fline" :class="{done:store.stage!=='idle'}"></div>
        <div class="fstep" :class="stepClass('detect')"><span class="fdot">2</span><span>检测异常</span></div>
      </div>
      <div class="flow-meta">
        <el-tag size="small" effect="dark" type="info">类型：{{ store.logType }}</el-tag>
        <el-tag size="small" effect="dark" :type="stageTagType">阶段：{{ store.stageText }}</el-tag>
        <el-tag v-if="store.generatedCount" size="small" effect="dark" type="success">已生成：{{ store.generatedCount }} 条</el-tag>
        <template v-if="store.stage==='detected'">
          <el-tag size="small" effect="dark" type="danger">异常窗口：{{ store.anomalyWindows }}</el-tag>
          <el-tag size="small" effect="dark" type="danger">异常条目：{{ store.anomalyEntries }}</el-tag>
        </template>
      </div>
      <div v-if="store.failure" class="flow-error">
        <span>⚠ {{ store.failure.task==='generate'?'生成':'检测' }}失败：{{ store.failure.message }}</span>
        <el-button size="small" type="danger" plain @click="store.retry()">重试</el-button>
      </div>
    </div>
    <div class="main-grid">
      <div class="grid-col">
        <LogTable />
      </div>
      <div class="grid-col">
        <AnomalyChart />
        <AlertPanel />
      </div>
    </div>
    <div class="bottom-row">
      <TrendChart />
      <HeatmapChart />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LogTable from './components/LogTable.vue'
import AnomalyChart from './components/AnomalyChart.vue'
import AlertPanel from './components/AlertPanel.vue'
import TrendChart from './components/TrendChart.vue'
import HeatmapChart from './components/HeatmapChart.vue'
import { useLogStore } from './store/log'
const store = useLogStore()

function stepClass(task: 'generate' | 'detect') {
  if (store.failure?.task === task) return 'error'
  if (store.running === task) return 'active'
  if (task === 'generate') return store.stage !== 'idle' ? 'done' : 'wait'
  return store.stage === 'detected' ? 'done' : 'wait'
}

const stageTagType = computed<'primary'|'success'|'info'|'warning'|'danger'>(() => {
  if (store.failure) return 'danger'
  if (store.running) return 'warning'
  if (store.stage === 'detected') return 'success'
  if (store.stage === 'generated') return 'primary'
  return 'info'
})
</script>

<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,monospace;background:#0f172a;color:#e2e8f0}
.app-root{min-height:100vh}
.top-bar{display:flex;justify-content:space-between;align-items:center;padding:10px 20px;background:#1e293b;border-bottom:1px solid #334155}
.top-bar h1{font-size:1.1rem;color:#38bdf8}
.toolbar{display:flex;gap:8px;align-items:center}
.flow-bar{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:8px 20px;background:#16213a;border-bottom:1px solid #334155}
.flow-steps{display:flex;align-items:center;gap:6px}
.fstep{display:flex;align-items:center;gap:6px;font-size:12px;color:#64748b}
.fdot{width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;background:#334155;color:#94a3b8}
.fstep.done{color:#4ade80}
.fstep.done .fdot{background:#166534;color:#bbf7d0;font-size:0}
.fstep.done .fdot::after{content:'✓';font-size:11px}
.fstep.active{color:#38bdf8}
.fstep.active .fdot{background:#075985;color:#e0f2fe}
.fstep.error{color:#f87171}
.fstep.error .fdot{background:#7f1d1d;color:#fecaca}
.fline{width:32px;height:2px;background:#334155;border-radius:1px}
.fline.done{background:#166534}
.flow-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.flow-error{display:flex;gap:8px;align-items:center;font-size:12px;color:#fca5a5}
.main-grid{display:grid;grid-template-columns:1fr 400px;gap:12px;padding:12px 20px;min-height:50vh}
.grid-col{overflow:hidden}
.bottom-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 20px 16px}
</style>
