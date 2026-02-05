# Common Benchmark Plan

**Purpose:** Provide standardized benchmarking for ADR-001 (Desktop Shell), ADR-002 (Local Store), and ADR-003 (AI Inference) to ensure comparable results.

**Hardware Cohorts:**

- **Cohort A:** Apple M1 16GB RAM (macOS 13+)
- **Cohort B:** Intel i7-10700 16GB RAM (Windows 11)
- **Cohort C:** AMD Ryzen 5 5600U 16GB RAM (Ubuntu 22.04)

**Synthetic Dataset:**

- **Size:** 100,000 emails across 3 accounts
- **Distribution:** 10% with 1-2MB attachments, 90% text-only
- **Languages:** Multilingual (60% English, 20% Dutch, 10% German, 10% other)
- **Threads:** 30% threaded conversations (2-15 messages per thread)
- **Labels:** 5-10 labels per email (Primary, Updates, Work, Personal, etc.)
- **Date Range:** Last 2 years, realistic distribution (more recent = more frequent)

**Workloads:**

1. **Cold Start:** Time from app launch to interactive home view rendered
2. **Inbox Render:** Time to render inbox list (virtualized, 50 visible emails)
3. **Thread Open:** Time to load and display thread detail (10-message thread)
4. **Search Queries:**
   - Prefix search ("from:john")
   - Phrase search ("budget approval")
   - Sender search ("sender:ceo@company.com")
   - Attachment filter ("has:attachment")
5. **AI Triage:** Batch process 500 emails, assign priority scores
6. **AI Draft:** Generate 10 draft responses back-to-back

**Metrics Collected:**

- **Latency:** P50, P95, P99 per workload
- **FPS:** Frame rate during inbox scrolling (target: ≥60 FPS)
- **Memory:** Resident Set Size (RSS) peak and steady-state
- **CPU:** Peak % and sustained % during operations
- **Storage:** Index size, database size on disk

**Pass/Fail Criteria (Maps to NFRs):**

- **NFR001:** Cold start P95 ≤1.5s; input latency P95 ≤50ms; scroll FPS ≥60
- **NFR004:** Storage for 100K emails; <5% perf degradation at scale
- **NFR005:** AI triage <200ms/email P95; draft generation <2s P95

**Tooling:**

- Benchmark harness: Custom Electron/Tauri app with synthetic data loader
- Profiling: Chrome DevTools, Instruments (macOS), Windows Performance Analyzer
- Automation: CI pipeline runs benchmarks on PR, reports regression

---
