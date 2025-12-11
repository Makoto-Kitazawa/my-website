// 最終更新日を表示（GitHub API経由で実際のコミット日時を取得）
async function fetchLastUpdated() {
  const el = document.getElementById('lastUpdated');
  if (!el) return;
  
  try {
    // 現在のHTMLファイルのパスを取得
    const path = window.location.pathname.replace(/^\//, '');
    const repo = 'Makoto-Kitazawa/my-website';
    const apiUrl = `https://api.github.com/repos/${repo}/commits?path=${path}&page=1&per_page=1`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error('API error');
    
    const commits = await response.json();
    if (commits.length === 0) throw new Error('No commits');
    
    const commitDate = new Date(commits[0].commit.committer.date);
    const yyyy = commitDate.getFullYear();
    const mm = String(commitDate.getMonth() + 1).padStart(2, '0');
    const dd = String(commitDate.getDate()).padStart(2, '0');
    const hh = String(commitDate.getHours()).padStart(2, '0');
    const min = String(commitDate.getMinutes()).padStart(2, '0');
    
    el.textContent = `最終更新：${yyyy}/${mm}/${dd} ${hh}:${min}`;
  } catch (err) {
    // フォールバック：document.lastModified を使用
    const updated = new Date(document.lastModified);
    const yyyy = updated.getFullYear();
    const mm = String(updated.getMonth() + 1).padStart(2, '0');
    const dd = String(updated.getDate()).padStart(2, '0');
    const hh = String(updated.getHours()).padStart(2, '0');
    const min = String(updated.getMinutes()).padStart(2, '0');
    el.textContent = `最終更新：${yyyy}/${mm}/${dd} ${hh}:${min}`;
  }
}

// DOM読み込み完了後に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fetchLastUpdated);
} else {
  fetchLastUpdated();
}
