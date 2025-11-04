# ADR-003: Local AI Inference Engine

**Status:** Accepted
**Date:** 2025-11-03
**Deciders:** Architect, AI/ML Engineer

## Context

Claine requires local AI for:
- Email triage & prioritization (<200ms per email)
- Draft generation (<2s per draft)
- Style learning from user's sent emails
- Explainability (show reasoning for decisions)
- Privacy: all processing on-device by default

**Requirement Mapping:** NFR005 (AI Performance & Quality), FR011-FR018 (AI features), FR024 (privacy)

## Decision

**Selected: ONNX Runtime Web 1.23.0 + Llama 3.1 8B Quantized (INT4)**

Implement local AI using:
- **Inference Engine:** ONNX Runtime Web 1.23.0 (WebAssembly + WebGPU acceleration)
- **Triage Model:** Llama 3.1 3B Instruct quantized to INT4 (~1.5 GB) for <200ms inference
- **Compose Model:** Llama 3.1 8B Instruct quantized to INT4 (~4 GB) for draft generation
- **Deployment:** Models loaded on-demand via Web Workers (non-blocking UI)
- **Fallback:** Cloud API opt-in with PII redaction (default: OFF)

## Options Under Consideration

**Option A: Ollama (Local Model Management)**
- **Pros:** Easy model management (download, switch, update), CLI + API, growing ecosystem, supports Llama 3.1 8B
- **Cons:** External dependency (user must install), larger footprint (~4GB model + runtime), macOS/Linux primary support
- **Performance:** Native execution, optimized for Apple Silicon/CUDA, typically 2-5s per draft on M1
- **Latency:** Good for drafts, may struggle with <200ms triage requirement

**Option B: WebLLM (Browser-Native LLM)**
- **Pros:** No external dependencies, runs in browser via WebGPU, smaller quantized models (1-3GB), cross-platform
- **Cons:** Newer/less mature, limited model selection, WebGPU not universally supported yet
- **Performance:** WebGPU acceleration good on modern hardware, slower on older devices
- **Latency:** Potentially better for triage due to quantization

**Option C: ONNX Runtime (Optimized Inference)**
- **Pros:** Highly optimized inference, smaller models possible, fine-grained control
- **Cons:** Requires model conversion (PyTorch → ONNX), more complex integration, less ecosystem support
- **Performance:** Excellent, especially for smaller task-specific models
- **Latency:** Best option for <200ms triage

**Option D: Hybrid (ONNX for triage + Ollama/WebLLM for drafts)**
- **Pros:** Optimize each task independently, best performance per use case
- **Cons:** Complexity of managing multiple runtimes, larger total footprint
- **Performance:** Optimal
- **Latency:** Meets both requirements

**Option E: Do Nothing / Defer**
- Use rule-based heuristics (keywords, sender patterns) for triage; no draft generation
- **When this makes sense:** MVP validation without AI complexity, privacy-first users skeptical of AI
- **When this fails:** Core value prop is AI-powered assistance; removes primary differentiation

## Rationale

ONNX Runtime Web provides the best balance of performance, deployment, and cross-platform support:

**Pros:**
- **No External Dependencies:** Runs in browser (no Ollama install required)
- **WebGPU Acceleration:** Near-native performance on modern hardware (M1, RTX GPUs)
- **Dual Model Strategy:** 3B model for triage (<200ms), 8B model for compose (500ms-2s)
- **Web Workers:** Non-blocking inference (UI remains responsive during AI processing)
- **Cross-Platform:** Works on macOS, Windows, Linux via WebAssembly + WebGPU
- **Progressive Loading:** Models downloaded on first use (lazy loading reduces initial app size)

**Cons:**
- **Large Model Files:** 3B model (~1.5 GB) + 8B model (~4 GB) = 5.5 GB total download
- **WebGPU Requirement:** Fallback to WASM if WebGPU unavailable (slower, but functional)
- **Cold Start:** 3-5 seconds to load model into WebGPU memory on first use

**Why Not Ollama?**
- Requires external installation (UX friction for non-technical users)
- Not browser-native (incompatible with PWA architecture)
- macOS/Linux primary support (Windows support limited)

**Why Not WebLLM?**
- Less mature ecosystem (ONNX Runtime more battle-tested)
- Limited quantization options (ONNX supports INT4, INT8, FP16)
- Smaller model selection vs. Hugging Face ONNX exports

