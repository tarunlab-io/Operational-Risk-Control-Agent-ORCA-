import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './ORCA_App.jsx'
import { HistoryPage, PendingPage, AdminPage, LocationRisksPage } from './Pages.jsx'

function Root() {
  const user = { uid: "public_user", email: "public@civicflow.io", displayName: "Public User" };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<App user={user} />} />
        <Route path="/history" element={<HistoryPage user={user} />} />
        <Route path="/pending" element={<PendingPage user={user} />} />
        <Route path="/admin"   element={<AdminPage user={user} />} />
        <Route path="/location-risks" element={<LocationRisksPage user={user} />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
