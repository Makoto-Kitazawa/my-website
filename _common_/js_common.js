// 最終更新日を表示
const updated = new Date(document.lastModified);
const yyyy = updated.getFullYear();
const mm = String(updated.getMonth() + 1).padStart(2, '0');
const dd = String(updated.getDate()).padStart(2, '0');
const hh = String(updated.getHours()).padStart(2, '0');
const min = String(updated.getMinutes()).padStart(2, '0');
document.getElementById('lastUpdated').textContent = `最終更新：${yyyy}/${mm}/${dd} ${hh}:${min}`;
