const navToggle = document.querySelector('.nav-toggle');
const navList = document.querySelector('.nav-list');

if (navToggle && navList) {
  navToggle.addEventListener('click', () => {
    const isOpen = navList.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

window.addEventListener('DOMContentLoaded', () => {
  if (typeof window.initSnakeGame === 'function') {
    window.initSnakeGame();
  }
});
