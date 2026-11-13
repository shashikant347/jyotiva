import { Route, Routes, useLocation } from 'react-router-dom'
import Breadcrumbs from './components/Breadcrumbs'
import { isPlannedRoute } from './data'
import { STATIC_DOCS } from './content/legal'
import NotFound from './pages/NotFound'
import StaticPage from './pages/StaticPage'
import Footer from './components/Footer'
import Header from './components/Header'
import ProtectedRoute from './components/ProtectedRoute'
import PrefsSync from './context/PrefsSync'
import { CustomerSupport, Notifications, OrderHistory, Wallet } from './pages/AccountPages'
import Calculator, { CALCULATORS } from './pages/Calculator'
import FreeKundli from './pages/FreeKundli'
import Home from './pages/Home'
import KundliMatching from './pages/KundliMatching'
import Login from './pages/Login'
import Logout from './pages/Logout'
import Placeholder from './pages/Placeholder'
import ProfileSettings from './pages/ProfileSettings'

export default function App() {
  const { pathname } = useLocation()
  const showCrumbs = pathname !== '/' && pathname !== '/login' && pathname !== '/logout'
  return (
    <>
      <PrefsSync />
      <Header />
      {showCrumbs && <Breadcrumbs />}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/freekundli" element={<FreeKundli />} />
          <Route path="/matchmaking" element={<KundliMatching />} />
          {CALCULATORS.map(c => <Route key={c.slug} path={`/${c.slug}`} element={<Calculator slug={c.slug} />} />)}
          <Route path="/login" element={<Login />} />
          <Route path="/logout" element={<Logout />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/profile-settings" element={<ProfileSettings />} />
            <Route path="/notification" element={<Notifications />} />
            <Route path="/my-wallet" element={<Wallet />} />
            <Route path="/order-history" element={<OrderHistory />} />
            <Route path="/customer-support" element={<CustomerSupport />} />
          </Route>
          {Object.keys(STATIC_DOCS).map(slug => <Route key={slug} path={`/${slug}`} element={<StaticPage slug={slug} />} />)}
          <Route path="*" element={isPlannedRoute(pathname) ? <Placeholder /> : <NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
