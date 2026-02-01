const state = {
  apps: [],
  query: '',
}

function bySlugThenName(a, b) {
  const aSlug = (a.slug ?? '').toLowerCase()
  const bSlug = (b.slug ?? '').toLowerCase()
  if (aSlug < bSlug) return -1
  if (aSlug > bSlug) return 1
  const aName = (a.name ?? '').toLowerCase()
  const bName = (b.name ?? '').toLowerCase()
  if (aName < bName) return -1
  if (aName > bName) return 1
  return 0
}

function normalizePath(path) {
  if (!path) return '/'
  if (!path.startsWith('/')) return `/${path}`
  return path
}

function ensureTrailingSlash(path) {
  if (!path.endsWith('/')) return `${path}/`
  return path
}

function escapeHtml(text) {
  const value = String(text ?? '')
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function matches(app, query) {
  if (!query) return true
  const q = query.toLowerCase()
  const haystack = [app.slug, app.name, app.path, app.destination].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(q)
}

function render() {
  const listEl = document.getElementById('app-list')
  const countEl = document.getElementById('app-count')
  const updatedEl = document.getElementById('updated-at')

  const apps = state.apps
    .slice()
    .sort(bySlugThenName)
    .filter((app) => matches(app, state.query))

  countEl.textContent = String(apps.length)
  updatedEl.textContent = new Date().toLocaleString()

  if (apps.length === 0) {
    listEl.innerHTML = '<div class="empty">該当するアプリがありません。</div>'
    return
  }

  listEl.innerHTML = apps
    .map((app) => {
      const slug = escapeHtml(app.slug ?? app.name ?? 'app')
      const name = escapeHtml(app.name ?? slug)
      const path = ensureTrailingSlash(normalizePath(app.path ?? `/${slug}/`))
      const destination = app.destination ? String(app.destination) : ''

      return `
        <a class="card" href="${escapeHtml(path)}">
          <div class="cardTop">
            <div>
              <div class="appName">${name}</div>
              <div class="kv">
                <div class="row"><span>入口</span> <code>${escapeHtml(path)}</code></div>
                ${
                  destination
                    ? `<div class="row"><span>遷移先</span> <code>${escapeHtml(destination)}</code></div>`
                    : ''
                }
              </div>
            </div>
            <span class="badge">${slug}</span>
          </div>
          <div class="actions" aria-hidden="true">
            <span class="btn">開く</span>
          </div>
        </a>
      `
    })
    .join('')
}

async function loadApps() {
  const res = await fetch('/apps.json', { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to load apps.json: ${res.status}`)
  const data = await res.json()
  if (!data || !Array.isArray(data.apps)) throw new Error('apps.json format error')
  state.apps = data.apps
}

function wireUi() {
  const searchEl = document.getElementById('search')
  searchEl.addEventListener('input', () => {
    state.query = searchEl.value ?? ''
    render()
  })
}

async function main() {
  wireUi()
  try {
    await loadApps()
  } catch (e) {
    const listEl = document.getElementById('app-list')
    listEl.innerHTML =
      '<div class="empty">apps.json の読み込みに失敗しました。<code>/apps.json</code> がデプロイに含まれているか確認してください。</div>'
    console.error(e)
    return
  }
  render()
}

main()

