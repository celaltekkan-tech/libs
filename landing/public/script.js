const year = document.getElementById('year')
if (year) year.textContent = new Date().getFullYear()

const header = document.querySelector('.site-header')
const toggle = document.querySelector('.nav-toggle')

if (header && toggle) {
  toggle.addEventListener('click', () => {
    const open = header.classList.toggle('nav-open')
    toggle.setAttribute('aria-expanded', String(open))
  })

  document.querySelectorAll('.main-nav a, .header-cta a').forEach((link) => {
    link.addEventListener('click', () => {
      header.classList.remove('nav-open')
      toggle.setAttribute('aria-expanded', 'false')
    })
  })
}
