import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import Camera from './pages/Camera'
import Friend from './pages/Friend'
import Gallery from './pages/Gallery'
import Lab from './pages/Lab'
import Outro from './pages/Outro'
import Presentation from './pages/Presentation'
import Tank from './pages/Tank'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Tank />} />
        <Route path="/camera" element={<Camera />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/lab" element={<Lab />} />
        <Route path="/presentation" element={<Presentation />} />
        <Route path="/outro" element={<Outro />} />
        <Route path="/friend" element={<Friend />} />
        <Route path="/friend/:owner" element={<Friend />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
