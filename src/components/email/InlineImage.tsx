/**
 * InlineImage Component
 *
 * Story 2.2: Thread Detail View with Conversation History
 * Task 7: Implement Inline Image Lazy Loading
 *
 * Lazy-loaded inline image with IntersectionObserver.
 * Shows placeholder while loading and fallback on error.
 */

import { useState, useRef, useEffect, memo, type CSSProperties } from 'react'
import { ImageOff } from 'lucide-react'
import { cn } from '@/utils/cn'

interface InlineImageProps {
  /** Image source URL */
  src: string
  /** Alt text for accessibility */
  alt: string
  /** Optional width */
  width?: number | string
  /** Optional height */
  height?: number | string
  /** Optional className for styling */
  className?: string
}

/**
 * Lazy-loaded inline image component
 * Uses IntersectionObserver to only load when visible
 */
export const InlineImage = memo(function InlineImage({
  src,
  alt,
  width,
  height,
  className,
}: InlineImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Set up IntersectionObserver for lazy loading
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px', // Start loading slightly before in view
      }
    )

    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  const handleLoad = () => {
    setIsLoaded(true)
  }

  const handleError = () => {
    setHasError(true)
    setIsLoaded(true)
  }

  // Calculate style dimensions
  const dimensionStyle: CSSProperties = {
    width: width || 'auto',
    height: height || 'auto',
    maxWidth: '100%',
  }

  return (
    <div ref={containerRef} className={cn('inline-block', className)} style={dimensionStyle}>
      {/* Loading placeholder - shown until image is in view */}
      {!isInView && (
        <div
          className={cn('bg-slate-100 animate-pulse rounded', 'min-h-[100px] min-w-[100px]')}
          style={dimensionStyle}
          aria-hidden="true"
        />
      )}

      {/* Image - starts loading when in view */}
      {isInView && !hasError && (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'transition-opacity duration-300 rounded',
            isLoaded ? 'opacity-100' : 'opacity-0',
            'max-w-full h-auto'
          )}
          loading="lazy"
          decoding="async"
        />
      )}

      {/* Loading skeleton while image loads */}
      {isInView && !isLoaded && !hasError && (
        <div
          className={cn(
            'absolute inset-0',
            'bg-slate-100 animate-pulse rounded',
            'min-h-[100px] min-w-[100px]'
          )}
          style={dimensionStyle}
          aria-hidden="true"
        />
      )}

      {/* Error fallback */}
      {hasError && (
        <div
          className={cn(
            'flex flex-col items-center justify-center',
            'bg-slate-100 text-slate-400 rounded',
            'p-4 min-h-[100px]'
          )}
          style={dimensionStyle}
          role="img"
          aria-label={`Failed to load image: ${alt}`}
        >
          <ImageOff className="w-8 h-8 mb-2" aria-hidden="true" />
          <span className="text-xs text-center">Image failed to load</span>
        </div>
      )}
    </div>
  )
})
