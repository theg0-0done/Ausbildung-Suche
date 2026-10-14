import { useState, useEffect, useCallback, useRef } from 'react';
import SearchPage from './pages/SearchPage';
import DetailPage from './pages/DetailPage';
import Splash from './components/Splash';

/** Read the refnr query param from the current URL */
function getRefnrFromUrl(): string {
  return new URLSearchParams(window.location.search).get('refnr') ?? '';
}

export default function App() {
  const [activeRefnr, setActiveRefnr] = useState(getRefnrFromUrl);
  // Scroll position of the result list, so "back" lands where the user left
  const searchScroll = useRef(0);

  // Listen for browser back/forward
  useEffect(() => {
    const onPop = () => setActiveRefnr(getRefnrFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Restore the list position after returning from a detail page
  useEffect(() => {
    if (activeRefnr) return;
    window.scrollTo({ top: searchScroll.current, behavior: 'instant' });
  }, [activeRefnr]);

  // Phones: the navbar scrolls away with the page and slides back in as soon as the user scrolls up
  const navRef = useRef<HTMLElement>(null);
  const [navPinned, setNavPinned] = useState(false);
  useEffect(() => {
    const phone = window.matchMedia('(max-width: 899px)');
    let lastY = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      if (Math.abs(delta) < 4) return; // ignore jitter
      lastY = y;
      setNavPinned(phone.matches && delta < 0);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    // The filter bar sits right under the navbar while it is shown, so it needs the real height
    const measure = () => {
      const h = navRef.current?.getBoundingClientRect().height;
      if (h) document.documentElement.style.setProperty('--nav-h', `${h}px`);
    };
    const resizeObserver = new ResizeObserver(measure);
    if (navRef.current) resizeObserver.observe(navRef.current);

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const navigateToDetail = useCallback((refnr: string) => {
    if (!getRefnrFromUrl()) searchScroll.current = window.scrollY;
    const url = new URL(window.location.href);
    url.searchParams.set('refnr', refnr); // preserve other params
    window.history.pushState({}, '', url);
    setActiveRefnr(refnr);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const navigateToSearch = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('refnr'); // just remove refnr, keep filters
    window.history.pushState({}, '', url);
    setActiveRefnr('');
  }, []);

  return (
    <div className={`app ${activeRefnr ? 'is-detail' : ''} ${navPinned ? 'nav-pinned' : ''}`}>
      <Splash />

      {/* Navbar */}
      <nav className="navbar" ref={navRef}>
        <a href="/" className="navbar-brand" onClick={(e) => { e.preventDefault(); navigateToSearch(); }}>
          <span>Ausbildungs<span className="gradient-text">Suche</span></span>
        </a>
      </nav>

      {/* Page Content */}
      {activeRefnr && <DetailPage refnr={activeRefnr} onBack={navigateToSearch} onSelectJob={navigateToDetail} />}
      <div style={{ display: activeRefnr ? 'none' : 'block' }}>
        <SearchPage onSelectJob={navigateToDetail} />
      </div>
    </div>
  );
}
