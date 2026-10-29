import { HashRouter, Route, Routes } from 'react-router-dom'
import EditorPage from '@/features/editor/EditorPage'
import HomePage from '@/features/home/HomePage'
import PackPage from '@/features/packs/PackPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<EditorPage />} />
        <Route path="/packs" element={<PackPage />} />
      </Routes>
    </HashRouter>
  )
}
