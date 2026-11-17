(function () {
  'use strict'

  // The toggle is a <details>; the nav sits right after it (inside it, on older pages).
  // A closed <details> hides its content at every width, so on desktop the nav must live outside it.
  var menus = Array.prototype.slice.call(document.querySelectorAll('.site-menu'))
  if (!menus.length) return

  function navFor(menu) {
    var next = menu.nextElementSibling
    return menu.querySelector('nav') || (next && next.tagName === 'NAV' ? next : null)
  }

  menus.forEach(function (menu) {
    var nav = navFor(menu)
    if (!nav) return

    nav.addEventListener('click', function (event) {
      var target = event.target
      if (target && target.closest && target.closest('a')) menu.open = false
    })
  })

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return
    menus.forEach(function (menu) {
      menu.open = false
    })
  })
})()
