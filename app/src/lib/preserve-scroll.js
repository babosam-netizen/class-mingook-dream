export function preserveWindowScrollAfter(action) {
  const x = window.scrollX || 0
  const y = window.scrollY || 0
  const previousScrollBehavior = document.documentElement.style.scrollBehavior
  const restore = () => window.scrollTo({ left: x, top: y, behavior: 'auto' })
  document.documentElement.style.scrollBehavior = 'auto'
  return Promise.resolve(action())
    .finally(() => {
      requestAnimationFrame(() => {
        restore()
        setTimeout(restore, 80)
        setTimeout(restore, 220)
        setTimeout(restore, 600)
        setTimeout(restore, 1000)
        setTimeout(() => {
          document.documentElement.style.scrollBehavior = previousScrollBehavior
        }, 1100)
      })
    })
}
