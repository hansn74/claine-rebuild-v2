import { Button } from '@shared/components/ui/button'

function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold">Claine v2</h1>

      {/* AC: 6 - Test basic Tailwind utility classes */}
      <div className="bg-blue-500 text-white p-4 rounded-lg">
        Tailwind Test - Blue background, white text, padding, rounded corners
      </div>

      {/* AC: 7 - Test shadcn/ui Button component */}
      <div className="flex gap-4">
        <Button variant="default">Default Button</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
      </div>
    </div>
  )
}

export default App
