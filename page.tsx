"use client";

import { ChangeEvent, DragEvent, useState } from "react";

type Clip = { name: string; url: string; start: number; duration: number; score: number; transcript: string };
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

function youtubeEmbedUrl(value: string) {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!["youtube.com", "m.youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host)) return "";
    const id = host === "youtu.be"
      ? url.pathname.slice(1)
      : url.searchParams.get("v") || url.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1];
    return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : "";
  } catch {
    return "";
  }
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    film: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.7-1.4-2.4L7.5 15a8 8 0 0 1 0-1.9L6.1 12l1.4-2.4 1.7.7a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 1.9Z"/></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"/></>,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4"/><path d="M20 16.5v2A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-2"/></>,
    play: <><path d="m9 6 10 6-10 6V6Z"/></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M5 17v3h14v-3"/></>,
  };
  return <svg {...common}>{paths[name] || paths.spark}</svg>;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [clipLength, setClipLength] = useState("20");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const embedUrl = youtubeEmbedUrl(youtubeUrl);

  function chooseFile(nextFile?: File) {
    if (!nextFile) return;
    const supportedVideo = /\.(mp4|mov|mkv|webm|m4v)$/i.test(nextFile.name) || ["video/mp4", "video/quicktime", "video/x-matroska", "video/webm", "video/x-m4v"].includes(nextFile.type);
    if (!supportedVideo) {
      setMessage("Unsupported file type. Choose an MP4, MOV, MKV, or WEBM video.");
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setMessage("This video is larger than 2 GB. Choose a smaller file to continue.");
      return;
    }
    setFile(nextFile);
    setMessage("");
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }

  async function processVideo() {
    if (!file) {
      setMessage("Upload a video you own or have permission to use. The YouTube link is a reference; this app won’t download video from YouTube.");
      return;
    }
    setBusy(true);
    setMessage("Uploading and finding your best moments… First-time AI setup can take a few minutes.");
    const data = new FormData();
    data.append("file", file);
    data.append("clip_length", clipLength);
    try {
      const response = await fetch(`${API}/api/clip`, { method: "POST", body: data });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Processing failed. Check that the local clipping server is running and try again.");
      if (!Array.isArray(result.clips)) throw new Error("The clipping server returned an unexpected response. Please try again.");
      setClips(result.clips);
      setMessage(`Your clips are ready${result.language ? ` · ${result.language} detected` : ""}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong while processing the video.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#home" aria-label="Frame home"><span className="brand-mark"><Icon name="play" size={17}/></span><span>frame<span className="brand-dot">.</span></span></a>
      <div className="workspace-switcher"><div className="workspace-avatar">V</div><div className="workspace-copy"><strong>Creator studio</strong><span>Free workspace</span></div><span className="switcher-dots">···</span></div>
      <p className="nav-label">WORKSPACE</p>
      <nav className="side-nav" aria-label="Main navigation">
        <a className="nav-item active" href="#home"><Icon name="grid" size={18}/> <span>Overview</span></a>
        <a className="nav-item" href="#clips"><Icon name="film" size={18}/> <span>My clips</span>{clips.length > 0 && <span className="nav-count">{clips.length}</span>}</a>
      </nav>
      <p className="nav-label tools-label">PREFERENCES</p>
      <button className="nav-item nav-button" onClick={() => setMessage("Settings are coming soon.")}><Icon name="settings" size={18}/> <span>Settings</span></button>
      <div className="sidebar-bottom"><div className="plan-card"><div className="plan-icon"><Icon name="spark" size={17}/></div><strong>Make more with Frame</strong><p>Your next great clip is one upload away.</p><button onClick={() => document.getElementById("source")?.scrollIntoView({ behavior: "smooth" })}>Create a clip <Icon name="arrow" size={14}/></button></div><div className="profile-row"><div className="profile-avatar">V</div><div><strong>Your workspace</strong><span>Local account</span></div><span className="profile-more">···</span></div></div>
    </aside>

    <div className="main-area" id="home">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>Overview</strong></div><div className="topbar-right"><span className="saved-indicator"><i/> Local workspace</span><div className="top-avatar">V</div></div></header>
      <div className="content-wrap">
        <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR CREATIVE WORKSPACE</div><h1>Make every second<br className="mobile-break"/> <span>count.</span></h1><p className="welcome-copy">Turn your long-form videos into moments people want to watch.</p></div><div className="welcome-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-core"><Icon name="play" size={23}/></div><span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✦</span></div></section>

        <div className="work-grid" id="source">
          <section className="create-card">
            <div className="card-heading"><div className="step-badge">01</div><div><h2>Start with a video</h2><p>Bring your footage in and we’ll find the moments.</p></div><span className="private-pill"><span/> PRIVATE</span></div>
            <label className="field-label" htmlFor="youtube-url">YouTube link <span>optional reference</span></label>
            <div className="url-field"><span className="url-icon"><Icon name="link" size={17}/></span><input id="youtube-url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="Paste a YouTube link"/><span className="url-status">{embedUrl ? <Icon name="check" size={17}/> : ""}</span></div>
            {embedUrl ? <div className="youtube-preview"><iframe src={embedUrl} title="YouTube video preview" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/><button className="clear-preview" onClick={() => setYoutubeUrl("")} aria-label="Clear YouTube link"><Icon name="close" size={15}/></button></div> : <p className="field-hint">Add a link to keep track of your source. To create clips, upload a video file you’re authorized to use.</p>}

            <div className="section-divider"><span>OR UPLOAD YOUR VIDEO</span></div>
            <div className={`upload-zone ${dragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
              <input id="video-upload" type="file" accept="video/mp4,video/quicktime,video/x-matroska,video/webm,.m4v" onChange={onFileChange}/>
              <label className="upload-target" htmlFor="video-upload">
                <span className="upload-icon"><Icon name={file ? "check" : "upload"} size={20}/></span>
                <span className="upload-title">{file ? file.name : <>Drop your video here, or <em>browse</em></>}</span>
                <span className="upload-subtitle">{file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB · Ready to process` : "MP4, MOV, MKV or WEBM · Max 2 GB"}</span>
              </label>
              {file && <button className="remove-file" type="button" onClick={() => { setFile(null); setMessage(""); }}>Remove file</button>}
            </div>

            <div className="settings-row"><div className="setting-control"><label className="field-label" htmlFor="clip-length">Clip length</label><div className="select-wrap"><Icon name="clock" size={16}/><select id="clip-length" value={clipLength} onChange={(event) => setClipLength(event.target.value)}><option value="15">15 seconds</option><option value="20">20 seconds</option><option value="25">25 seconds</option><option value="30">30 seconds</option></select><span className="select-chevron">⌄</span></div></div><div className="setting-control"><span className="field-label">Aspect ratio</span><div className="format-control"><span className="format-glyph">▯</span><span><strong>Portrait</strong><small>9:16 · 1080 × 1920</small></span><span className="format-check"><Icon name="check" size={13}/></span></div></div></div>
            <button className="generate-button" onClick={processVideo} disabled={busy}>{busy ? <><span className="button-spinner"/> Finding your best moments…</> : <><Icon name="spark" size={18}/> Generate clips <Icon name="arrow" size={17}/></>}</button>
            {message && <div className={`status-message ${busy ? "is-busy" : ""}`} role="status">{busy && <span className="status-spinner"/>}{message}</div>}
            <p className="permission-note">By continuing, confirm you have the rights to use this video.</p>
          </section>

          <aside className="side-panel"><div className="side-panel-top"><div><span className="mini-label">A LITTLE MAGIC</span><h3>Made for the<br/>moments that matter.</h3></div><div className="mini-spark"><Icon name="spark" size={20}/></div></div><div className="feature-list"><div className="feature-item"><span className="feature-number">01</span><div><strong>Find the hook</strong><p>AI spots the moments that keep people watching.</p></div></div><div className="feature-item"><span className="feature-number">02</span><div><strong>Frame for mobile</strong><p>Portrait-ready clips, made for the scroll.</p></div></div><div className="feature-item"><span className="feature-number">03</span><div><strong>Make it yours</strong><p>Preview and download your favorite moments.</p></div></div></div><div className="format-strip"><div className="format-poster"><Icon name="play" size={15}/></div><div><strong>Ready for your feed</strong><span>Shorts · Reels · TikTok</span></div><span className="strip-arrow"><Icon name="arrow" size={16}/></span></div><div className="side-note"><span className="note-dot"/><span>Your videos stay in your private workspace.</span></div></aside>
        </div>

        <section className="results-section" id="clips"><div className="results-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR WORKSPACE</div><h2>Your clips <span className="results-count">{clips.length.toString().padStart(2, "0")}</span></h2></div>{clips.length > 0 && <span className="results-ready"><i/> READY TO SHARE</span>}</div>
          {clips.length > 0 ? <div className="clips-grid">{clips.map((clip, index) => <article className="clip-card" key={`${clip.url}-${index}`}><div className="clip-preview"><video src={clip.url} controls/><span className="clip-index">CLIP {String(index + 1).padStart(2, "0")}</span></div><div className="clip-info"><div className="clip-title-row"><h3>{clip.name || `Highlight ${String(index + 1).padStart(2, "0")}`}</h3><span>{clip.duration}s</span></div><p>{clip.transcript || "Your standout moment is ready to share."}</p><a className="download-button" href={clip.url} download><Icon name="download" size={16}/> Download clip</a></div></article>)}</div> : <div className="empty-results"><div className="empty-icon"><Icon name="film" size={21}/></div><div><strong>Your next favorite clip goes here</strong><p>Upload a video above to get started. Your results will show up right here.</p></div><a href="#source" aria-label="Go to video upload"><Icon name="arrow" size={17}/></a></div>}
        </section>
        <footer className="page-footer"><span>FRAME <b>·</b> YOUR PRIVATE CREATIVE SPACE</span><span>Made for creators, one moment at a time <span className="footer-heart">✳</span></span></footer>
      </div>
    </div>
  </main>;
}
