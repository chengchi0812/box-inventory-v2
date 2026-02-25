import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchBoxes, createBox, updateBox, deleteBox, createItem, deleteItem, dataURLtoBlob } from './storage';
import { Icons } from './Icons';
import { BOX_COLORS, compressImage, dataURLtoBlob as toBlobUtil } from './utils';
import { PhotoCapture, Lightbox, QRCodeDisplay, QRScanner, Toast } from './components';
import './app.css';

export default function App() {
  const [boxes, setBoxes] = useState([]);
  const [view, setView] = useState('home');
  const [selectedBox, setSelectedBox] = useState(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';

  // Load boxes from Supabase
  const loadBoxes = useCallback(async () => {
    const data = await fetchBoxes();
    setBoxes(data);
    return data;
  }, []);

  useEffect(() => {
    loadBoxes().then((data) => {
      setLoaded(true);
      // Check URL params for QR scan
      const params = new URLSearchParams(window.location.search);
      const boxId = params.get('box');
      if (boxId && data) {
        const found = data.find((b) => b.id === boxId);
        if (found) { setSelectedBox(found); setView('box'); }
      }
    });
  }, [loadBoxes]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // CRUD with Supabase
  const handleAddBox = async (boxData) => {
    setSyncing(true);
    const newBox = await createBox(boxData);
    if (newBox) {
      await loadBoxes();
      showToast('箱子已新增！');
      setView('home');
    } else {
      showToast('新增失敗', 'warn');
    }
    setSyncing(false);
  };

  const handleDeleteBox = async (boxId) => {
    setSyncing(true);
    await deleteBox(boxId);
    await loadBoxes();
    showToast('箱子已刪除', 'warn');
    setView('home');
    setSyncing(false);
  };

  const handleAddItem = async (boxId, itemData) => {
    setSyncing(true);
    // Convert compressed base64 to Blob for upload
    let photoFile = null;
    if (itemData.photo) {
      photoFile = toBlobUtil(itemData.photo);
    }
    const result = await createItem(boxId, { ...itemData, photoFile });
    if (result) {
      await loadBoxes();
      showToast('物品已新增！');
    } else {
      showToast('新增失敗', 'warn');
    }
    setSyncing(false);
  };

  const handleDeleteItem = async (itemId) => {
    setSyncing(true);
    await deleteItem(itemId);
    await loadBoxes();
    setSyncing(false);
  };

  const handleUpdateBox = async (boxId, updates) => {
    await updateBox(boxId, updates);
    await loadBoxes();
  };

  const openBox = (box) => { setSelectedBox(box); setView('box'); };

  // Search
  const searchResults = search.trim()
    ? boxes.reduce((acc, box) => {
        const s = search.toLowerCase();
        const mi = (box.items || []).filter((i) =>
          i.name.toLowerCase().includes(s) || (i.note && i.note.toLowerCase().includes(s))
        );
        if (box.name.toLowerCase().includes(s) || (box.location || '').toLowerCase().includes(s) || mi.length > 0)
          acc.push({ box, matchItems: mi });
        return acc;
      }, [])
    : [];

  // QR scan handler
  const handleQRResult = useCallback((value) => {
    setScanning(false);
    try {
      const url = new URL(value);
      const boxId = url.searchParams.get('box');
      if (boxId) {
        const found = boxes.find((b) => b.id === boxId);
        if (found) { openBox(found); showToast(`已找到：${found.name}`); return; }
      }
    } catch {}
    const found = boxes.find((b) => b.id === value);
    if (found) { openBox(found); showToast(`已找到：${found.name}`); return; }
    showToast('找不到對應的箱子', 'warn');
  }, [boxes]);

  if (!loaded) {
    return (
      <div className="loading-screen">
        <div style={{ color: '#3B82F6' }}>{Icons.Box()}</div>
        <p style={{ color: '#94A3B8', marginTop: 16 }}>連線資料庫中...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      {scanning && <QRScanner onScan={handleQRResult} onClose={() => setScanning(false)} />}
      <Toast toast={toast} />

      {/* Sync indicator */}
      {syncing && (
        <div className="sync-bar">同步中...</div>
      )}

      {/* Header */}
      <header className="header">
        {view !== 'home' && (
          <button className="back-btn" onClick={() => { setView('home'); setSearch(''); }}>
            <Icons.Back />
          </button>
        )}
        <div style={{ flex: 1 }}>
          <h1 className="title">
            {view === 'home' && '📦 入庫管理'}
            {view === 'box' && selectedBox?.name}
            {view === 'add' && '新增箱子'}
          </h1>
          {view === 'home' && <span className="subtitle">{boxes.length} 個箱子 · ☁️ 雲端同步</span>}
        </div>
      </header>

      {/* Home */}
      {view === 'home' && (
        <div className="content">
          <div className="search-wrap">
            <Icons.Search />
            <input className="search-input" placeholder="搜尋箱子或物品..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button className="clear-btn" onClick={() => setSearch('')}>✕</button>}
          </div>

          <div className="action-row">
            <button className="btn-primary" onClick={() => setView('add')}><Icons.Plus /> 新增箱子</button>
            <button className="btn-outline" onClick={() => setScanning(true)}><Icons.Scan /> 掃描</button>
          </div>

          {search.trim() ? (
            <div>
              <h3 className="section-title">搜尋結果 ({searchResults.length})</h3>
              {searchResults.length === 0 && <p className="muted">找不到相關結果</p>}
              {searchResults.map(({ box, matchItems }) => (
                <div key={box.id} className="list-card" onClick={() => openBox(box)}>
                  <div className="color-dot" style={{ background: box.color || '#3B82F6' }} />
                  <div style={{ flex: 1 }}>
                    <div className="card-name">{box.name}</div>
                    <div className="card-loc">{box.location}</div>
                    {matchItems.length > 0 && (
                      <div className="match-items">
                        {matchItems.map((i) => (
                          <span key={i.id} className="match-chip">{i.photo_url && <Icons.Image />} {i.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="badge">{(box.items || []).length}</span>
                </div>
              ))}
            </div>
          ) : boxes.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 52, marginBottom: 14 }}>📦</div>
              <p className="empty-title">還沒有任何箱子</p>
              <p className="muted">點擊「新增箱子」開始管理你的物品</p>
            </div>
          ) : (
            <div className="box-list">
              {boxes.map((box) => (
                <div key={box.id} className="box-card" onClick={() => openBox(box)}>
                  <div className="box-stripe" style={{ background: box.color || '#3B82F6' }} />
                  <div className="box-body">
                    <div className="box-top">
                      <span className="box-name">{box.name}</span>
                      <span className="badge">{(box.items || []).length}</span>
                    </div>
                    <div className="box-loc">{box.location}</div>
                    <div className="box-preview">
                      <div className="qr-mini"><Icons.QR /> QR</div>
                      {(box.items || []).slice(0, 3).map((i) =>
                        i.photo_url
                          ? <img key={i.id} src={i.photo_url} alt="" className="preview-thumb" />
                          : <span key={i.id} className="preview-chip">{i.name}</span>
                      )}
                      {(box.items || []).length > 3 && <span className="preview-more">+{(box.items || []).length - 3}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'add' && <AddBoxView onAdd={handleAddBox} onCancel={() => setView('home')} syncing={syncing} />}

      {view === 'box' && selectedBox && (
        <BoxDetailView
          box={boxes.find((b) => b.id === selectedBox.id) || selectedBox}
          baseUrl={baseUrl}
          onAddItem={(itemData) => handleAddItem(selectedBox.id, itemData)}
          onDeleteItem={handleDeleteItem}
          onDeleteBox={() => handleDeleteBox(selectedBox.id)}
          onUpdateBox={(u) => handleUpdateBox(selectedBox.id, u)}
          onImageClick={setLightboxSrc}
          syncing={syncing}
        />
      )}
    </div>
  );
}

// ─── Add Box ───
function AddBoxView({ onAdd, onCancel, syncing }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  return (
    <div className="content">
      <div className="card">
        <div className="form-group">
          <label className="label">箱子名稱 *</label>
          <input className="input" placeholder="例：電子零件 A" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label className="label">存放位置</label>
          <input className="input" placeholder="例：鐵櫃第二層" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <p className="hint" style={{ marginBottom: 16 }}>💡 建立後會自動產生 QR Code，列印貼在箱子上即可</p>
        <div className="form-actions">
          <button className="btn-cancel" onClick={onCancel}>取消</button>
          <button className="btn-primary" style={{ opacity: name.trim() && !syncing ? 1 : 0.5 }} onClick={() => name.trim() && !syncing && onAdd({ name: name.trim(), location: location.trim() })} disabled={!name.trim() || syncing}>
            {syncing ? '儲存中...' : '確認新增'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Box Detail ───
function BoxDetailView({ box, baseUrl, onAddItem, onDeleteItem, onDeleteBox, onUpdateBox, onImageClick, syncing }) {
  const [newItem, setNewItem] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newPhoto, setNewPhoto] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const ref = useRef(null);

  const items = box.items || [];

  const handleAdd = async () => {
    if (!newItem.trim() || syncing) return;
    await onAddItem({ name: newItem.trim(), note: newNote.trim(), qty: parseInt(newQty) || 1, photo: newPhoto });
    setNewItem(''); setNewNote(''); setNewQty('1'); setNewPhoto(null);
    ref.current?.focus();
  };

  const hasPhotos = items.some((i) => i.photo_url);

  return (
    <div className="content">
      {/* Box info */}
      <div className="card box-info" style={{ borderLeft: `4px solid ${box.color || '#3B82F6'}` }}>
        <div className="box-info-top">
          <div>
            <div className="box-info-name">{box.name}</div>
            <div className="box-info-loc">{box.location || '未設定位置'}</div>
          </div>
          <span className="badge lg">{items.length} 項</span>
        </div>

        <div className="qr-section">
          <button className="qr-toggle" onClick={() => setShowQR(!showQR)}>
            <Icons.QR /> {showQR ? '收起 QR Code' : '顯示 QR Code'}
          </button>
          {showQR && (
            <div style={{ marginTop: 14 }}>
              <QRCodeDisplay boxId={box.id} boxName={box.name} baseUrl={baseUrl} />
            </div>
          )}
        </div>
      </div>

      {/* Add item */}
      {!showAdd ? (
        <button className="add-item-btn" onClick={() => setShowAdd(true)}>
          <Icons.Plus /> 新增物品
        </button>
      ) : (
        <div className="card add-item-card">
          <PhotoCapture photo={newPhoto} onCapture={setNewPhoto} onRemove={() => setNewPhoto(null)} />
          <input ref={ref} className="input" placeholder="物品名稱 *" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} autoFocus />
          <div className="input-row">
            <input className="input flex-1" placeholder="備註（選填）" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
            <input className="input qty-input" placeholder="數量" value={newQty} onChange={(e) => setNewQty(e.target.value)} type="number" min="1" />
          </div>
          <div className="add-item-actions">
            <button className="btn-ghost" onClick={() => { setShowAdd(false); setNewPhoto(null); }}>取消</button>
            <button className="btn-small-primary" style={{ opacity: newItem.trim() && !syncing ? 1 : 0.5 }} onClick={handleAdd} disabled={!newItem.trim() || syncing}>
              {syncing ? '上傳中...' : '新增'}
            </button>
          </div>
        </div>
      )}

      {/* View toggle */}
      {items.length > 0 && hasPhotos && (
        <div className="view-toggle">
          <button className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>列表</button>
          <button className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>圖片</button>
        </div>
      )}

      {/* Items */}
      {items.length === 0 ? (
        <div className="empty-state"><p className="muted">這個箱子還沒有任何物品</p></div>
      ) : viewMode === 'list' ? (
        <div className="item-list">
          {items.map((item, idx) => (
            <div key={item.id} className="item-row">
              {item.photo_url ? (
                <img src={item.photo_url} alt="" className="item-thumb" onClick={() => onImageClick(item.photo_url)} />
              ) : (
                <div className="item-idx">{idx + 1}</div>
              )}
              <div style={{ flex: 1 }}>
                <div className="item-name">
                  {item.name}
                  {item.qty > 1 && <span className="qty">×{item.qty}</span>}
                </div>
                {item.note && <div className="item-note">{item.note}</div>}
              </div>
              <button className="del-btn" onClick={() => onDeleteItem(item.id)}><Icons.Trash /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="photo-grid">
          {items.map((item) => (
            <div key={item.id} className="photo-grid-item">
              {item.photo_url ? (
                <img src={item.photo_url} alt="" className="photo-grid-img" onClick={() => onImageClick(item.photo_url)} />
              ) : (
                <div className="photo-grid-placeholder">{Icons.Box()}</div>
              )}
              <div className="photo-grid-label">
                <span className="photo-grid-name">{item.name}</span>
                {item.qty > 1 && <span className="qty">×{item.qty}</span>}
              </div>
              <button className="photo-grid-del" onClick={() => onDeleteItem(item.id)}><Icons.Trash /></button>
            </div>
          ))}
        </div>
      )}

      {/* Danger zone */}
      <div className="danger-zone">
        {!confirmDel ? (
          <button className="danger-btn" onClick={() => setConfirmDel(true)}>刪除此箱子</button>
        ) : (
          <div className="confirm-row">
            <span style={{ color: '#EF4444', fontSize: 14 }}>確定刪除？所有物品將一併刪除</span>
            <button className="danger-confirm" onClick={onDeleteBox} disabled={syncing}>確認刪除</button>
            <button className="btn-ghost" onClick={() => setConfirmDel(false)}>取消</button>
          </div>
        )}
      </div>
    </div>
  );
}
