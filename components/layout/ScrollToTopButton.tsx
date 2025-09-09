"use client";

import { useState, useEffect } from 'react';

const ScrollToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [previousPosition, setPreviousPosition] = useState(0);
  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    const toggleVisibility = () => {
      // Show button when page is scrolled down 300px
      if (window.scrollY > 300) {
        setIsVisible(true);
        setIsAtTop(false);
      } else {
        setIsAtTop(true);
      }
    };

    window.addEventListener('scroll', toggleVisibility);

    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollFunction = () => {
    if (isAtTop) {
      // If we're at the top, scroll to the previous position
      window.scrollTo({
        top: previousPosition,
        behavior: 'smooth'
      });
      setIsAtTop(false);
    } else {
      // Save current position before scrolling to top
      setPreviousPosition(window.scrollY);
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      setIsAtTop(true);
    }
  };

  return (
    <button
      onClick={scrollFunction}
      className={`fixed bottom-4 left-4 bg-primary hover:bg-primary-dark text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 z-50 ${
        isVisible ? 'opacity-90 scale-100' : 'opacity-0 scale-75'
      }`}
      style={{ pointerEvents: isVisible ? 'auto' : 'none' }}
      aria-label={isAtTop ? "الانتقال للأسفل" : "الانتقال للأعلى"}
      title={isAtTop ? "الانتقال للأسفل" : "الانتقال للأعلى"}
    >
      <span className="text-sm font-bold">{isAtTop ? '↓' : '↑'}</span>
    </button>
  );
};

export default ScrollToTopButton; 