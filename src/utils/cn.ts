/**
 * Classname Utility
 *
 * Combines clsx and tailwind-merge for conditional classnames
 * with intelligent Tailwind class merging.
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge classnames with Tailwind conflict resolution
 *
 * @param inputs - Class values to merge
 * @returns Merged className string
 *
 * @example
 * cn('p-4 text-red-500', condition && 'p-8 text-blue-500')
 * // With condition=true: 'p-8 text-blue-500' (tailwind-merge resolves conflicts)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
