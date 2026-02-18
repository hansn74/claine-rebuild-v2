/**
 * Benchmark UI Entry Point
 *
 * Wires up the benchmark.html page: model list, provider selector,
 * progress log, and results table rendering.
 */

import {
  runBenchmark,
  type ModelBenchmarkResult,
  type EmailBenchmarkResult,
} from './benchmarkRunner'

// DOM elements
const modelListEl = document.getElementById('modelList') as HTMLTextAreaElement
const providerEl = document.getElementById('provider') as HTMLSelectElement
const dtypeEl = document.getElementById('dtype') as HTMLSelectElement
const runBtn = document.getElementById('runBtn') as HTMLButtonElement
const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement
const progressEl = document.getElementById('progress') as HTMLDivElement
const resultsEl = document.getElementById('results') as HTMLDivElement

let abortController: AbortController | null = null
const completedResults: ModelBenchmarkResult[] = []

// Progress logging
function log(msg: string, type: 'info' | 'success' | 'error' = 'info') {
  progressEl.style.display = 'block'
  const line = document.createElement('div')
  line.className = `line ${type}`
  line.textContent = msg
  progressEl.appendChild(line)
  progressEl.scrollTop = progressEl.scrollHeight
}

// Results table rendering
function renderResults() {
  if (completedResults.length === 0) {
    resultsEl.innerHTML = ''
    return
  }

  const metrics = [
    { label: 'Load time', key: 'loadTime' },
    { label: 'Avg inference', key: 'avgInference' },
    { label: 'Accuracy', key: 'accuracy' },
    { label: 'Avg score diff', key: 'scoreDiff' },
    { label: 'Parse failures', key: 'parseFailures' },
  ]

  let html = '<table><thead><tr><th></th>'
  for (const r of completedResults) {
    const shortName = r.modelId.split('/').pop() || r.modelId
    html += `<th>${shortName}</th>`
  }
  html += '</tr></thead><tbody>'

  for (const m of metrics) {
    html += `<tr><td class="metric-label">${m.label}</td>`
    for (const r of completedResults) {
      html += '<td>'
      if (r.loadFailed) {
        if (m.key === 'loadTime') {
          html += `<span class="accuracy-low" title="${escapeHtml(r.loadError || 'Unknown error')}">FAILED TO LOAD</span>`
        } else {
          html += '<span style="color:#64748b">—</span>'
        }
      } else {
        switch (m.key) {
          case 'loadTime':
            html += `${(r.loadTimeMs / 1000).toFixed(1)}s`
            if (r.effectiveDtype)
              html += ` <span style="color:#64748b;font-size:0.6875rem">(${r.effectiveDtype})</span>`
            break
          case 'avgInference':
            html += `${(r.avgInferenceMs / 1000).toFixed(1)}s`
            break
          case 'accuracy': {
            const cls =
              r.accuracy >= 70
                ? 'accuracy-high'
                : r.accuracy >= 40
                  ? 'accuracy-medium'
                  : 'accuracy-low'
            html += `<span class="${cls}">${r.accuracy.toFixed(0)}%</span>`
            break
          }
          case 'scoreDiff':
            html += `±${r.scoreAccuracy.toFixed(1)}`
            break
          case 'parseFailures':
            html += `${r.parseFailures}`
            break
        }
      }
      html += '</td>'
    }
    html += '</tr>'
  }

  // Per-email detail toggle row
  html += '<tr><td class="metric-label">Per-email detail</td>'
  for (let i = 0; i < completedResults.length; i++) {
    if (completedResults[i].loadFailed) {
      html += '<td><span style="color:#64748b">—</span></td>'
    } else {
      html += `<td><span class="detail-toggle" data-model="${i}">show details</span></td>`
    }
  }
  html += '</tr>'
  html += '</tbody></table>'

  // Detail sections
  for (let i = 0; i < completedResults.length; i++) {
    const r = completedResults[i]
    const shortName = r.modelId.split('/').pop() || r.modelId
    html += `<div class="detail-section" id="detail-${i}">`
    html += `<h3 style="margin:12px 0 8px;font-size:0.875rem">${shortName} — Per-Email Results</h3>`
    html += renderDetailTable(r.results)
    html += '</div>'
  }

  resultsEl.innerHTML = html

  // Wire up toggle clicks
  resultsEl.querySelectorAll('.detail-toggle').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = (el as HTMLElement).dataset.model!
      const section = document.getElementById(`detail-${idx}`)!
      const isOpen = section.classList.toggle('open')
      el.textContent = isOpen ? 'hide details' : 'show details'
    })
  })
}

function renderDetailTable(results: EmailBenchmarkResult[]): string {
  let html =
    '<table class="detail-table"><thead><tr><th>Email</th><th>Expected</th><th>Actual</th><th>Time</th><th>Reasoning</th><th>Raw Output</th></tr></thead><tbody>'

  for (const r of results) {
    const cls = r.correct ? 'correct' : 'incorrect'
    const expected = `${r.expected.priority} (${r.expected.score})`
    const actual = r.actual ? `${r.actual.priority} (${r.actual.score})` : 'PARSE FAIL'
    const reasoning = r.actual?.reasoning || ''
    const time = `${(r.inferenceMs / 1000).toFixed(1)}s`

    html += `<tr>`
    html += `<td>${r.emailId}</td>`
    html += `<td>${expected}</td>`
    html += `<td class="${cls}">${actual}</td>`
    html += `<td>${time}</td>`
    html += `<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(reasoning)}">${escapeHtml(reasoning.slice(0, 80))}</td>`
    html += `<td class="raw-output" title="${escapeHtml(r.rawOutput)}">${escapeHtml(r.rawOutput.slice(0, 80))}</td>`
    html += '</tr>'
  }

  html += '</tbody></table>'
  return html
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Event handlers
runBtn.addEventListener('click', async () => {
  const modelIds = modelListEl.value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  if (modelIds.length === 0) {
    log('No models specified', 'error')
    return
  }

  const provider = providerEl.value as 'webgpu' | 'wasm'
  const dtype = dtypeEl.value as 'auto' | 'q4f16' | 'fp16' | 'fp32' | 'q4'

  // Reset
  progressEl.innerHTML = ''
  completedResults.length = 0
  renderResults()

  // UI state
  runBtn.disabled = true
  stopBtn.disabled = false
  abortController = new AbortController()

  log(
    `Starting benchmark: ${modelIds.length} model(s), provider=${provider}, dtype=${dtype}`,
    'info'
  )

  try {
    await runBenchmark({
      modelIds,
      provider,
      dtype,
      signal: abortController.signal,
      onProgress: (msg, type) => log(msg, type),
      onModelResult: (result) => {
        completedResults.push(result)
        renderResults()
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    log(`Benchmark error: ${msg}`, 'error')
  } finally {
    runBtn.disabled = false
    stopBtn.disabled = true
    abortController = null
  }
})

stopBtn.addEventListener('click', () => {
  if (abortController) {
    abortController.abort()
    log('Stopping benchmark...', 'error')
    stopBtn.disabled = true
  }
})
