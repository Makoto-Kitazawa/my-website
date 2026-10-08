async function createSharedDataset() {
  if (!shareDatabase) { setShareStatus('Firebase設定が必要です'); return; }
  if (isShareActionPending) return;
  isShareActionPending = true;
  setShareStatus('共有コードを作成中...');
  try {
    let code = createShareCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reference = shareDatabase.collection('sharedDatasets').doc(code);
      try {
        await shareDatabase.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(reference);
          if (snapshot.exists) {
            const error = new Error('共有コードが使用されています');
            error.code = 'already-exists';
            throw error;
          }
          transaction.set(reference, {
            ...readShareMeta(),
            formatVersion: 2,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + SHARE_EXPIRATION_HOURS * 60 * 60 * 1000))
          });
        });
        break;
      } catch (error) {
        if (error?.code !== 'already-exists' || attempt === 4) throw error;
        code = createShareCode();
      }
    }
    activeShareCode = code;
    shareCodeInput.value = code;
    lastSyncedMetaSignature = '';
    lastSyncedColumnValues = [];
    shareReady = true;
    updateShareQuery(code);
    await commitSharedChanges();
    subscribeToSharedDataset();
    try {
      await navigator.clipboard?.writeText(window.location.href);
    } catch (error) {
      console.warn('共有URLをクリップボードへコピーできませんでした', error);
    }
    setShareStatus(`共有中: ${code}`);
  } catch (error) {
    console.error(error);
    setShareStatus(formatShareError(error));
  } finally {
    setTimeout(() => { isShareActionPending = false; }, 1000);
  }
}
function subscribeToSharedDataset() {
  if (!shareDatabase || !activeShareCode) return;
  shareReady = false;
  clearInterval(sharePollTimer);
  fetchSharedDataset();
  sharePollTimer = setInterval(fetchSharedDataset, SHARE_POLL_INTERVAL_MS);
}
async function fetchSharedDataset() {
  if (!shareDatabase || !activeShareCode) return;
  flushPendingRemoteUpdate();
  try {
    const reference = shareDatabase.collection('sharedDatasets').doc(activeShareCode);
    const [snapshot, columnsSnapshot] = await Promise.all([reference.get(), reference.collection('columns').get()]);
    handleSharedSnapshot(snapshot, columnsSnapshot);
  } catch (error) {
    shareReady = false;
    console.error(error);
    setShareStatus(formatShareError(error));
  }
}
function isLocalEditInProgress() {
  const active = document.activeElement;
  if (active && (active.classList?.contains('data-input') || active === datasetName)) return true;
  if (Date.now() - lastLocalEditAt < LOCAL_EDIT_GRACE_MS) return true;
  return hasUnsyncedLocalChanges();
}
function isColumnEditInProgress(column) {
  if (dirtyColumns.has(column)) return true;
  const active = document.activeElement;
  if (active?.classList?.contains('data-input') && getInputColumnIndex(active) === column) return true;
  return Date.now() - lastLocalEditAt < LOCAL_EDIT_GRACE_MS;
}
function setRemoteInputValue(input, value) {
  const text = String(value ?? '');
  if (input === document.activeElement) return;
  if (input.value !== text) input.value = text;
}
function applyRemoteColumn(column, value) {
  const xInputs = [...document.querySelectorAll('.x-value')];
  const yInputs = [...document.querySelectorAll('.y-value')];
  const columns = xInputs.length;
  if (columns === 0 || column >= columns) return false;
  const normalized = normalizeColumnValue(value);
  const measurements = yInputs.length / columns;
  setRemoteInputValue(xInputs[column], normalized.x);
  for (let row = 0; row < measurements; row += 1) setRemoteInputValue(yInputs[row * columns + column], normalized.y[row]);
  lastSyncedColumnValues[column] = getColumnSignature(normalized);
  return true;
}
function applyRemoteStructure(meta, remoteColumns) {
  applyingSharedData = true;
  pointCount.value = meta.pointCount;
  sampleCount.value = meta.sampleCount;
  const x = Array.from({ length: meta.pointCount }, (_, column) => normalizeColumnValue(remoteColumns.get(column)).x);
  const y = Array.from({ length: meta.pointCount }, (_, column) => normalizeColumnValue(remoteColumns.get(column)).y);
  renderInputs({ name: meta.name, x, y });
  applyingSharedData = false;
  markLocalStateSynced();
  shareReady = true;
  setShareStatus(`共有中: ${activeShareCode}`);
}
function flushPendingRemoteUpdate() {
  if (pendingRemoteMeta) {
    if (isLocalEditInProgress()) return;
    const pending = pendingRemoteMeta;
    pendingRemoteMeta = null;
    applyRemoteStructure(pending.meta, pending.columns);
    return;
  }
  let applied = false;
  pendingRemoteColumns.forEach((value, column) => {
    if (isColumnEditInProgress(column)) return;
    if (applyRemoteColumn(column, value)) {
      applied = true;
      pendingRemoteColumns.delete(column);
    }
  });
  if (applied) update();
}
function handleSharedSnapshot(snapshot, columnsSnapshot) {
  if (!snapshot.exists) {
    shareReady = false;
    setShareStatus(`共有コード ${activeShareCode} が見つかりません`);
    return;
  }
  const payload = snapshot.data();
  if (payload?.expiresAt && payload.expiresAt.toDate() < new Date()) {
    shareReady = false;
    setShareStatus(`共有コード ${activeShareCode} の有効期限（1週間）が切れています`);
    return;
  }
  if (applyingSharedData) return;
  const meta = {
    name: payload?.name ?? '',
    pointCount: Math.min(40, Math.max(1, Number.parseInt(payload?.pointCount, 10) || 1)),
    sampleCount: Math.min(12, Math.max(1, Number.parseInt(payload?.sampleCount, 10) || 1))
  };
  const remoteColumns = new Map();
  if (columnsSnapshot && !columnsSnapshot.empty) {
    columnsSnapshot.forEach((doc) => {
      const column = Number.parseInt(doc.id, 10);
      if (Number.isInteger(column) && column >= 0 && column < meta.pointCount) remoteColumns.set(column, normalizeColumnValue(doc.data()));
    });
  } else if (Array.isArray(payload?.x)) {
    const decoded = decodeSharePayload(payload);
    decoded.x.forEach((x, column) => remoteColumns.set(column, normalizeColumnValue({ x, y: decoded.y[column] })));
  }
  if (clampCount(pointCount) !== meta.pointCount || clampCount(sampleCount) !== meta.sampleCount) {
    if (isLocalEditInProgress()) {
      pendingRemoteMeta = { meta, columns: remoteColumns };
      saveSharedDataset();
      setShareStatus(`共有中: ${activeShareCode}（入力を優先するため受信データを保留中）`);
      return;
    }
    applyRemoteStructure(meta, remoteColumns);
    return;
  }
  let applied = false;
  const metaSignature = getMetaSignature(meta);
  if (metaSignature !== lastSyncedMetaSignature && !metaDirty && document.activeElement !== datasetName) {
    datasetName.value = meta.name;
    lastSyncedMetaSignature = metaSignature;
    applied = true;
  }
  remoteColumns.forEach((value, column) => {
    if (getColumnSignature(value) === lastSyncedColumnValues[column]) return;
    if (isColumnEditInProgress(column)) {
      pendingRemoteColumns.set(column, value);
      return;
    }
    if (applyRemoteColumn(column, value)) applied = true;
  });
  if (applied) update();
  shareReady = true;
  setShareStatus(`共有中: ${activeShareCode}`);
}
async function loadSharedDataset() {
  if (isShareActionPending) return;
  const code = shareCodeInput.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 4 || !shareDatabase) {
    setShareStatus(shareDatabase ? '4桁の共有コードを入力してください' : 'Firebase設定が必要です');
    return;
  }
  isShareActionPending = true;
  activeShareCode = code;
  updateShareQuery(code);
  subscribeToSharedDataset();
  setTimeout(() => { isShareActionPending = false; }, 1000);
}
function saveSharedDataset() {
  if (!shareDatabase || !activeShareCode || !shareReady || applyingSharedData) return;
  if (!hasUnsyncedLocalChanges()) return;
  clearTimeout(shareSaveTimer);
  shareSaveTimer = setTimeout(commitSharedChanges, SHARE_SYNC_DEBOUNCE_MS);
}
async function commitSharedChanges() {
  if (!shareDatabase || !activeShareCode || !shareReady) return;
  const meta = readShareMeta();
  const metaSignature = getMetaSignature(meta);
  const metaChanged = metaSignature !== lastSyncedMetaSignature;
  const targetColumns = new Set(dirtyColumns);
  if (metaChanged) for (let column = 0; column < meta.pointCount; column += 1) targetColumns.add(column);
  const updates = [...targetColumns]
    .filter((column) => column >= 0 && column < meta.pointCount)
    .map((column) => ({ column, value: readColumnValue(column) }))
    .filter(({ column, value }) => metaChanged || getColumnSignature(value) !== lastSyncedColumnValues[column]);
  if (!metaChanged && updates.length === 0) {
    dirtyColumns.clear();
    metaDirty = false;
    flushPendingRemoteUpdate();
    return;
  }
  try {
    const reference = shareDatabase.collection('sharedDatasets').doc(activeShareCode);
    const batch = shareDatabase.batch();
    if (metaChanged) {
      batch.set(reference, {
        name: meta.name,
        pointCount: meta.pointCount,
        sampleCount: meta.sampleCount,
        x: firebase.firestore.FieldValue.delete(),
        y: firebase.firestore.FieldValue.delete(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        expiresAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + SHARE_EXPIRATION_HOURS * 60 * 60 * 1000))
      }, { merge: true });
    }
    updates.forEach(({ column, value }) => {
      batch.set(reference.collection('columns').doc(String(column)), {
        x: value.x,
        y: value.y,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
    if (metaChanged) await deleteExcessColumns(reference, meta.pointCount);
    lastSyncedMetaSignature = metaSignature;
    if (getMetaSignature() === metaSignature) metaDirty = false;
    updates.forEach(({ column, value }) => {
      const signature = getColumnSignature(value);
      lastSyncedColumnValues[column] = signature;
      if (getColumnSignature(readColumnValue(column)) === signature) dirtyColumns.delete(column);
    });
    setShareStatus(`共有中: ${activeShareCode}`);
    flushPendingRemoteUpdate();
  } catch (error) {
    console.error(error);
    setShareStatus(formatShareError(error));
  }
}
async function deleteExcessColumns(reference, count) {
  try {
    const snapshot = await reference.collection('columns').get();
    const deletions = snapshot.docs.filter((doc) => {
      const column = Number.parseInt(doc.id, 10);
      return !Number.isInteger(column) || column < 0 || column >= count;
    });
    if (deletions.length === 0) return;
    const batch = shareDatabase.batch();
    deletions.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  } catch (error) {
    console.error(error);
  }
}
