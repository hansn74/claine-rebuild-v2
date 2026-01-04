/**
 * AttributeList Component
 * Shows all attributes with enable/disable toggles
 *
 * Story 2.13: Custom Attributes System
 * Task 5.2: Create AttributeList.tsx showing all attributes with toggles
 */

import { memo } from 'react'
import { Plus, RefreshCw, Package } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { AttributeCard } from './AttributeCard'
import type { Attribute } from '@/types/attributes'

export interface AttributeListProps {
  attributes: Attribute[]
  loading: boolean
  error: string | null
  onToggle: (id: string, enabled: boolean) => void
  onEdit: (attribute: Attribute) => void
  onDelete: (attribute: Attribute) => void
  onAdd: () => void
  onRefresh: () => void
}

/**
 * AttributeList component
 */
export const AttributeList = memo(function AttributeList({
  attributes,
  loading,
  error,
  onToggle,
  onEdit,
  onDelete,
  onAdd,
  onRefresh,
}: AttributeListProps) {
  const builtInAttributes = attributes.filter((a) => a.isBuiltIn)
  const customAttributes = attributes.filter((a) => !a.isBuiltIn)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Custom Attributes</h2>
          <p className="text-sm text-slate-500 mt-1">
            Create custom attributes to organize your emails
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
          <Button onClick={onAdd}>
            <Plus className="w-4 h-4" />
            New Attribute
          </Button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && attributes.length === 0 && (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <Package className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-4 text-sm font-medium text-slate-900">No attributes yet</h3>
          <p className="mt-2 text-sm text-slate-500">
            Get started by creating your first custom attribute.
          </p>
          <div className="mt-6">
            <Button onClick={onAdd}>
              <Plus className="w-4 h-4" />
              Create Attribute
            </Button>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && attributes.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Built-in presets section */}
      {builtInAttributes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Built-in Presets
          </h3>
          <div className="space-y-2">
            {builtInAttributes.map((attribute) => (
              <AttributeCard
                key={attribute.id}
                attribute={attribute}
                onToggle={onToggle}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom attributes section */}
      {customAttributes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-700">Custom Attributes</h3>
          <div className="space-y-2">
            {customAttributes.map((attribute) => (
              <AttributeCard
                key={attribute.id}
                attribute={attribute}
                onToggle={onToggle}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Info text */}
      {attributes.length > 0 && (
        <p className="text-xs text-slate-500 mt-4">
          Toggle attributes on/off to show or hide them when organizing emails. Built-in presets
          cannot be deleted, only disabled.
        </p>
      )}
    </div>
  )
})

export default AttributeList
