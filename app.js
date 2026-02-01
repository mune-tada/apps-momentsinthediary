const state = {
  apps: [],
  query: '',
}

function hashHue(input) {
  const text = String(input ?? '')
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0
  const hue = Math.abs(hash) % 360
  return hue
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
  const haystack = [app.slug, app.name, app.path, app.destination, app.description, ...(app.tags ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
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
    listEl.innerHTML = '<div class="empty">該当する作品がありません。</div>'
    return
  }

  listEl.innerHTML = apps
    .map((app) => {
      const slug = escapeHtml(app.slug ?? app.name ?? 'app')
      const name = escapeHtml(app.name ?? slug)
      const path = ensureTrailingSlash(normalizePath(app.path ?? `/${slug}/`))
      const destination = app.destination ? String(app.destination) : ''
      const description = escapeHtml(app.description ?? '')
      const tags = Array.isArray(app.tags) ? app.tags.slice(0, 6) : []
      const hue = hashHue(app.slug ?? app.name ?? '')

      return `
        <article class="card" style="--hue: ${hue}">
          <a class="cardCoverLink" href="${escapeHtml(path)}" aria-label="${name} を開く">
            <div class="cover"></div>
          </a>

          <div class="content">
            <div class="cardHeader">
              <div>
                <a class="cardTitleLink" href="${escapeHtml(path)}">${name}</a>
                ${description ? `<div class="desc">${description}</div>` : `<div class="desc"></div>`}
              </div>
              <span class="badge">${slug}</span>
            </div>

            <div class="metaRow">
              <span class="path">${escapeHtml(path)}</span>
            </div>

            ${
              tags.length
                ? `<div class="tags">${tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
                : ''
            }

            <div class="actions">
              <div class="actionsLeft">
                <a class="btn btnPrimary" href="${escapeHtml(path)}">Open</a>
              </div>
              ${
                destination
                  ? `<a class="linkMuted" href="${escapeHtml(destination)}" target="_blank" rel="noopener noreferrer">Vercel</a>`
                  : ''
              }
            </div>
          </div>
        </article>
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
    listEl.innerHTML = '<div class="empty">一覧の読み込みに失敗しました。</div>'
    console.error(e)
    return
  }
  render()
}

main()
