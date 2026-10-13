import { useState } from 'react';
import type { AnimationEvent } from 'react';

/**
 * Phone-only intro: a teal sheet with the tagline that fades out and then slides up to reveal the app.
 * Shown once per page load. Everything is CSS; the component only removes itself when the slide ends.
 * On wider screens CSS hides it, so it costs nothing there.
 */
export default function Splash() {
  const [done, setDone] = useState(false);

  if (done) return null;

  const handleEnd = (e: AnimationEvent<HTMLDivElement>) => {
    // The sheet's own slide-out is the last animation; text animations bubble up too
    if (e.target === e.currentTarget) setDone(true);
  };

  return (
    <div className="splash" aria-hidden="true" onAnimationEnd={handleEnd}>
      <p className="splash-text">
        Finde deine <span>Ausbildung</span>
      </p>
    </div>
  );
}
