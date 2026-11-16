import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { hasAdminAccess } from '../adminAccess'
import { useAuth } from '../context/AuthContext'
import { Article } from './Blog'
import { usePageMeta } from '../hooks'
import { api, isApiError, uploadImage } from '../services/api'

interface Row { id: string; slug: string; coverImageUrl?: string | null; title: string; excerpt: string; body: string; category: string; tags: string[]; authorName: string; language: 'en' | 'hi'; status: 'draft' | 'published'; seoTitle: string; seoDescription: string; isSample: boolean }
const BLANK = { title: '', slug: '', excerpt: '', body: '', category: 'Basics', tags: '', authorName: 'Jyotiva Editorial', language: 'en', status: 'draft', seoTitle: '', seoDescription: '' }

export default function AdminBlog() {
  usePageMeta('Admin: blog', { noindex: true })
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[]>([]), [editId, setEditId] = useState<string | 'new' | null>(null), [f, setF] = useState({ ...BLANK }), [msg, setMsg] = useState('')
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null), [coverUrl, setCoverUrl] = useState(''), [baseCoverUrl, setBaseCoverUrl] = useState(''), [coverRemoved, setCoverRemoved] = useState(false)
  const load = useCallback(() => { api<{ items: Row[] }>('/admin/blog').then(r => setRows(r.items)).catch(e => setMsg(isApiError(e) ? e.message : 'Something went wrong')) }, [])
  useEffect(() => { if (hasAdminAccess(user, ['content'])) load() }, [load, user])
  if (!hasAdminAccess(user, ['content'])) return <section className="wrap sec"><h1 className="page-h">Not allowed</h1><p className="lead">This page is for content administrators.</p></section>
  const edit = (r: Row) => { setEditId(r.id); setF({ ...r, tags: r.tags.join(', ') } as typeof BLANK); setCoverFile(null); setCoverUrl(r.coverImageUrl ?? ''); setBaseCoverUrl(r.coverImageUrl ?? ''); setCoverRemoved(false); setMsg('') }
  async function save(e: FormEvent) {
    e.preventDefault(); setMsg('')
    const body = { title: f.title, ...(f.slug ? { slug: f.slug } : {}), excerpt: f.excerpt, body: f.body, category: f.category, tags: f.tags.split(',').map(t => t.trim()).filter(Boolean), authorName: f.authorName, language: f.language, seoTitle: f.seoTitle, seoDescription: f.seoDescription, status: f.status }
    try {
      const saved = await api<Row>(editId === 'new' ? '/admin/blog' : `/admin/blog/${editId}`, { method: editId === 'new' ? 'POST' : 'PATCH', body })
      setEditId(saved.id)
      let result = saved
      if (coverFile) result = await uploadImage<Row>(`/admin/blog/${saved.id}/cover`, coverFile)
      else if (coverRemoved) result = await api<Row>(`/admin/blog/${saved.id}/cover`, { method: 'DELETE' })
      setEditId(null); setCoverFile(null); setCoverUrl(''); setBaseCoverUrl(result.coverImageUrl ?? ''); setCoverRemoved(false); load()
    } catch (x) { setMsg(isApiError(x) ? x.message : 'Something went wrong') }
  }
  async function del(r: Row) {
    if (!window.confirm(`Delete "${r.title}"?`)) return
    try { await api(`/admin/blog/${r.id}`, { method: 'DELETE' }); load() } catch (x) { setMsg(isApiError(x) ? x.message : 'Something went wrong') }
  }
  const set = (k: keyof typeof BLANK) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  function formatBody(kind: 'heading' | 'bold' | 'italic' | 'list' | 'quote') {
    const field = bodyRef.current
    if (!field) return
    const value = f.body, start = field.selectionStart, end = field.selectionEnd
    let next = value, selectStart = start, selectEnd = end
    if (kind === 'bold' || kind === 'italic') {
      const marker = kind === 'bold' ? '**' : '*', selected = value.slice(start, end) || (kind === 'bold' ? 'bold text' : 'italic text')
      next = value.slice(0, start) + marker + selected + marker + value.slice(end)
      selectStart = start + marker.length; selectEnd = selectStart + selected.length
    } else {
      const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
      const selected = value.slice(lineStart, end) || ''
      const marker = kind === 'heading' ? '## ' : kind === 'list' ? '- ' : '> '
      const lines = selected.split('\n')
      next = value.slice(0, lineStart) + lines.map(line => marker + line).join('\n') + value.slice(end)
      selectStart = lineStart; selectEnd = lineStart + lines.map(line => marker + line).join('\n').length
    }
    setF(current => ({ ...current, body: next }))
    requestAnimationFrame(() => { field.focus(); field.setSelectionRange(selectStart, selectEnd) })
  }
  return (
    <section className="wrap sec settings">
      <h1 className="page-h">Blog articles</h1>
      {msg && <p className="alert" role="alert">{msg}</p>}
      {editId ? (
        <form className="panel form" onSubmit={save}>
          <h2>{editId === 'new' ? 'New article' : 'Edit article'}</h2>
          <div className="field"><label htmlFor="bt">Title</label><input id="bt" value={f.title} onChange={set('title')} maxLength={140} required /></div>
          <div className="field"><label htmlFor="bcv">Cover image</label><input id="bcv" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) { if (coverUrl.startsWith('blob:')) URL.revokeObjectURL(coverUrl); setCoverFile(file); setCoverUrl(URL.createObjectURL(file)); setCoverRemoved(false) } }} /><small>JPEG, PNG or WebP, up to 5 MB.</small>{coverUrl && <div className="row"><img className="blog-cover-preview" src={coverUrl} alt="Article cover preview" /><button type="button" className="btn btn-line sm" onClick={() => { if (coverUrl.startsWith('blob:')) URL.revokeObjectURL(coverUrl); setCoverFile(null); setCoverRemoved(Boolean(baseCoverUrl)); setCoverUrl('') }}>Remove cover</button></div>}</div>
          <div className="field"><label htmlFor="bsl">Web address (optional)</label><input id="bsl" value={f.slug} onChange={set('slug')} maxLength={80} placeholder="made from the title if empty" /></div>
          <div className="field"><label htmlFor="be">Short summary</label><textarea id="be" rows={2} value={f.excerpt} onChange={set('excerpt')} maxLength={300} required /></div>
          <div className="field"><label htmlFor="bb">Article text</label>
            <div className="row" role="toolbar" aria-label="Article formatting">
              <button type="button" className="btn btn-line sm" onClick={() => formatBody('heading')} aria-label="Insert heading">Heading</button>
              <button type="button" className="btn btn-line sm" onClick={() => formatBody('bold')} aria-label="Bold selected text"><b>B</b></button>
              <button type="button" className="btn btn-line sm" onClick={() => formatBody('italic')} aria-label="Italicize selected text"><i>I</i></button>
              <button type="button" className="btn btn-line sm" onClick={() => formatBody('list')} aria-label="Create a bullet list">Bullet list</button>
              <button type="button" className="btn btn-line sm" onClick={() => formatBody('quote')} aria-label="Quote selected lines">Quote</button>
            </div>
            <textarea id="bb" ref={bodyRef} rows={14} value={f.body} onChange={set('body')} required />
            <small>Use the toolbar to format text. Preview shows how the article will appear.</small>
            <details className="panel"><summary>Preview article</summary><Article body={f.body} /></details>
          </div>
          <div className="row"><div className="field"><label htmlFor="bc">Category</label><input id="bc" value={f.category} onChange={set('category')} required /></div><div className="field"><label htmlFor="bg">Tags (comma separated)</label><input id="bg" value={f.tags} onChange={set('tags')} /></div></div>
          <div className="row"><div className="field"><label htmlFor="ba">Author</label><input id="ba" value={f.authorName} onChange={set('authorName')} required /></div><div className="field"><label htmlFor="bl">Language</label><select id="bl" value={f.language} onChange={set('language')}><option value="en">English</option><option value="hi">Hindi</option></select></div></div>
          <div className="field"><label htmlFor="bst">SEO title (max 70)</label><input id="bst" value={f.seoTitle} onChange={set('seoTitle')} maxLength={70} /></div>
          <div className="field"><label htmlFor="bsd">SEO description (max 170)</label><input id="bsd" value={f.seoDescription} onChange={set('seoDescription')} maxLength={170} /></div>
          <div className="field"><label htmlFor="bs">Status</label><select id="bs" value={f.status} onChange={set('status')}><option value="draft">Draft (hidden)</option><option value="published">Published</option></select></div>
          <div className="row"><button className="btn btn-gold">Save</button><button type="button" className="btn btn-line" onClick={() => { if (coverUrl.startsWith('blob:')) URL.revokeObjectURL(coverUrl); setEditId(null); setCoverFile(null); setCoverUrl(''); setBaseCoverUrl(''); setCoverRemoved(false) }}>Cancel</button></div>
        </form>
      ) : (
        <div className="panel">
          <div><button className="btn btn-gold" onClick={() => { setEditId('new'); setF({ ...BLANK }); setCoverFile(null); setCoverUrl(''); setBaseCoverUrl(''); setCoverRemoved(false); setMsg('') }}>New article</button></div>
          {rows.length === 0 && <p className="empty">No articles yet.</p>}
          {rows.map(r => <div className="trow" key={r.id}>{r.coverImageUrl && <img className="blog-cover-thumb" src={r.coverImageUrl} alt="" />}<span><b>{r.title}</b>{r.isSample && ' (sample)'}<br /><span className="muted small">{r.status === 'published' ? 'Published' : 'Draft'} · /astrology-blog/{r.slug}</span></span><span className="row"><button className="btn btn-line sm" onClick={() => edit(r)}>Edit</button><button className="btn btn-line sm" onClick={() => del(r)}>Delete</button></span></div>)}
        </div>
      )}
    </section>
  )
}
