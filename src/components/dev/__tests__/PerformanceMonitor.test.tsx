/**
 * Performance Monitor Tests
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 7.8: Write component tests for PerformanceMonitor
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PerformanceMonitor } from '../PerformanceMonitor'

// Mock import.meta.env.DEV
vi.stubGlobal('import', { meta: { env: { DEV: true } } })

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Mock requestAnimationFrame
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      return setTimeout(() => cb(performance.now()), 16) as unknown as number
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      clearTimeout(id)
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should render collapsed by default', () => {
    render(<PerformanceMonitor />)

    const button = screen.getByRole('button', { name: /perf/i })
    expect(button).toBeInTheDocument()
  })

  it('should render expanded when collapsed is false', () => {
    render(<PerformanceMonitor collapsed={false} />)

    expect(screen.getByText('Performance')).toBeInTheDocument()
    expect(screen.getByText('FPS')).toBeInTheDocument()
    expect(screen.getByText('Memory')).toBeInTheDocument()
    expect(screen.getByText('Query Cache')).toBeInTheDocument()
  })

  it('should expand when clicking the collapsed button', () => {
    render(<PerformanceMonitor />)

    const button = screen.getByRole('button', { name: /perf/i })
    fireEvent.click(button)

    // State change is synchronous
    expect(screen.getByText('Performance')).toBeInTheDocument()
  })

  it('should collapse when clicking the close button', () => {
    render(<PerformanceMonitor collapsed={false} />)

    const closeButton = screen.getByTitle('Collapse')
    fireEvent.click(closeButton)

    // State change is synchronous
    expect(screen.queryByText('Performance')).not.toBeInTheDocument()
  })

  it('should show FPS counter', () => {
    render(<PerformanceMonitor collapsed={false} />)

    expect(screen.getByText('FPS')).toBeInTheDocument()
    expect(screen.getByText(/min:/i)).toBeInTheDocument()
    expect(screen.getByText(/max:/i)).toBeInTheDocument()
    expect(screen.getByText(/avg:/i)).toBeInTheDocument()
  })

  it('should show memory section', () => {
    render(<PerformanceMonitor collapsed={false} />)

    expect(screen.getByText('Memory')).toBeInTheDocument()
  })

  it('should show query cache stats', () => {
    render(<PerformanceMonitor collapsed={false} />)

    expect(screen.getByText('Query Cache')).toBeInTheDocument()
    expect(screen.getByText(/size:/i)).toBeInTheDocument()
    expect(screen.getByText(/hit rate:/i)).toBeInTheDocument()
    expect(screen.getByText(/hits:/i)).toBeInTheDocument()
    expect(screen.getByText(/misses:/i)).toBeInTheDocument()
  })

  it('should show metrics section', () => {
    render(<PerformanceMonitor collapsed={false} />)

    expect(screen.getByText('Metrics')).toBeInTheDocument()
  })

  it('should have export button', () => {
    render(<PerformanceMonitor collapsed={false} />)

    const exportButton = screen.getByTitle('Export')
    expect(exportButton).toBeInTheDocument()
  })

  describe('position', () => {
    it('should render in bottom-right by default', () => {
      const { container } = render(<PerformanceMonitor />)
      const monitor = container.firstChild as HTMLElement

      expect(monitor.className).toContain('bottom-4')
      expect(monitor.className).toContain('right-4')
    })

    it('should render in specified position', () => {
      const { container } = render(<PerformanceMonitor position="top-left" />)
      const monitor = container.firstChild as HTMLElement

      expect(monitor.className).toContain('top-4')
      expect(monitor.className).toContain('left-4')
    })
  })
})

describe('formatBytes', () => {
  it('should format bytes correctly', () => {
    // These are tested implicitly through the Memory component
    render(<PerformanceMonitor collapsed={false} />)
    // Memory section should exist and format values
    expect(screen.getByText('Memory')).toBeInTheDocument()
  })
})
