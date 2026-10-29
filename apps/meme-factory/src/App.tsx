import { HashRouter, Route, Routes } from 'react-router-dom'

function HomePage() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center font-sans">
      <h1 className="font-display text-6xl font-bold tracking-tight text-ink sm:text-7xl">
        斗图军火库
      </h1>
      <p className="text-lg text-ink/70">别偷图了，造你自己的</p>
    </main>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </HashRouter>
  )
}
