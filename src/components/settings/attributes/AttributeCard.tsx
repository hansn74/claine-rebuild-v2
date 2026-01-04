/**
 * AttributeCard Component
 * Displays a single attribute with toggle and actions
 *
 * Story 2.13: Custom Attributes System
 * Task 5.4: Create AttributeCard.tsx for individual attribute display
 */

import { memo, useMemo } from 'react'
import {
  Tag,
  CircleCheck,
  AlertTriangle,
  Calendar,
  ToggleLeft,
  Hash,
  Type,
  Pencil,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import type { Attribute } from '@/types/attributes'

export interface AttributeCardProps {
  attribute: Attribute
  onToggle: (id: string, enabled: boolean) => void
  onEdit: (attribute: Attribute) => void
  onDelete: (attribute: Attribute) => void
}

/**
 * Map of custom icon names to Lucide components
 */
const CUSTOM_ICONS: Record<string, LucideIcon> = {
  'circle-check': CircleCheck,
  'alert-triangle': AlertTriangle,
  tag: Tag,
  calendar: Calendar,
}

/**
 * Map of attribute types to default icons
 */
const TYPE_ICONS: Record<string, LucideIcon> = {
  enum: Tag,
  text: Type,
  date: Calendar,
  boolean: ToggleLeft,
  number: Hash,
}

/**
 * AttributeCard component
 */
export const AttributeCard = memo(function AttributeCard({
  attribute,
  onToggle,
  onEdit,
  onDelete,
}: AttributeCardProps) {
  // Get icon using useMemo to avoid creating component during render
  const Icon = useMemo(() => {
    if (attribute.icon && CUSTOM_ICONS[attribute.icon]) {
      return CUSTOM_ICONS[attribute.icon]
    }
    return TYPE_ICONS[attribute.type] || Tag
  }, [attribute.icon, attribute.type])

  const isDisabled = !attribute.enabled

  return (
    <div
      className={`
        flex items-center justify-between p-4 bg-white rounded-lg border
        ${isDisabled ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200'}
        transition-opacity duration-200
      `}
    >
      {/* Left side: Icon and info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Color indicator and icon */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: attribute.color ? `${attribute.color}20` : '#e5e7eb' }}
        >
          <Icon className="w-5 h-5" style={{ color: attribute.color || '#6b7280' }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-slate-900 truncate">{attribute.displayName}</h4>
            {attribute.isBuiltIn && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-800">
                Built-in
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            <span className="capitalize">{attribute.type}</span>
            {attribute.type === 'enum' && attribute.values && (
              <span className="ml-1">
                ({attribute.values.length} option{attribute.values.length !== 1 ? 's' : ''})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-2 ml-4">
        {/* Enable/Disable toggle */}
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={attribute.enabled}
            onChange={(e) => onToggle(attribute.id, e.target.checked)}
            className="sr-only peer"
            aria-label={`${attribute.enabled ? 'Disable' : 'Enable'} ${attribute.displayName}`}
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600" />
        </label>

        {/* Edit button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(attribute)}
          aria-label={`Edit ${attribute.displayName}`}
          className="h-8 w-8"
        >
          <Pencil className="w-4 h-4 text-slate-500" />
        </Button>

        {/* Delete button (only for custom attributes) */}
        {!attribute.isBuiltIn && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(attribute)}
            aria-label={`Delete ${attribute.displayName}`}
            className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
})

export default AttributeCard