**Performance Targets:**
- **Triage (Llama 3.1 3B INT4):** <200ms per email on WebGPU, <500ms on WASM fallback
- **Compose (Llama 3.1 8B INT4):** 500ms-2s per draft on WebGPU, 2-5s on WASM fallback

## Model Selection

**Triage Model Requirements:**
- Fast inference (<200ms)
- Classification task (4 categories + priority score)
- Can be smaller (1-3B params quantized)
- Accuracy: >90% category match vs. user feedback

**Draft Model Requirements:**
- Quality text generation
- Context window: 4K+ tokens (conversation history)
- Style adaptability
- 8B params likely minimum for quality

## Cloud Fallback Policy

Per FR024/FR025:
- **Default:** OFF
- **When enabled:** Redact PII locally (addresses, names, message bodies)
- **UI:** Per-event banner ("Processed in cloud: redacted")
- **Audit:** Log all cloud invocations, exportable by user

## Acceptance Criteria

ADR-003 is **Accepted** (this decision is now validated):
- Triage inference latency P95 <200ms/email on reference hardware (Common Benchmark Plan)
- Draft generation latency P95 <2s on reference hardware
- Model quality validated: Triage category accuracy ≥90% vs. user feedback; draft acceptance rate ≥95%
- Memory footprint documented: Model size + runtime memory <4GB total
- Cold start time: Model load + first inference <5s
- Hardware compatibility proven: All three cohorts (M1, i7, Ryzen) meet performance targets
- Cloud fallback PII redaction tested: 100% removal of test PII vectors
- Benchmark results reviewed: All options tested with Common Benchmark Plan workloads
- Owner sign-off: Architect + AI/ML Engineer approval with performance/quality/privacy trade-off analysis

## Operational Considerations

- **Rollout:**
  - Phase 1: Ship with single model (likely Ollama or WebLLM); monitor quality/performance
  - Phase 2: If performance insufficient, introduce hybrid or ONNX optimization
  - Model updates: Independent of app updates via model registry
- **Telemetry:** Track inference latency (P50/P95/P99), model accuracy (user undo rate), cloud fallback usage, model load time
- **Observability:**
  - Log slow inferences (>threshold), quality issues (high undo rate), cloud fallback events with redaction logs
  - Export user feedback loop: Collect accepted/rejected AI actions for retraining
- **Fallback:**
  - If local AI unavailable (hardware unsupported, model load failure): Gracefully degrade to rule-based or offer cloud opt-in
  - Emergency model rollback if quality degrades post-update
- **Support Playbook:**
  - Model won't load: Check hardware compatibility, disk space, reinstall model
  - Poor triage quality: Collect feedback corpus, retrain/update model
  - Slow performance: Check background processes, suggest hardware upgrade path

## Consequences

**Positive:**
- ✅ **No External Dependencies:** ONNX Runtime Web runs in browser (no Ollama/Python installation)
- ✅ **Cross-Platform:** Same codebase works on macOS, Windows, Linux via WebGPU + WASM fallback
- ✅ **PWA Compatible:** Browser-native inference aligns with PWA architecture
- ✅ **Non-Blocking UI:** Web Workers keep UI responsive during inference
- ✅ **Privacy-First:** All inference runs locally by default (no cloud API calls)

**Negative:**
- ❌ **Large Downloads:** 5.5 GB total (3B + 8B models) = long initial download on slow connections
- ❌ **WebGPU Requirement:** Best performance requires WebGPU (Chrome 113+, Edge 113+, Safari 18+)
- ❌ **Cold Start Latency:** 3-5 seconds to load model into memory on first use per session

**Mitigations:**
- **Progressive Loading:** Download models on-demand (triage model first, compose model when user composes)
- **WASM Fallback:** Slower but functional if WebGPU unavailable (target: <500ms triage, <5s compose)
- **Model Caching:** Cache models in IndexedDB (reload from disk faster than re-downloading)

## References

- **ONNX Runtime Web:** https://onnxruntime.ai/docs/tutorials/web/
- **WebGPU Specification:** https://www.w3.org/TR/webgpu/
- **Llama 3.1 Model Card:** https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct
- **ONNX Quantization Guide:** https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html
- **Web Workers API:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
- **Architecture Document:** `docs/architecture.md` (AI inference section)

---
