<template>
  <div class="app-root">
    <header class="top-bar">
      <h1>📊 分布式日志聚合与智能异常检测平台</h1>
      <div class="toolbar">
        <el-select v-model="store.logType" size="small" style="width:140px" :disabled="!!store.pending">
          <el-option v-for="t in ['nginx','apache','json_app','custom']" :key="t" :label="t" :value="t"/>
        </el-select>
        <el-input v-model="store.searchQuery" placeholder="搜索关键词..." size="small" style="width:200px" clearable/>
        <el-button size="small" @click="store.generate()" :loading="store.pending==='generate'" :disabled="!!store.pending">🔍 生成日志</el-button>
        <el-button size="small" type="warning" @click="store.detect()" :loading="store.pending==='detect'" :disabled="!store.result || !!store.pending">⚠ 检测异常</el-button>
      </div>
    </header>
    <div class="flow-bar">
      <div class="flow-steps">
        <span class="step" :class="{done: store.stage!=='idle', current: store.stage==='generated'}">1 生成日志</span>
        <span class="step-arrow">→</span>
        <span class="step" :class="{done: store.stage==='detected', current: store.stage==='detected'}">2 检测异常</span>
      </div>
      <div class="flow-meta">
        <el-tag size="small" effect="dark" type="info">类型: {{ store.logType }}</el-tag>
        <el-tag v-if="store.result" size="small" effect="dark">已生成 {{ store.result.totalLogs }} 条</el-tag>
        <el-tag size="small" effect="dark" :type="store.stage==='detected' ? 'success' : store.stage==='generated' ? 'warning' : 'info'">阶段: {{ store.stageLabel }}</el-tag>
        <template v-if="store.stage==='detected'">
          <el-tag size="small" effect="dark" type="danger">异常窗口 {{ store.anomalyWindowCount }} 个</el-tag>
          <el-tag size="small" effect="dark" type="danger">异常条目 {{ store.anomalyEntryCount }} 条</el-tag>
        </template>
        <template v-if="store.error">
          <el-tag size="small" effect="dark" type="danger" class="err-tag">
            ⚠ {{ store.error.action==='generate' ? '生成' : '检测' }}失败: {{ store.error.message }}
          </el-tag>
          <el-button size="small" type="danger" plain @click="store.retry()">重试</el-button>
        </template>
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
import LogTable from './components/LogTable.vue'
import AnomalyChart from './components/AnomalyChart.vue'
import AlertPanel from './components/AlertPanel.vue'
import TrendChart from './components/TrendChart.vue'
import HeatmapChart from './components/HeatmapChart.vue'
import { useLogStore } from './store/log'
const store = useLogStore()
</script>

<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,monospace;background:#0f172a;color:#e2e8f0}
.app-root{min-height:100vh}
.top-bar{display:flex;justify-content:space-between;align-items:center;padding:10px 20px;background:#1e293b;border-bottom:1px solid #334155}
.top-bar h1{font-size:1.1rem;color:#38bdf8}
.toolbar{display:flex;gap:8px;align-items:center}
.flow-bar{display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding:8px 20px;background:#16213a;border-bottom:1px solid #334155}
.flow-steps{display:flex;gap:6px;align-items:center;font-size:12px}
.step{padding:2px 10px;border-radius:10px;border:1px solid #475569;color:#94a3b8}
.step.done{border-color:#38bdf8;color:#38bdf8}
.step.current{background:#38bdf8;color:#0f172a;font-weight:600}
.step-arrow{color:#475569}
.flow-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.err-tag{max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.main-grid{display:grid;grid-template-columns:1fr 400px;gap:12px;padding:12px 20px;min-height:50vh}
.grid-col{overflow:hidden}
.bottom-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 20px 16px}
</style>
