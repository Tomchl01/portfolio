// ==========================================
// MOTION AS BREATH
// Subtle guidance, not manipulation
// ==========================================

(function() {
  'use strict';

  // ==========================================
  // Smooth Scroll - Natural rhythm
  // ==========================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // ==========================================
  // Navigation - Breath on scroll
  // Inhale: appears | Exhale: subtle fade
  // ==========================================
  let lastScroll = 0;
  const nav = document.querySelector('.nav');
  
  if (nav) {
    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;
      
      // Only hide after substantial scroll
      if (currentScroll > lastScroll && currentScroll > 200) {
        nav.style.opacity = '0.3';
      } else {
        nav.style.opacity = '1';
      }
      
      lastScroll = currentScroll;
    }, { passive: true });
    
    // Restore on hover
    nav.addEventListener('mouseenter', () => {
      nav.style.opacity = '1';
    });
  }

  // ==========================================
  // Intersection Observer - Gentle reveals
  // Elements breathe into view
  // ==========================================
  const observerOptions = {
    threshold: 0.15,
    rootMargin: '0px 0px -80px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  // Observe cards and content sections
  document.querySelectorAll('.card, .section-content, .about-section').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 800ms cubic-bezier(0.4, 0, 0.2, 1), transform 800ms cubic-bezier(0.4, 0, 0.2, 1)';
    observer.observe(el);
  });

  // ==========================================
  // Card Hover - Subtle depth
  // Not performance, just presence
  // ==========================================
  const cards = document.querySelectorAll('.card');
  
  cards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transition = 'all 600ms cubic-bezier(0.4, 0, 0.6, 1)';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transition = 'all 800ms cubic-bezier(0.4, 0, 0.2, 1)';
    });
  });

  // ==========================================
  // Active Navigation - Quiet indicator
  // ==========================================
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav a[href^="#"]');

  if (sections.length > 0 && navLinks.length > 0) {
    window.addEventListener('scroll', () => {
      let current = '';
      
      sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (pageYOffset >= sectionTop - 300) {
          current = section.getAttribute('id');
        }
      });

      navLinks.forEach(link => {
        link.style.opacity = '0.6';
        if (link.getAttribute('href') === `#${current}`) {
          link.style.opacity = '1';
          link.style.color = 'var(--text-primary)';
        }
      });
    }, { passive: true });
  }

  // ==========================================
  // Prefers Reduced Motion - Respect
  // ==========================================
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  
  if (prefersReducedMotion.matches) {
    document.querySelectorAll('*').forEach(el => {
      el.style.animation = 'none !important';
      el.style.transition = 'none !important';
    });
  }

  // ==========================================
  // Page Visibility - Breath awareness
  // Pause animations when page is hidden
  // ==========================================
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      document.body.style.animationPlayState = 'paused';
    } else {
      document.body.style.animationPlayState = 'running';
    }
  });

  // ==========================================
  // Console - A quiet signature
  // ==========================================
  console.log('%c◆', 'font-size: 24px; color: #0071e3;');
  console.log('%cTom Chévez', 'font-size: 14px; font-weight: 300; color: #1d1d1f;');
  console.log('%cData Analyst', 'font-size: 12px; font-weight: 300; color: #6e6e73;');

})();
