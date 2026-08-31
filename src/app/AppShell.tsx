import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import { AudioProvider } from "../audio/AudioProvider"
import { SoundToggle } from "../audio/SoundToggle"
import { siteConfig } from "./siteConfig"

function AppShellContent() {
  const { pathname } = useLocation()
  const isExhibitRoute = pathname.startsWith("/exhibits/")

  return (
    <div className={`site-frame${isExhibitRoute ? " site-frame--exhibit" : ""}`}>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      {isExhibitRoute ? null : (
        <header className="site-header">
          <div className="site-header__inner">
            <p className="site-title">
              <Link to="/">{siteConfig.siteTitle}</Link>
            </p>
            <nav aria-label="主导航">
              <ul className="site-nav">
                <li>
                  <NavLink end to="/">
                    馆藏
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/about/">关于</NavLink>
                </li>
                <li>
                  <SoundToggle />
                </li>
              </ul>
            </nav>
          </div>
        </header>
      )}
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      {isExhibitRoute ? null : (
        <footer className="site-footer">
          <p>{siteConfig.siteTitle}</p>
          <p>私人数字收藏柜 · 与朋友分享</p>
        </footer>
      )}
    </div>
  )
}

export function AppShell() {
  return (
    <AudioProvider>
      <AppShellContent />
    </AudioProvider>
  )
}
