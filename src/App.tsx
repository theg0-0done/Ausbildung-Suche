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
    <div className={`app ${activeRefnr ? 'is-detail' : ''}`}>
      <Splash />

      {/* Navbar */}
      <nav className="navbar">
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
