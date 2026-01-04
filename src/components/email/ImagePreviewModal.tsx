/**
 * ImagePreviewModal Component
 *
 * Story 2.8: Attachment Handling
 * Task 3.3: Add preview modal for full-size image viewing
 *
 * Provides a fullscreen modal for viewing images at full resolution.
 * Features:
 * - Click outside or Escape to close
 * - Download button
 * - Zoom controls
 * - Pan support for zoomed images
 */

import { useState, useEffect, useCallback, useRef, type MouseEvent, type WheelEvent } from 'react'
import { X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface ImagePreviewModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Called when modal should close */
  onClose: () => void
  /** Image source URL */
  src: string
  /** Image alt text */
  alt: string
  /** Optional filename for download */
  filename?: string
  /** Called when download is requested */
  onDownload?: () => void
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const ZOOM_STEP = 0.25

interface ImagePreviewContentProps {
  onClose: () => void
  src: string
  alt: string
  filename?: string
  onDownload?: () => void
}

/**
 * Inner content component - remounts each time modal opens for fresh state
 */
function ImagePreviewContent({
  onClose,
  src,
  alt,
  filename,
  onDownload,
}: ImagePreviewContentProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imageLoaded, setImageLoaded] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - ZOOM_STEP, MIN_ZOOM)
      // Reset position if zooming back to 1x or less
      if (newZoom <= 1) {
        setPosition({ x: 0, y: 0 })
      }
      return newZoom
    })
  }, [])

  // Rotate handler
  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360)
  }, [])

  // Mouse wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    setZoom((prev) => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta))
      if (newZoom <= 1) {
        setPosition({ x: 0, y: 0 })
      }
      return newZoom
    })
  }, [])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case '+':
        case '=':
          e.preventDefault()
          handleZoomIn()
          break
        case '-':
          e.preventDefault()
          handleZoomOut()
          break
        case '0':
          e.preventDefault()
          setZoom(1)
          setPosition({ x: 0, y: 0 })
          break
        case 'r':
          e.preventDefault()
          handleRotate()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, handleZoomIn, handleZoomOut, handleRotate])

  // Pan handlers (only when zoomed > 1)
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (zoom <= 1) return
      e.preventDefault()
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    },
    [zoom, position]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || zoom <= 1) return
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    },
    [isDragging, dragStart, zoom]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: MouseEvent) => {
      if (e.target === containerRef.current) {
        onClose()
      }
    },
    [onClose]
  )

  // Handle download
  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload()
    } else if (src) {
      // Fallback: download image directly
      const link = document.createElement('a')
      link.href = src
      link.download = filename || 'image'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }, [onDownload, src, filename])

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      ref={containerRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
      onClick={handleBackdropClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      role="dialog"
      aria-modal="true"
      aria-label={`Image preview: ${alt}`}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-black/50 rounded-lg px-2 py-1">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className={cn(
              'p-1.5 rounded text-white transition-colors',
              zoom <= MIN_ZOOM ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/20'
            )}
            aria-label="Zoom out"
            title="Zoom out (-)"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-white text-sm min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className={cn(
              'p-1.5 rounded text-white transition-colors',
              zoom >= MAX_ZOOM ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/20'
            )}
            aria-label="Zoom in"
            title="Zoom in (+)"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>

        {/* Rotate button */}
        <button
          type="button"
          onClick={handleRotate}
          className="p-2 bg-black/50 rounded-lg text-white hover:bg-black/70 transition-colors"
          aria-label="Rotate image"
          title="Rotate (R)"
        >
          <RotateCw className="w-5 h-5" />
        </button>

        {/* Download button */}
        <button
          type="button"
          onClick={handleDownload}
          className="p-2 bg-black/50 rounded-lg text-white hover:bg-black/70 transition-colors"
          aria-label="Download image"
          title="Download"
        >
          <Download className="w-5 h-5" />
        </button>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="p-2 bg-black/50 rounded-lg text-white hover:bg-black/70 transition-colors"
          aria-label="Close preview"
          title="Close (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Filename */}
      {filename && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 rounded-lg px-4 py-2">
          <span className="text-white text-sm">{filename}</span>
        </div>
      )}

      {/* Loading indicator */}
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Image - mouse handlers for pan/zoom are non-essential enhancements */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        onLoad={() => setImageLoaded(true)}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        className={cn(
          'max-w-[90vw] max-h-[90vh] object-contain transition-opacity',
          imageLoaded ? 'opacity-100' : 'opacity-0',
          zoom > 1 ? 'cursor-grab' : 'cursor-default',
          isDragging && 'cursor-grabbing'
        )}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
        }}
        draggable={false}
      />

      {/* Keyboard shortcuts hint */}
      <div className="absolute bottom-4 right-4 text-white/50 text-xs hidden md:block">
        <span>Scroll to zoom • Drag to pan • R to rotate • Esc to close</span>
      </div>
    </div>
  )
}

/**
 * Full-screen modal for previewing images
 * Wrapper component that conditionally renders content for proper state reset
 */
export function ImagePreviewModal({
  isOpen,
  onClose,
  src,
  alt,
  filename,
  onDownload,
}: ImagePreviewModalProps) {
  // When not open, render nothing - content remounts with fresh state when reopened
  if (!isOpen) return null

  return (
    <ImagePreviewContent
      onClose={onClose}
      src={src}
      alt={alt}
      filename={filename}
      onDownload={onDownload}
    />
  )
}
