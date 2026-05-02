document.addEventListener('DOMContentLoaded', () => {
  // Mobile hamburger
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileMenu.classList.toggle('open');
    });
  }

  // User dropdown
  const userBtn = document.getElementById('userMenuBtn');
  const userDropdown = document.getElementById('userDropdown');
  if (userBtn && userDropdown) {
    userBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('open');
    });
  }

  // Close on outside click
  document.addEventListener('click', () => {
    if (userDropdown) userDropdown.classList.remove('open');
    if (mobileMenu) mobileMenu.classList.remove('open');
  });

  // Navbar scroll shadow
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (navbar) navbar.style.boxShadow = window.scrollY > 4 ? '0 2px 12px rgba(0,0,0,.08)' : '';
  });
});
