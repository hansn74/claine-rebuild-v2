# Story 3.1: Local LLM Integration (Ollama)

Status: drafted

## Story

As a developer,
I want Ollama integrated for local LLM inference,
so that we can run AI models on-device without cloud dependency.

## Acceptance Criteria

1. Ollama connection wrapper created for inference requests with proper error handling
2. WebGPU/WebAssembly capability detection on app load
3. ONNX Runtime Web integrated for browser-based inference (Llama 3.1 8B Q4 quantized)
4. Latency benchmarked on target hardware (M1, Intel i7, AMD Ryzen) - target <500ms for triage
5. Fallback mechanism to cloud API (OpenAI/Anthropic) configurable via environment variables
6. Model loading happens in background (doesn't block UI) with progress indicator
7. Model cached in Cache Storage API for persistence across sessions
8. Inference requests run in Web Worker (non-blocking main thread)

## Tasks / Subtasks

- [ ] Task 1: Create AI service infrastructure (AC: 1, 8)
  - [ ] Create `src/services/ai/` directory structure
  - [ ] Implement `aiInferenceService.ts` with abstract inference interface
  - [ ] Create Web Worker for inference (`src/workers/ai-inference.worker.ts`)
  - [ ] Add worker communication utilities (postMessage/onmessage wrapper)

- [ ] Task 2: Implement capability detection (AC: 2)
  - [ ] Create `src/services/ai/capabilityDetection.ts`
  - [ ] Detect WebAssembly support via `typeof WebAssembly !== 'undefined'`
  - [ ] Detect WebGPU support via `navigator.gpu` availability
  - [ ] Check available memory (require 4GB minimum) via `navigator.deviceMemory`
  - [ ] Store capability results in Zustand store (`aiCapabilityStore.ts`)
  - [ ] Add unit tests for capability detection

- [ ] Task 3: Integrate ONNX Runtime Web (AC: 3)
  - [ ] Install `onnxruntime-web@1.23.0` (already in architecture)
  - [ ] Create `onnxInferenceService.ts` implementing inference interface
  - [ ] Configure execution providers: `['webgpu', 'wasm']` fallback chain
  - [ ] Implement model loading with progress callbacks
  - [ ] Add tokenizer integration for Llama 3.1 (use tiktoken or llama-tokenizer-js)

- [ ] Task 4: Implement model caching (AC: 7)
  - [ ] Create `src/services/ai/modelCache.ts`
  - [ ] Use Cache Storage API with cache name `claine-models-v1`
  - [ ] Implement `cacheModel(modelBlob)` and `getCachedModel()` methods
  - [ ] Add cache version migration for future model updates
  - [ ] Handle partial downloads with resume capability

- [ ] Task 5: Implement background model loading (AC: 6)
  - [ ] Create `useModelLoader` hook for React integration
  - [ ] Show download progress UI (percentage + ETA)
  - [ ] Allow user to cancel download
  - [ ] Lazy load model (not on app startup, on first AI feature use)
  - [ ] Emit loading state to `aiCapabilityStore`

- [ ] Task 6: Implement cloud fallback (AC: 5)
  - [ ] Create `cloudInferenceService.ts` for OpenAI/Anthropic API
  - [ ] Add environment variables: `VITE_AI_FALLBACK_PROVIDER`, `VITE_OPENAI_API_KEY`, `VITE_ANTHROPIC_API_KEY`
  - [ ] Implement automatic fallback when local inference fails or unavailable
  - [ ] Add user setting to disable cloud fallback (privacy preference)
  - [ ] Log fallback events for analytics

- [ ] Task 7: Performance benchmarking (AC: 4)
  - [ ] Create `src/services/ai/__benchmarks__/inference.bench.ts`
  - [ ] Benchmark cold start (model load) time
  - [ ] Benchmark warm inference latency (target <500ms for triage)
  - [ ] Test on WebGPU, WASM CPU, and fallback scenarios
  - [ ] Add performance monitoring hooks for dev dashboard (Epic 3.9)
  - [ ] Document hardware requirements in README

- [ ] Task 8: Testing & Integration (AC: 1-8)
  - [ ] Unit tests for all services
  - [ ] Integration test: full inference pipeline
  - [ ] E2E test: model download, cache, and inference
  - [ ] Mock ONNX runtime for unit tests
  - [ ] Add error boundary for AI features

## Dev Notes

### Relevant Architecture Patterns

- **Service Pattern**: Use singleton services exported from index files per architecture.md
- **Web Worker Communication**: Follow pattern in `src/workers/` for non-blocking inference
- **Zustand Store**: Create `aiCapabilityStore.ts` following `{domain}.store.ts` naming
- **Error Handling**: Use `Result<T, E>` pattern from architecture for inference results
- **Cache Storage**: Use `claine-models-v1` namespace per architecture caching strategy

### Source Tree Components

```
src/
├── services/
│   └── ai/
│       ├── index.ts                    # Service exports
│       ├── aiInferenceService.ts       # Abstract inference interface
│       ├── onnxInferenceService.ts     # ONNX Runtime implementation
│       ├── cloudInferenceService.ts    # OpenAI/Anthropic fallback
│       ├── capabilityDetection.ts      # Browser capability checks
│       ├── modelCache.ts               # Cache Storage API wrapper
│       └── __tests__/
│           ├── capabilityDetection.test.ts
│           ├── onnxInferenceService.test.ts
│           └── modelCache.test.ts
├── workers/
│   └── ai-inference.worker.ts          # Web Worker for inference
├── store/
│   └── aiCapabilityStore.ts           # AI capability state
└── hooks/
    └── useModelLoader.ts              # Model loading hook
```

### Testing Standards

- Unit tests: 80% coverage target
- Mock ONNX Runtime for isolated testing
- Use `vi.mock()` for Web Worker mocking
- Performance benchmarks with Vitest bench

### References

- [Source: docs/architecture.md#Decision 4: Local AI]
- [Source: docs/architecture.md#Cross-Cutting Concerns - Caching Strategy]
- [Source: docs/epics/epic-3-ai-triage-attribute-suggestions.md#Story 3.1]
- ONNX Runtime Web documentation: https://onnxruntime.ai/docs/tutorials/web/

### Technology Stack

- **Runtime**: ONNX Runtime Web 1.23.0
- **Model**: Llama 3.1 8B Q4 quantized (~4GB)
- **Execution Providers**: WebGPU (primary), WebAssembly (fallback)
- **Tokenizer**: tiktoken or llama-tokenizer-js

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5

### Debug Log References

### Completion Notes List

### File List
