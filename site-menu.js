(function () {
  'use strict'

  var menus = Array.prototype.slice.call(document.querySelectorAll('.site-menu'))
  if (!menus.length) return

  menus.forEach(function (menu) {
    var nav = menu.querySelector('nav')
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
