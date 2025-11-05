import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders Claine v2 heading', () => {
    render(<App />)
    expect(screen.getByText(/Claine v2/)).toBeInTheDocument()
  })

  it('renders Tailwind test element', () => {
    render(<App />)
    expect(screen.getByText(/Tailwind Test - Blue background/)).toBeInTheDocument()
  })

  it('renders Default Button', () => {
    render(<App />)
    expect(screen.getByText('Default Button')).toBeInTheDocument()
  })

  it('renders Secondary Button', () => {
    render(<App />)
    expect(screen.getByText('Secondary')).toBeInTheDocument()
  })

  it('renders Outline Button', () => {
    render(<App />)
    expect(screen.getByText('Outline')).toBeInTheDocument()
  })
})
