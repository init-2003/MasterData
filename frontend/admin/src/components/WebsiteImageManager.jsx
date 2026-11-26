import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Grid2X2, List, Plus } from 'lucide-react';
import { request } from '../services/api.js';
import { FilterSelect } from './FilterSelect.jsx';
import { clearWebsiteImageDraft, newWebsiteImageDraft, readWebsiteImageDraft, saveWebsiteImageDraft } from '../services/website-image-drafts.js';
import { WebsiteImageGrid } from './WebsiteImageGrid.jsx';
import { WebsiteImageEditor } from './WebsiteImageEditor.jsx';
import { WebsiteImagePreview } from './WebsiteImagePreview.jsx';
import { dialog } from '../utils/dialog.js';

export function WebsiteImageManager({ app, menu, editorOpen, setEditorOpen }) {
  const username = app.user.username;
  const viewKey = `sptc.website-image-view.${menu.id}`;
  const [view, setView] = useState(() => {
    try { return sessionStorage.getItem(viewKey) === 'card' ? 'card' : 'list'; } catch { return 'list'; }
  });
  const levelKey = `sptc.website-image-level.${menu.id}`;
  const [levelFilter, setLevelFilter] = useState(() => {
    try { return sessionStorage.getItem(levelKey) ?? ''; } catch { return ''; }
  });
  const [allItems, setItems] = useState(null);
  const [collectionConfig, setCollectionConfig] = useState({ uploadEnabled: true, allowedImageHosts: [], maxImageUrlLength: 500 });
  // Level menus show every level or one level; ordering is saved per level.
  const levelOptions = menu.levels ? levelChoices(collectionConfig.levels, allItems) : [];
  const activeLevel = levelOptions.some(({ value }) => value === levelFilter) ? levelFilter : '';
  const items = allItems && activeLevel ? allItems.filter((item) => item.level === activeLevel) : allItems;
  const canReorder = !menu.levels || Boolean(activeLevel);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [editorSession, setEditorSession] = useState(() => {
    const draft = readWebsiteImageDraft(username, menu.id);
    return draft && { draft, trigger: null, metadataSaved: true };
  });
  const [saving, setSaving] = useState(false);
  const [togglePending, setTogglePending] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState('');
  const [editingOrder, setEditingOrder] = useState(false);
  const [draftOrder, setDraftOrder] = useState(null);
  const [orderMessage, setOrderMessage] = useState('');
  const heading = useRef(null);
  const orderButton = useRef(null);
  const orderInstructions = useRef(null);
  const saveRequest = useRef(null);
  const focusAfterRefresh = useRef(null);

  useEffect(() => () => saveRequest.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    request('website-images', { query: { collection: menu.id }, signal: controller.signal })
      .then(({ items: rows, config }) => {
        if (controller.signal.aborted) return;
        setItems(rows);
        if (config) setCollectionConfig(config);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        focusAfterRefresh.current = null;
        setLoadError(error.status === 401
          ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง'
          : 'โหลดรายการภาพไม่สำเร็จ');
      });
    return () => controller.abort();
  }, [menu.id, reload]);

  useLayoutEffect(() => {
    const pending = focusAfterRefresh.current;
    if (!pending || !allItems || allItems === pending.previousItems) return;
    focusAfterRefresh.current = null;
    if (document.activeElement === document.body || document.activeElement === pending.trigger) {
      (pending.trigger.isConnected ? pending.trigger : heading.current)?.focus();
    }
  }, [allItems]);

  useLayoutEffect(() => {
    if (editingOrder) orderInstructions.current?.focus();
  }, [editingOrder]);

  function refresh(keepItems = false) {
    setEditingOrder(false);
    setDraftOrder(null);
    if (!keepItems) setItems(null);
    setLoadError('');
    setReload((value) => value + 1);
  }

  function changeView(nextView) {
    setView(nextView);
    try { sessionStorage.setItem(viewKey, nextView); } catch { /* Continue without persistence. */ }
  }

  function changeLevelFilter(nextLevel) {
    setLevelFilter(nextLevel);
    setSaved('');
    try { sessionStorage.setItem(levelKey, nextLevel); } catch { /* Continue without persistence. */ }
  }

  function levelLabel(item) {
    return levelOptions.find(({ value }) => value === item.level)?.label ?? item.levelName ?? 'ไม่ระบุระดับ';
  }

  function startOrderEdit() {
    if (saveRequest.current) return;
    setEditingOrder(true);
    setSaveError('');
    setSaved('');
  }

  function cancelOrderEdit() {
    setEditingOrder(false);
    setDraftOrder(null);
    setSaveError('');
    if (draftOrder) setOrderMessage('คืนลำดับเดิมแล้ว');
    app.$nextTick(() => orderButton.current?.focus());
  }

  function moveItem(source, target) {
    const ordered = [...(draftOrder ?? items)];
    const from = ordered.findIndex(({ id }) => id === source);
    const to = ordered.findIndex(({ id }) => id === target);
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    setDraftOrder(ordered.some((item, index) => item.id !== items[index].id) ? ordered : null);
    setSaveError('');
    setSaved('');
    setOrderMessage(`${moved.title || 'ภาพไม่มีชื่อ'} อยู่ลำดับ ${to + 1}`);
  }

  async function changeCollection(action, body, messages) {
    if (saveRequest.current) return;
    const controller = new AbortController();
    saveRequest.current = controller;
    setSaving(true);
    setSaved('');
    setSaveError('');
    setOrderMessage('');
    try {
      await request(action, {
        query: { collection: menu.id },
        body,
        csrf: app.csrf,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (messages.saved) setSaved(messages.saved);
      refresh();
      heading.current?.focus();
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error.status === 409) {
        setSaveError(messages.conflict);
        refresh();
        heading.current?.focus();
      } else if (error.status === 401 || error.status === 403) {
        setSaveError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
      } else {
        setSaveError(messages.failed);
      }
    } finally {
      if (!controller.signal.aborted) setSaving(false);
      saveRequest.current = null;
    }
  }

  function saveOrder() {
    const order = draftOrder ?? items;
    return changeCollection('reorder-website-images', {
      items: order.map(({ id, revision }) => ({ id, revision })),
      ...(menu.levels ? { level: activeLevel } : {}),
    }, {
      conflict: 'รายการถูกเปลี่ยนแปลง ระบบโหลดลำดับล่าสุดให้แล้ว กรุณาจัดลำดับอีกครั้ง',
      failed: 'บันทึกลำดับไม่สำเร็จ กรุณาลองอีกครั้ง',
    });
  }

  async function toggleActive(item, active) {
    if (saveRequest.current || active === item.active) return;
    const body = new FormData();
    body.set('id', item.id);
    body.set('expected', item.revision);
    body.set('active', active ? '1' : '0');
    const controller = new AbortController();
    const replaceItem = (replacement) => setItems((rows) => rows?.map((row) => row.id === item.id ? replacement : row));
    saveRequest.current = controller;
    setTogglePending(true);
    setSaved('');
    setSaveError('');
    replaceItem({ ...item, active });
    try {
      const result = await request('set-website-image-active', {
        query: { collection: menu.id },
        body,
        csrf: app.csrf,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) replaceItem(result.item);
    } catch (error) {
      if (controller.signal.aborted) return;
      replaceItem(item);
      if (error.status === 409) {
        setSaveError('รายการถูกเปลี่ยนแปลง กรุณาตรวจสอบสถานะล่าสุดแล้วลองอีกครั้ง');
        refresh(true);
      } else if (error.status === 401 || error.status === 403) {
        setSaveError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
      } else {
        setSaveError('เปลี่ยนสถานะการแสดงไม่สำเร็จ กรุณาลองอีกครั้ง');
      }
    } finally {
      if (!controller.signal.aborted) setTogglePending(false);
      saveRequest.current = null;
    }
  }

  async function deleteImage(item) {
    if (saveRequest.current) return;
    const { isConfirmed } = await dialog.fire({
      titleText: 'ลบภาพนี้?',
      text: `รายการ “${item.title || 'ภาพไม่มีชื่อ'}” จะถูกลบออกจากเมนู`,
      showCancelButton: true,
      focusCancel: true,
      confirmButtonText: 'ลบภาพ',
      cancelButtonText: 'ยกเลิก',
      customClass: { popup: 'flat-dialog', confirmButton: 'button button-danger', cancelButton: 'button button-muted' },
    });
    if (!isConfirmed) return;
    const body = new FormData();
    body.set('id', item.id);
    body.set('expected', item.revision);
    await changeCollection('delete-website-image', body, {
      saved: 'ลบภาพแล้ว',
      conflict: 'รายการถูกเปลี่ยนแปลง ระบบโหลดรายการล่าสุดให้แล้ว กรุณาตรวจสอบก่อนลบอีกครั้ง',
      failed: 'ลบภาพไม่สำเร็จ กรุณาลองอีกครั้ง',
    });
  }

  function edit(item, trigger) {
    if (saveRequest.current) return;
    focusAfterRefresh.current = null;
    setSaveError('');
    setSaved('');
    const draft = newWebsiteImageDraft(item);
    const metadataSaved = saveWebsiteImageDraft(username, menu.id, draft);
    setEditorSession({ draft, trigger, metadataSaved });
    setEditorOpen(true);
  }

  function addImage(event) {
    edit(menu.levels ? { active: false, level: activeLevel || undefined } : { active: false }, event.currentTarget);
  }

  function closeEditor() {
    clearWebsiteImageDraft(username, menu.id, editorSession.draft.token);
    setEditorOpen(false);
    setSaveError('');
    const { trigger } = editorSession;
    app.$nextTick(() => (trigger?.isConnected ? trigger : heading.current)?.focus());
  }

  async function save(event, options = {}) {
    event.preventDefault();
    if (saveRequest.current) return;
    const body = new FormData(event.currentTarget);
    const mode = options.mode ?? (body.get('source') === 'url' ? 'url' : 'upload');
    body.set('source', mode);
    if (mode === 'url') {
      body.delete('image');
      body.set('imageUrl', options.imageUrl ?? String(body.get('imageUrl') ?? '').trim());
    } else {
      body.delete('imageUrl');
      if (options.file) body.set('image', options.file);
      else if (!body.get('image')?.size) body.delete('image');
    }
    body.set('active', body.has('active') ? '1' : '0');
    const editing = editorSession.draft.item;
    if (editing.id) {
      body.set('id', editing.id);
      body.set('expected', editing.revision);
    }
    const controller = new AbortController();
    saveRequest.current = controller;
    setSaving(true);
    setSaveError('');
    try {
      await request('save-website-image', { query: { collection: menu.id }, body, csrf: app.csrf, signal: controller.signal });
      if (controller.signal.aborted) return;
      focusAfterRefresh.current = { previousItems: allItems, trigger: editorSession.trigger ?? heading.current };
      closeEditor();
      setSaved('บันทึกภาพแล้ว');
      refresh(true);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error.status === 409) {
        setSaveError('รายการถูกแก้ไขแล้ว กรุณายกเลิกและเปิดรายการล่าสุด');
        refresh(true);
      } else if (error.message === 'invalid_image') {
        setSaveError('กรุณาเลือกภาพ JPEG, PNG, WebP หรือ AVIF ขนาดไม่เกิน 12 MB และ 8,192 พิกเซลต่อด้าน และ 36 ล้านพิกเซลรวม');
      } else if (error.message === 'invalid_image_url') {
        setSaveError('กรุณากรอกลิงก์ภาพ http:// หรือ https:// ที่ถูกต้อง');
      } else if (error.message === 'image_host_not_allowed') {
        setSaveError('โดเมนของลิงก์ภาพไม่ได้อยู่ในรายการที่ผู้ดูแลอนุญาต');
      } else if (error.message === 'image_url_too_long') {
        setSaveError('ลิงก์ภาพยาวเกินขนาดคอลัมน์ที่บันทึกได้ กรุณาย่อชื่อไฟล์หรือใช้ลิงก์ที่สั้นลง');
      } else if (error.message === 'invalid_level') {
        setSaveError('ไม่พบระดับลูกค้าที่เลือก กรุณาเลือกระดับลูกค้าอีกครั้ง');
      } else if (error.message === 'public_url_not_configured') {
        setSaveError('ระบบยังไม่ได้ตั้งค่าโดเมนสำหรับสร้างลิงก์ภาพอัปโหลด');
      } else if (error.status === 400) {
        setSaveError('กรุณาตรวจสอบข้อมูลภาพและชื่อภาพ');
      } else if (error.status === 401 || error.status === 403) {
        setSaveError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
      } else {
        setSaveError('บันทึกภาพไม่สำเร็จ กรุณาตรวจสอบรายการก่อนลองอีกครั้ง');
      }
    } finally {
      if (!controller.signal.aborted) setSaving(false);
      saveRequest.current = null;
    }
  }

  return <>
  <main className="container-xl catalog-main website-image-main" inert={(app.backgroundInert || editorOpen) || undefined}
    aria-labelledby="website-images-heading">
    <div className="website-image-panel">
    <div className="website-image-header">
      <h1 id="website-images-heading" className="page-title" tabIndex={-1} ref={heading}>{menu.title}</h1>
      {!!items?.length && <div className="website-image-buttons">
        {editingOrder ? <>
          <button type="button" className="website-image-action" disabled={saving} onClick={saveOrder}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
          <button type="button" disabled={saving} onClick={cancelOrderEdit}>ยกเลิก</button>
        </> : <>
          {canReorder && items.length > 1 && <button type="button" ref={orderButton} disabled={saving} onClick={startOrderEdit}>แก้ไขลำดับ</button>}
          <button type="button" className="website-image-action" disabled={saving} onClick={addImage}>เพิ่มภาพ</button>
        </>}
      </div>}
    </div>
    {saved && <p role="status">{saved}</p>}
    {(!!items?.length || (menu.levels && !!allItems?.length)) && <div className="website-image-view-bar">
      {menu.levels && <div className="website-image-level-filter">
        <FilterSelect id="website-image-level-filter" label="ระดับลูกค้า" value={activeLevel} options={levelOptions}
          placeholder="ทุกระดับ" disabled={editingOrder} describedBy={canReorder ? undefined : 'website-image-level-hint'}
          onChange={changeLevelFilter} />
        {!canReorder && allItems.length > 1 && <span id="website-image-level-hint" className="muted">เลือกระดับลูกค้าเพื่อแก้ไขลำดับ</span>}
      </div>}
      {!!items?.length && <div className="catalog-view-switch" role="group" aria-label="มุมมองรายการภาพ">
        <button type="button" aria-pressed={view === 'list'} onClick={() => changeView('list')}>
          <List aria-hidden="true" /> รายการ
        </button>
        <button type="button" aria-pressed={view === 'card'} onClick={() => changeView('card')}>
          <Grid2X2 aria-hidden="true" /> การ์ด
        </button>
      </div>}
    </div>}
    {editingOrder && <p className="sr-only" ref={orderInstructions} tabIndex={-1}>ลากจุดจับหรือใช้ปุ่มลูกศรเพื่อจัดลำดับ</p>}
    <p className="sr-only" role="status">{orderMessage}</p>
    {!editorOpen && saveError && <p role="alert">{saveError}</p>}
    {loadError && <p role="alert">{loadError} <button type="button" onClick={() => refresh()}>ลองอีกครั้ง</button></p>}
    {!items && !loadError && <div className="website-image-list-loading" aria-busy="true">
      <span className="loading-spinner" aria-hidden="true" />
    </div>}
    {items?.length === 0 && <section className="website-image-empty" aria-labelledby="website-image-empty-heading">
      <h2 id="website-image-empty-heading">{activeLevel ? 'ยังไม่มีภาพในระดับลูกค้านี้' : 'ยังไม่มีภาพในเมนูนี้'}</h2>
      <button type="button" className="website-image-action" disabled={saving} onClick={addImage}>
        <Plus aria-hidden="true" /> เพิ่มภาพ
      </button>
    </section>}
    {!!items?.length && <WebsiteImageGrid items={draftOrder ?? items} view={view} disabled={saving} togglePending={togglePending}
      editingOrder={editingOrder} onMove={moveItem} onEdit={edit} onDelete={deleteImage} onToggleActive={toggleActive}
      levelLabel={menu.levels ? levelLabel : undefined}
      renderImage={(item) => <WebsiteImagePreview key={item.preview} src={item.preview} alt={item.title} />} />}
    </div>
  </main>
  {editorSession && <WebsiteImageEditor key={editorSession.draft.token} open={editorOpen} draft={editorSession.draft}
    username={username} menu={menu} config={collectionConfig} metadataSaved={editorSession.metadataSaved}
    saving={saving} error={saveError} onSave={save} onClose={closeEditor}
    onNotify={(message, type) => app.showImageToast?.(message, type)} />}
  </>;
}

// Levels from dbo.Customer, plus any level still stored on an image but no longer used by a customer.
function levelChoices(levels, items) {
  const options = (levels ?? []).map(({ code, name }) => ({ value: code, label: name }));
  for (const item of items ?? []) {
    if (item.level && !options.some(({ value }) => value === item.level)) {
      options.push({ value: item.level, label: item.levelName ?? item.level });
    }
  }
  return options;
}
