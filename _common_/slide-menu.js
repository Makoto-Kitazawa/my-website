/**
 * スライド式メニューシステム
 * tree-config.json から動的にメニューを生成
 */

async function initSlideMenu() {
  // tree-config.json を取得
  let config = {};
  try {
    // ドキュメントのベースパスを取得
    const basePath = document.querySelector('base')?.href || window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    
    // ルート相対パスでtree-config.jsonを取得
    // GitHub Pagesでも、ローカルサーバーでも動作する
    const configPath = new URL('/tree-config.json', basePath).href;
    
    const response = await fetch(configPath);
    if (!response.ok) {
      // フォールバック: 相対パスで再度試行
      const relativeResponse = await fetch('../tree-config.json');
      if (!relativeResponse.ok) throw new Error('Failed to load config');
      config = await relativeResponse.json();
    } else {
      config = await response.json();
    }
  } catch (err) {
    console.warn('Failed to load tree-config.json, using defaults:', err);
    config = {
      metadata: {},
      otherLinks: [],
      rootLabel: 'Physics Project'
    };
  }
  
  // メニューボタンと背景を作成
  const menuBtn = document.createElement('button');
  menuBtn.id = 'slide-menu-toggle';
  menuBtn.className = 'slide-menu-toggle';
  menuBtn.setAttribute('aria-label', 'メニューを開く');
  menuBtn.setAttribute('aria-expanded', 'false');
  
  const menuOverlay = document.createElement('div');
  menuOverlay.id = 'slide-menu-overlay';
  menuOverlay.className = 'slide-menu-overlay';
  
  const menuPanel = document.createElement('nav');
  menuPanel.id = 'slide-menu-panel';
  menuPanel.className = 'slide-menu-panel';
  menuPanel.setAttribute('aria-label', 'ナビゲーション');
  
  // メニューコンテンツを作成
  const menuContent = document.createElement('div');
  menuContent.className = 'slide-menu-content';
  
  // タイトル
  const menuTitle = document.createElement('h2');
  menuTitle.textContent = config.rootLabel || 'Physics Project';
  menuContent.appendChild(menuTitle);
  
  // ホームへのリンク
  const homeLink = document.createElement('a');
  homeLink.href = '../index.html';
  homeLink.className = 'slide-menu-item';
  homeLink.innerHTML = '🏠 ホーム';
  menuContent.appendChild(homeLink);
  
  // プロジェクトリスト
  if (Object.keys(config.metadata).length > 0) {
    const projectsTitle = document.createElement('h3');
    projectsTitle.textContent = 'プロジェクト';
    menuContent.appendChild(projectsTitle);
    
    const projectsList = document.createElement('ul');
    projectsList.className = 'slide-menu-list';
    
    // metadata オブジェクトをループして、フォルダ名をキーとして使用
    for (const [folderName, projectInfo] of Object.entries(config.metadata)) {
      // フォルダ名からパスを構築
      // フォルダ名が "soundwave" なら "../01_soundwave/index.html" など
      const folderPath = getProjectPath(folderName);
      
      const listItem = document.createElement('li');
      const link = document.createElement('a');
      link.href = folderPath;
      link.className = 'slide-menu-item project-link';
      link.innerHTML = `${projectInfo.icon} ${projectInfo.title}`;
      listItem.appendChild(link);
      projectsList.appendChild(listItem);
    }
    
    menuContent.appendChild(projectsList);
  }
  
  // その他のリンク
  if (config.otherLinks && config.otherLinks.length > 0) {
    const otherTitle = document.createElement('h3');
    otherTitle.textContent = 'その他';
    menuContent.appendChild(otherTitle);
    
    const otherList = document.createElement('ul');
    otherList.className = 'slide-menu-list';
    
    config.otherLinks.forEach(linkInfo => {
      const listItem = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'slide-menu-item';
      link.innerHTML = `${linkInfo.icon} ${linkInfo.title}`;
      
      if (linkInfo.external || linkInfo.url.startsWith('http')) {
        link.href = linkInfo.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      } else {
        link.href = linkInfo.url;
      }
      
      listItem.appendChild(link);
      otherList.appendChild(listItem);
    });
    
    menuContent.appendChild(otherList);
  }
  
  menuPanel.appendChild(menuContent);
  
  // DOMに追加
  document.body.appendChild(menuBtn);
  document.body.appendChild(menuOverlay);
  document.body.appendChild(menuPanel);
  
  // イベントリスナーを設定
  menuBtn.addEventListener('click', () => {
    const isOpen = menuBtn.getAttribute('aria-expanded') === 'true';
    setMenuState(!isOpen);
  });
  
  menuOverlay.addEventListener('click', () => {
    setMenuState(false);
  });
  
  // メニュー内のリンククリックでメニューを閉じる
  const menuLinks = menuContent.querySelectorAll('a');
  menuLinks.forEach(link => {
    link.addEventListener('click', () => {
      // 外部リンクでない場合、メニューを閉じる
      if (!link.target || link.target !== '_blank') {
        setMenuState(false);
      }
    });
  });
  
  // キーボード対応（Escapeキーでメニューを閉じる）
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setMenuState(false);
    }
  });
  
  // タッチデバイスのスワイプでメニューを閉じる
  let touchStartX = 0;
  let touchEndX = 0;
  
  menuPanel.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });
  
  menuPanel.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    if (touchStartX - touchEndX > 50) {
      setMenuState(false);
    }
  });
  
  function setMenuState(isOpen) {
    const btn = document.getElementById('slide-menu-toggle');
    const overlay = document.getElementById('slide-menu-overlay');
    const panel = document.getElementById('slide-menu-panel');
    
    if (isOpen) {
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'メニューを閉じる');
      overlay.classList.add('visible');
      panel.classList.add('open');
    } else {
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'メニューを開く');
      overlay.classList.remove('visible');
      panel.classList.remove('open');
    }
  }
}

/**
 * メタデータキーからプロジェクトパスを生成
 * "soundwave" -> "../01_soundwave/index.html"
 */
function getProjectPath(folderName) {
  // フォルダ名パターンマッピング
  const folderMap = {
    'soundwave': '01_soundwave',
    'soundsource': '02_soundsource',
    '2wave-anime': '03_2wave-anime',
    'beatanime': '04_beatanime',
    'doppler-effect': '05_doppler-effect'
  };
  
  const folder = folderMap[folderName] || folderName;
  return `../${folder}/index.html`;
}

// DOMが読み込まれたら初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSlideMenu);
} else {
  initSlideMenu();
}
