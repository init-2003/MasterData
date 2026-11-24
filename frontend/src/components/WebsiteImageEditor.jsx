import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Link2, Upload, X } from 'lucide-react';
import { dialog } from '../utils/dialog.js';
import { validateWebsiteImageUrl } from '../utils/website-image-url.js';
import { readWebsiteDraftFile, saveWebsiteImageDraft, writeWebsiteDraftFile } from '../services/website-image-drafts.js';
import { DetailDrawer } from './DetailDrawer.jsx';
import { WebsiteImagePreview } from './WebsiteImagePreview.jsx';
import { WebsiteImageSwitch } from './WebsiteImageSwitch.jsx';

const defaultConfig = { uploadEnabled: true, allowedImageHosts: [], maxImageUrlLength: 500 };

export function WebsiteImageEditor({ open, draft, username, menu, config = defaultConfig, metadataSaved, saving, error, onSave, onClose, onNotify }) {
  const { item, fields } = draft;
  const originalMode = item.sourceType === 'url' ? 'url' : 'upload';
  const originalImageUrl = item.sourceType === 'url' ? (item.imageUrl ?? '') : '';
  const [mode, setMode] = useState(fields.mode === 'url' ? 'url' : 'upload');
  const [imageUrlInput, setImageUrlInput] = useState(fields.imageUrl ?? '');
  const [debouncedUrl, setDebouncedUrl] = useState(fields.imageUrl ?? '');
  const [urlError, setUrlError] = useState('');
  const [urlPreviewFailed, setUrlPreviewFailed] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [preview, setPreview] = useState('');
  const [dropError, setDropError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [restoringFile, setRestoringFile] = useState(Boolean(draft.fileName));
  const [missingFile, setMissingFile] = useState(false);
  const [metadataError, setMetadataError] = useState(!metadataSaved);
  const [fileError, setFileError] = useState('');
  const form = useRef(null);
  const fileInput = useRef(null);
  const urlInput = useRef(null);
  const heading = useRef(null);
  const errorNotice = useRef(null);
  const confirming = useRef(false);
  const currentDraft = useRef(draft);
  const pendingFile = useRef(null);
  const selectedFile = useRef(null);
  const copyTimer = useRef(null);

  const maxLinkLength = config.maxLinkUrlLength ?? config.maxImageUrlLength;
  const urlOptions = { allowedHosts: config.allowedImageHosts, maxLength: maxLinkLength };
  const liveUrlCheck = mode === 'url' && imageUrlInput.trim()
    ? validateWebsiteImageUrl(imageUrlInput, urlOptions)
    : null;
  const debouncedUrlCheck = mode === 'url' && debouncedUrl.trim()
    ? validateWebsiteImageUrl(debouncedUrl, urlOptions)
    : null;
  const previewUrl = mode === 'url'
    ? (debouncedUrlCheck?.valid ? debouncedUrlCheck.url : '')
    : (preview || (originalMode === 'upload' ? item.preview : ''));
  const fileRequired = mode === 'upload' && (!item.id || originalMode === 'url' || missingFile);

  useEffect(() => {
    if (open) heading.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open && error) errorNotice.current?.focus();
  }, [open, error]);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  async function copyCurrentUrl() {
    if (!item.imageUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.imageUrl);
      } else {
        const input = document.createElement('textarea');
        input.value = item.imageUrl;
        input.style.cssText = 'position:fixed;left:-9999px;top:0';
        const focused = document.activeElement;
        document.body.appendChild(input);
        input.select();
        let copied;
        try { copied = document.execCommand('copy'); } finally { input.remove(); focused?.focus(); }
        if (!copied) throw new Error('Clipboard unavailable');
      }
      setCopiedUrl(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedUrl(false), 2000);
      onNotify?.('คัดลอกลิงก์ภาพแล้ว', 'success');
    } catch {
      onNotify?.('คัดลอกลิงก์ภาพไม่ได้', 'error');
    }
  }

  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    if (mode !== 'url') return;
    const timer = setTimeout(() => {
      setDebouncedUrl(imageUrlInput);
      setUrlPreviewFailed(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [mode, imageUrlInput]);

  useEffect(() => {
    if (!open || !draft.fileName) return;
    let cancelled = false;
    readWebsiteDraftFile(draft.token).then((file) => {
      if (cancelled) return;
      if (!(file instanceof File) || file.name !== draft.fileName) throw new Error('Draft file unavailable');
      selectedFile.current = file;
      if (fileInput.current) {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        fileInput.current.files = transfer.files;
      }
      setPreview(URL.createObjectURL(file));
    }).catch(() => {
      if (cancelled) return;
      setMissingFile(true);
      setFileError('กู้ไฟล์ภาพฉบับร่างไม่ได้ กรุณาเลือกไฟล์ภาพอีกครั้ง');
    }).finally(() => { if (!cancelled) setRestoringFile(false); });
    return () => { cancelled = true; };
  }, [draft, open]);

  useEffect(() => {
    if (!open) return;
    function warnWhileWriting(event) {
      if (!pendingFile.current) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warnWhileWriting);
    return () => window.removeEventListener('beforeunload', warnWhileWriting);
  }, [open]);

  function persist(nextFields, fileName = currentDraft.current.fileName) {
    currentDraft.current = { ...currentDraft.current, fields: nextFields, fileName };
    setMetadataError(!saveWebsiteImageDraft(username, menu.id, currentDraft.current));
  }

  function selectFile(file) {
    selectedFile.current = file ?? null;
    setDropError('');
    setMissingFile(false);
    setFileError('');
    setPreview(file ? URL.createObjectURL(file) : '');
    persist(currentDraft.current.fields, file?.name ?? null);
    const pending = writeWebsiteDraftFile(draft.token, file);
    pendingFile.current = pending;
    pending.catch(() => {
      if (pendingFile.current === pending) setFileError('เก็บไฟล์ฉบับร่างไม่ได้ ไฟล์อาจหายเมื่อรีเฟรช');
    }).finally(() => {
      if (pendingFile.current === pending) pendingFile.current = null;
    });
  }

  function switchMode(nextMode) {
    if (nextMode === mode || saving || restoringFile) return;
    setMode(nextMode);
    setDropError('');
    setUrlError('');
    setUrlPreviewFailed(false);
    persist({ ...currentDraft.current.fields, mode: nextMode });
  }

  function changeImageUrl(value) {
    setImageUrlInput(value);
    setUrlError('');
    setUrlPreviewFailed(false);
    persist({ ...currentDraft.current.fields, mode: 'url', imageUrl: value });
  }

  function updateFields(event) {
    if (event.target.name === 'image' || event.target.name === 'imageUrl') return;
    const data = new FormData(form.current);
    persist({
      ...currentDraft.current.fields,
      title: String(data.get('title') ?? ''),
      active: data.has('active'),
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (mode === 'url') {
      const check = validateWebsiteImageUrl(imageUrlInput, urlOptions);
      if (!check.valid) {
        setUrlError(check.error);
        urlInput.current?.focus();
        return;
      }
      setUrlError('');
      onSave(event, { mode: 'url', imageUrl: check.url });
      return;
    }

    const chosenFile = selectedFile.current ?? fileInput.current?.files?.[0] ?? null;
    if (fileRequired && !chosenFile) {
      setDropError('กรุณาเลือกไฟล์ภาพ');
      fileInput.current?.focus();
      return;
    }
    if (chosenFile && !config.uploadEnabled) {
      setDropError('ระบบยังไม่ได้ตั้งค่าโดเมนสำหรับอัปโหลดภาพ (APP_PUBLIC_ORIGIN)');
      return;
    }
    setDropError('');
    onSave(event, { mode: 'upload', file: chosenFile });
  }

  async function close() {
    if (!open || saving || confirming.current) return;
    const current = currentDraft.current;
    const dirty = current.fields.title !== (item.title ?? '')
      || current.fields.active !== Boolean(item.active)
      || current.fields.mode !== originalMode
      || (current.fields.mode === 'url' && (current.fields.imageUrl ?? '').trim() !== originalImageUrl)
      || Boolean(current.fileName);
    if (dirty) {
      confirming.current = true;
      try {
        const { isConfirmed } = await dialog.fire({
          titleText: 'ทิ้งการเปลี่ยนแปลง?',
          text: 'ข้อมูลที่ยังไม่ได้บันทึกจะไม่ถูกนำไปใช้',
          showCancelButton: true,
          focusCancel: true,
          confirmButtonText: 'ทิ้งการเปลี่ยนแปลง',
          cancelButtonText: 'กลับไปแก้ไข',
          customClass: { popup: 'flat-dialog', confirmButton: 'button button-primary', cancelButton: 'button button-muted' },
        });
        if (!isConfirmed) return;
      } finally {
        confirming.current = false;
      }
    }
    onClose();
  }

  function dropFile(event) {
    event.preventDefault();
    setDragging(false);
    if (mode !== 'upload' || saving || restoringFile) return;
    const files = event.dataTransfer.files;
    if (files.length !== 1) {
      if (files.length > 1) setDropError('กรุณาวางรูปครั้งละ 1 รูป');
      return;
    }
    if (fileInput.current) fileInput.current.files = files;
    selectFile(files[0]);
  }

  const displayedUrlError = urlError || (liveUrlCheck && !liveUrlCheck.valid ? liveUrlCheck.error : '');

  return <DetailDrawer open={open} headingId="website-image-editor-heading" onClose={close}
    onDragOver={(event) => event.preventDefault()} onDrop={(event) => event.preventDefault()}>
    <header className="detail-header">
      <h2 id="website-image-editor-heading" tabIndex={-1} ref={heading}>{item.id ? 'แก้ไขภาพ' : 'เพิ่มภาพ'}</h2>
      <div className="detail-header-actions">
        <button type="button" className="button button-muted" onClick={close} disabled={saving}>ยกเลิก</button>
        <button type="submit" form="website-image-editor-form" className="button button-primary" disabled={saving || restoringFile}>
          {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
        <button type="button" className="sidebar-icon-button" aria-label="ปิดรายละเอียด" onClick={close} disabled={saving}>
          <X aria-hidden="true" />
        </button>
      </div>
    </header>
    <div className="detail-body">
      {error && <p ref={errorNotice} tabIndex={-1} className="inline-error" role="alert">{error}</p>}
      {metadataError && <p className="inline-error" role="alert">เก็บข้อมูลฉบับร่างไม่ได้ ข้อมูลอาจหายเมื่อรีเฟรช</p>}
      {fileError && <p className="inline-error" role="alert">{fileError}</p>}
      {restoringFile && <p role="status">กำลังกู้ไฟล์ภาพฉบับร่าง…</p>}
      <form id="website-image-editor-form" className="website-image-form" ref={form} onSubmit={handleSubmit} onChange={updateFields}>
        <fieldset disabled={saving || restoringFile}>
          <input type="hidden" name="source" value={mode} />
          <div className="website-image-mode-switch" data-mode={mode} role="group" aria-label="วิธีเพิ่มภาพ">
            <button type="button" aria-pressed={mode === 'upload'} onClick={() => switchMode('upload')}>
              <Upload aria-hidden="true" /> อัปโหลดไฟล์
            </button>
            <button type="button" aria-pressed={mode === 'url'} onClick={() => switchMode('url')}>
              <Link2 aria-hidden="true" /> ใส่ลิงก์ภาพ
            </button>
          </div>
          <div className={`product-image-frame website-image-drop${previewUrl ? ' has-image' : (mode === 'upload' ? ' is-editable' : '')}${dragging ? ' is-dragging' : ''}`}
            onDragOver={(event) => {
              if (mode !== 'upload' || saving || restoringFile || !event.dataTransfer.types.includes('Files')) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
              setDragging(true);
            }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
            onDrop={dropFile}>
            {previewUrl
              ? <WebsiteImagePreview key={previewUrl} src={previewUrl} alt="ตัวอย่างภาพ" external={mode === 'url'}
                onLoad={() => setUrlPreviewFailed(false)}
                onError={() => { if (mode === 'url') setUrlPreviewFailed(true); }} />
              : (mode === 'upload'
                ? <button type="button" className="product-image-placeholder" onClick={() => fileInput.current?.click()}>
                  <span className="image-placeholder-badge"><Upload aria-hidden="true" /></span>
                  <strong>คลิกหรือลากภาพมาวาง</strong><span>JPEG, PNG, WebP · ไม่เกิน 5 MB</span>
                </button>
                : <div className="product-image-placeholder">
                  <span className="image-placeholder-badge"><Link2 aria-hidden="true" /></span>
                  <strong>กรอกลิงก์ภาพเพื่อดูตัวอย่าง</strong>
                  <span>{config.allowedImageHosts.length > 0 ? 'ใช้ได้เฉพาะโดเมนที่ผู้ดูแลอนุญาต' : 'วางลิงก์ภาพที่ขึ้นต้นด้วย http:// หรือ https://'}</span>
                </div>)}
          </div>
          {mode === 'upload' ? <>
            <label className="website-image-file">{item.id ? 'เปลี่ยนภาพ' : 'ไฟล์ภาพ'}
              <span className="website-image-file-control">
                <input ref={fileInput} name="image" type="file" accept="image/jpeg,image/png,image/webp" required={fileRequired && !preview}
                  onChange={(event) => selectFile(event.currentTarget.files[0])} />
                <span className="website-image-file-button" aria-hidden="true">เลือกไฟล์</span>
                <span className="website-image-file-name" aria-hidden="true">
                  {preview ? currentDraft.current.fileName : 'ยังไม่ได้เลือกไฟล์'}
                </span>
              </span>
            </label>
            {!config.uploadEnabled && <p className="inline-error" role="alert">
              ระบบยังไม่ได้ตั้งค่าโดเมนสำหรับอัปโหลดภาพ (APP_PUBLIC_ORIGIN)
            </p>}
            {item.id && item.sourceType === 'upload' && item.imageUrl && !preview && <div className="website-image-current-url">
              <div className="website-image-current-url-header">
                <span>ลิงก์ภาพปัจจุบัน</span>
                <button type="button" className="website-image-copy-button" onClick={copyCurrentUrl} aria-label="คัดลอกลิงก์ภาพปัจจุบัน">
                  {copiedUrl ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  <span>{copiedUrl ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                </button>
              </div>
              <code>{item.imageUrl}</code>
            </div>}
            {dropError && <p className="inline-error" role="alert">{dropError}</p>}
          </> : <>
            <label>ลิงก์ภาพ
              <input ref={urlInput} name="imageUrl" type="url" inputMode="url"
                placeholder="https://cdn.example.com/images/banner.jpg"
                maxLength={maxLinkLength}
                required value={imageUrlInput}
                onChange={(event) => changeImageUrl(event.currentTarget.value)} />
            </label>
            {config.allowedImageHosts.length > 0 && <p className="muted website-image-hint">
              โดเมนที่อนุญาต: {config.allowedImageHosts.join(', ')}
            </p>}
            {displayedUrlError && <p className="inline-error" role="alert">{displayedUrlError}</p>}
            {!displayedUrlError && urlPreviewFailed && <p className="website-image-warning" role="status">
              โหลดตัวอย่างภาพไม่สำเร็จ กรุณาตรวจสอบว่าลิงก์เปิดใช้งานได้ก่อนบันทึก
            </p>}
          </>}
          <label>ชื่อภาพ<input name="title" maxLength={menu.id === 'carousel' ? 255 : 200} required defaultValue={fields.title} /></label>
          {!item.id && <p className="muted">เพิ่มท้ายรายการ</p>}
          <WebsiteImageSwitch name="active" defaultChecked={fields.active} label="เปิดการแสดง" />
        </fieldset>
      </form>
    </div>
  </DetailDrawer>;
}
