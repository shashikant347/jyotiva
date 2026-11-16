import { lazy, Suspense, useEffect, useState } from 'react'
import { Route, Routes, useLocation, useParams } from 'react-router-dom'
import Breadcrumbs from './components/Breadcrumbs'
import { isPlannedRoute } from './data'
import { STATIC_DOCS } from './content/legal'
import Footer from './components/Footer'
import Header from './components/Header'
import ProtectedRoute from './components/ProtectedRoute'
import PrefsSync from './context/PrefsSync'

const NotFound = lazy(() => import('./pages/NotFound'))
const StaticPage = lazy(() => import('./pages/StaticPage'))
const Notifications = lazy(() => import('./pages/AccountPages').then(m => ({ default: m.Notifications })))
const OrderHistory = lazy(() => import('./pages/AccountPages').then(m => ({ default: m.OrderHistory })))
const CustomerSupport = lazy(() => import('./pages/Support'))
const AdminSupport = lazy(() => import('./pages/AdminSupport'))
const AdminBlog = lazy(() => import('./pages/AdminBlog'))
const BlogList = lazy(() => import('./pages/Blog').then(m => ({ default: m.BlogList })))
const BlogPost = lazy(() => import('./pages/Blog').then(m => ({ default: m.BlogPost })))
const FestivalCalendar = lazy(() => import('./pages/Festival').then(m => ({ default: m.FestivalCalendar })))
const FestivalDetail = lazy(() => import('./pages/Festival').then(m => ({ default: m.FestivalDetail })))
const AdminFestivals = lazy(() => import('./pages/AdminFestivals'))
const Muhurat = lazy(() => import('./pages/Muhurat'))
const Wallet = lazy(() => import('./pages/Wallet'))
const Calculator = lazy(() => import('./pages/Calculator'))
const Compatibility = lazy(() => import('./pages/FreeTools').then(m => ({ default: m.Compatibility })))
const Tarot = lazy(() => import('./pages/FreeTools').then(m => ({ default: m.Tarot })))
const FreeKundli = lazy(() => import('./pages/FreeKundli'))
const AdminAstrologers = lazy(() => import('./pages/AdminAstrologers'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminAuditLogs = lazy(() => import('./pages/AdminAuditLogs'))
const AdminPayouts = lazy(() => import('./pages/AdminPayouts'))
const AdminReports = lazy(() => import('./pages/AdminReports'))
const AdminChatReports = lazy(() => import('./pages/AdminChatReports'))
const AdminUsers = lazy(() => import('./pages/AdminUsers'))
const AdminHoroscope = lazy(() => import('./pages/AdminHoroscope'))
const AstrologerPanel = lazy(() => import('./pages/AstrologerPanel'))
const AstrologerProfile = lazy(() => import('./pages/AstrologerProfile'))
const AstrologerSignup = lazy(() => import('./pages/AstrologerSignup'))
const Astrologers = lazy(() => import('./pages/Astrologers'))
const ChatRoom = lazy(() => import('./pages/ChatRoom'))
const FreeChat = lazy(() => import('./pages/FreeChat'))
const Home = lazy(() => import('./pages/Home'))
const StartChat = lazy(() => import('./pages/StartChat'))
const Horoscope = lazy(() => import('./pages/Horoscope'))
const Panchang = lazy(() => import('./pages/Panchang'))
const KundliMatching = lazy(() => import('./pages/KundliMatching'))
const Login = lazy(() => import('./pages/Login'))
const Logout = lazy(() => import('./pages/Logout'))
const Placeholder = lazy(() => import('./pages/Placeholder'))
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'))

function CalculatorRoute() {
  const { slug = '' } = useParams()
  return <Calculator slug={slug} />
}

function TarotRoute() {
  const { spread = 'single' } = useParams()
  return <Tarot initialSpread={spread} />
}

export default function App() {
  const { pathname } = useLocation()
  const [routeAnnouncement, setRouteAnnouncement] = useState('')
  useEffect(() => {
    let frame = 0
    setRouteAnnouncement('')
    frame = window.requestAnimationFrame(() => setRouteAnnouncement(document.title))
    return () => window.cancelAnimationFrame(frame)
  }, [pathname])
  const showCrumbs = pathname !== '/' && pathname !== '/login' && pathname !== '/logout' && !pathname.startsWith('/chat/') && !pathname.startsWith('/chat-with/')
  return (
    <>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{routeAnnouncement}</span>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <PrefsSync />
      <Header />
      {showCrumbs && <Breadcrumbs />}
      <main id="main-content" className={pathname === '/' ? 'site-main home-main' : 'site-main inner-main'} tabIndex={-1}>
        <Suspense fallback={<div className="wrap sec" role="status" aria-live="polite">Loading page…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/freekundli" element={<FreeKundli />} />
            <Route path="/freekundli/result/:id" element={<FreeKundli />} />
            <Route path="/matchmaking" element={<KundliMatching />} />
            <Route path="/compatibility" element={<Compatibility />} />
            <Route path="/compatibility/:pair" element={<Compatibility />} />
            <Route path="/tarot" element={<TarotRoute />} />
            <Route path="/tarot/:spread" element={<TarotRoute />} />
            <Route path="/:slug" element={<CalculatorRoute />} />
            <Route path="/panchang/:slug/:city?" element={<Panchang />} />
            <Route path="/horoscope/:slug" element={<Horoscope />} />
            <Route path="/horoscope/:slug/:sign" element={<Horoscope />} />
            <Route path="/chat-with-astrologer" element={<Astrologers />} />
            <Route path="/talk-to-astrologer" element={<Astrologers />} />
            <Route path="/astrologer/:category" element={<Astrologers />} />
            <Route path="/best-astrologer/:slug" element={<AstrologerProfile />} />
            <Route path="/free-astrology-chat" element={<FreeChat />} />
            <Route path="/astrology-blog" element={<BlogList />} />
            <Route path="/astrology-blog/:slug" element={<BlogPost />} />
            <Route path="/festival" element={<FestivalCalendar />} />
            <Route path="/festival/:slug" element={<FestivalDetail />} />
            <Route path="/shubh-muhurat" element={<Muhurat />} />
            <Route path="/login" element={<Login />} />
            <Route path="/logout" element={<Logout />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
              <Route path="/admin/payouts" element={<AdminPayouts />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/chat-reports" element={<AdminChatReports />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/chat-with/:slug" element={<StartChat />} />
              <Route path="/chat/:id" element={<ChatRoom />} />
              <Route path="/astrologer-signup" element={<AstrologerSignup />} />
              <Route path="/astrologer-panel" element={<AstrologerPanel />} />
              <Route path="/admin/astrologers" element={<AdminAstrologers />} />
              <Route path="/admin/horoscope" element={<AdminHoroscope />} />
              <Route path="/admin/support" element={<AdminSupport />} />
              <Route path="/admin/blog" element={<AdminBlog />} />
              <Route path="/admin/festivals" element={<AdminFestivals />} />
              <Route path="/profile-settings" element={<ProfileSettings />} />
              <Route path="/notification" element={<Notifications />} />
              <Route path="/my-wallet" element={<Wallet />} />
              <Route path="/order-history" element={<OrderHistory />} />
              <Route path="/customer-support" element={<CustomerSupport />} />
            </Route>
            {Object.keys(STATIC_DOCS).map(slug => <Route key={slug} path={`/${slug}`} element={<StaticPage slug={slug} />} />)}
            <Route path="*" element={isPlannedRoute(pathname) ? <Placeholder /> : <NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer innerPage={pathname !== '/'} />
    </>
  )
}
