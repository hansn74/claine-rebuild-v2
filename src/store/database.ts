import { create } from 'zustand'

interface DatabaseState {
  initialized: boolean
  loading: boolean
  error: Error | null
  setInitialized: (value: boolean) => void
  setLoading: (value: boolean) => void
  setError: (error: Error | null) => void
}

export const useDatabaseStore = create<DatabaseState>((set) => ({
  initialized: false,
  loading: true, // Default to true to prevent race condition with QueueProcessorProvider
  error: null,
  setInitialized: (value) => set({ initialized: value }),
  setLoading: (value) => set({ loading: value }),
  setError: (error) => set({ error }),
}))
