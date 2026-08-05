import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const roles = ['creator', 'educator', 'learner', 'admin'];

function App() {
  const [token, setToken] = useState(localStorage.getItem('clipmind_token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('clipmind_user') || 'null'));
  const [mode, setMode] = useState('login');
  const [videos, setVideos] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) throw new Error(data.detail || 'Something went wrong');
    return data;
  }
  async function loadVideos() { if (token) setVideos(await request('/videos')); }
  useEffect(() => { loadVideos().catch(e => setMessage(e.message)); }, [token]);

  async function authenticate(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const payload = Object.fromEntries(form);
      const data = await request(`/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      localStorage.setItem('clipmind_token', data.access_token); localStorage.setItem('clipmind_user', JSON.stringify(data.user));
      setToken(data.access_token); setUser(data.user); setMessage(`Welcome, ${data.user.name}.`);
    } catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }
  async function upload(event) {
    event.preventDefault(); const file = event.currentTarget.video.files[0]; if (!file) return;
    setBusy(true); setMessage('Uploading and queuing media processing…');
    try { const form = new FormData(); form.append('file', file); await request('/videos/upload', { method: 'POST', body: form }); event.currentTarget.reset(); await loadVideos(); setMessage('Upload received. Refresh shortly to see processing status.'); }
    catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }
  async function remove(id) { if (!confirm('Remove this video record and file?')) return; try { await request(`/videos/${id}`, { method: 'DELETE' }); await loadVideos(); } catch(e) { setMessage(e.message); } }
  function logout() { localStorage.clear(); setToken(null); setUser(null); setVideos([]); setMessage('Signed out.'); }

  if (!user) return <main className="auth"><section><p className="eyebrow">WEEK 1–2 / CORE SETUP</p><h1>ClipMind <em>AI</em></h1><p className="lead">A secure workspace for bringing long-form video into the processing pipeline.</p></section><section className="panel"><div className="tabs"><button className={mode==='login'?'active':''} onClick={()=>setMode('login')}>Sign in</button><button className={mode==='register'?'active':''} onClick={()=>setMode('register')}>Create account</button></div><form onSubmit={authenticate}><label>Email<input name="email" type="email" required /></label>{mode==='register'&&<><label>Name<input name="name" minLength="2" required /></label><label>Role<select name="role">{roles.map(r=><option key={r}>{r}</option>)}</select></label></>}<label>Password<input name="password" type="password" minLength="8" required /></label><button className="primary" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':'Create account'}</button></form>{message&&<p className="notice">{message}</p>}</section></main>;
  const canUpload = ['creator','educator','admin'].includes(user.role);
  return <main className="dashboard"><header><div><p className="eyebrow">CLIPMIND AI</p><h1>Video workspace</h1></div><div className="account"><span>{user.name} · {user.role}</span><button onClick={logout}>Sign out</button></div></header><p className="notice">{message}</p>{canUpload&&<section className="upload panel"><div><h2>Bring in a video</h2><p>MP4, MOV, WebM, AVI, or MKV. It will be validated, stored, and sent to FFmpeg for media inspection.</p></div><form onSubmit={upload}><input name="video" type="file" accept="video/*,.mkv" required/><button className="primary" disabled={busy}>{busy?'Working…':'Upload video'}</button></form></section>}<section><div className="section-title"><h2>{canUpload?'Your uploads':'Available videos'}</h2><button onClick={()=>loadVideos().catch(e=>setMessage(e.message))}>Refresh</button></div>{videos.length===0?<div className="empty">No videos yet. {canUpload?'Upload one to start the media-processing workflow.':'Check back when a creator uploads content.'}</div>:<div className="grid">{videos.map(v=><article className="card" key={v.id}><div className="video-icon">▶</div><p className={`status ${v.status}`}>{v.status.replace('_',' ')}</p><h3>{v.original_name}</h3><p>{(v.size_bytes/1024/1024).toFixed(1)} MB {v.resolution&&` · ${v.resolution}`} {v.duration_seconds?` · ${Math.round(v.duration_seconds)} sec`:''}</p>{v.processing_error&&<p className="error">{v.processing_error}</p>}{(user.role==='admin'||v.owner_id===user.id)&&<button className="danger" onClick={()=>remove(v.id)}>Delete</button>}</article>)}</div>}</section></main>;
}
createRoot(document.getElementById('root')).render(<App/>);
