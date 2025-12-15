const fs = require('fs');
const path = require('path');

// 設定を読み込み
const config = JSON.parse(fs.readFileSync('tree-config.json', 'utf8'));

// HTMLエスケープ関数（XSS対策）
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 入力値の検証とサニタイズ
function validateAndSanitize(value, type) {
  if (!value || typeof value !== 'string') return '';
  
  // 最大長チェック
  const maxLengths = {
    title: 100,
    category: 50,
    description: 200,
    icon: 10,
    path: 200
  };
  
  const maxLength = maxLengths[type] || 100;
  let sanitized = value.trim().substring(0, maxLength);
  
  // 特定のタイプの追加検証
  if (type === 'icon') {
    // 絵文字と基本的な記号のみ許可（ASCII範囲外の文字を許可）
    // 危険な文字は除外
    if (/<|>|script|javascript:/i.test(sanitized)) {
      return '📄'; // デフォルトアイコン
    }
  }
  
  if (type === 'path') {
    // パスのサニタイズ - 親ディレクトリ参照を防止
    sanitized = sanitized.replace(/\.\./g, '').replace(/^\//, '');
  }
  
  // HTMLタグやスクリプトの検出
  if (/<script|javascript:|on\w+=/i.test(sanitized)) {
    console.warn(`⚠️  Potential XSS detected in ${type}: ${sanitized.substring(0, 50)}`);
    return ''; // 危険な内容は空文字列に
  }
  
  return sanitized;
}

// HTMLファイルからメタタグを読み取る
function extractMetaFromHTML(htmlPath) {
  try {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const meta = {};
    
    // project:title を抽出
    const titleMatch = html.match(/<meta\s+name="project:title"\s+content="([^"]+)"/i);
    if (titleMatch) meta.title = validateAndSanitize(titleMatch[1], 'title');
    
    // project:category を抽出
    const categoryMatch = html.match(/<meta\s+name="project:category"\s+content="([^"]+)"/i);
    if (categoryMatch) meta.category = validateAndSanitize(categoryMatch[1], 'category');
    
    // project:icon を抽出
    const iconMatch = html.match(/<meta\s+name="project:icon"\s+content="([^"]+)"/i);
    if (iconMatch) meta.icon = validateAndSanitize(iconMatch[1], 'icon');
    
    // project:description を抽出
    const descMatch = html.match(/<meta\s+name="project:description"\s+content="([^"]+)"/i);
    if (descMatch) meta.description = validateAndSanitize(descMatch[1], 'description');
    
    return meta;
  } catch (error) {
    console.error(`Error reading HTML file ${htmlPath}:`, error.message);
    return {};
  }
}

// ディレクトリを再帰的に走査
function scanDirectory(dir, basePath = '') {
  const items = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(basePath, entry.name);
      
      // 除外ルールチェック
      if (config.exclude.includes(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;
      
      if (entry.isDirectory()) {
        // index.htmlが存在するディレクトリのみ
        const indexPath = path.join(fullPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          // HTMLから自動抽出
          const htmlMeta = extractMetaFromHTML(indexPath);
          // config.jsonの値をフォールバックとして使用
          const configMeta = config.metadata[entry.name] || {};
          
          items.push({
            type: 'page',
            name: entry.name,
            path: relativePath + '/index.html',
            title: htmlMeta.title || configMeta.title || entry.name,
            category: htmlMeta.category || configMeta.category || 'その他',
            icon: htmlMeta.icon || configMeta.icon || '📄',
            description: htmlMeta.description || configMeta.description || ''
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error.message);
  }
  
  return items;
}

// カテゴリごとにグループ化
function groupByCategory(items) {
  const groups = {};
  for (const item of items) {
    if (item.type === 'page') {
      const cat = item.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
  }
  return groups;
}

// HTMLを生成
function generateTreeHTML(groups) {
  let html = '';
  
  html += '      <li>\n';
  html += '        <div class="node">\n';
  html += '          <span class="icon">📦</span>\n';
  html += '          <a class="entry" href="./">\n';
  html += '            <span>root</span>\n';
  html += '            <span class="tag green">workspace</span>\n';
  html += '            <span class="meta">/</span>\n';
  html += '          </a>\n';
  html += '        </div>\n';
  html += '        <ul class="children">\n';
  
  for (const category of config.categoryOrder) {
    if (!groups[category] || groups[category].length === 0) continue;
    
    html += '          <li>\n';
    html += '            <div class="node">\n';
    html += '              <span class="icon">🗂️</span>\n';
    html += '              <a class="entry" href="#">\n';
    html += `                <span>${escapeHTML(category)}</span>\n`;
    html += '                <span class="tag purple">module</span>\n';
    html += '                <span class="meta">/src</span>\n';
    html += '              </a>\n';
    html += '            </div>\n';
    html += '            <ul class="children">\n';
    
    for (const item of groups[category]) {
      // パスの検証とサニタイズ
      const safePath = validateAndSanitize(item.path, 'path');
      
      html += '              <li>\n';
      html += '                <div class="node">\n';
      html += `                  <span class="icon">${escapeHTML(item.icon)}</span>\n`;
      html += `                  <a class="entry" href="${escapeHTML(safePath)}" target="_blank">\n`;
      html += `                    <span>${escapeHTML(item.title)}</span>\n`;
      html += '                  </a>\n';
      html += '                </div>\n';
      html += '              </li>\n';
    }
    
    html += '            </ul>\n';
    html += '          </li>\n';
  }
  
  // その他のリンク
  if (config.otherLinks && config.otherLinks.length > 0) {
    html += '          <li>\n';
    html += '            <div class="node">\n';
    html += '              <span class="icon">🗂️</span>\n';
    html += '              <a class="entry" href="#">\n';
    html += '                <span>その他</span>\n';
    html += '                <span class="meta">/etc</span>\n';
    html += '              </a>\n';
    html += '            </div>\n';
    html += '            <ul class="children">\n';
    
    for (const link of config.otherLinks) {
      const target = link.external ? ' target="_blank"' : '';
      html += '              <li>\n';
      html += '                <div class="node">\n';
      html += `                  <span class="icon">${escapeHTML(link.icon)}</span>\n`;
      html += `                  <a class="entry" href="${escapeHTML(link.url)}"${target}>\n`;
      html += `                    <span>${escapeHTML(link.title)}</span>\n`;
      html += '                  </a>\n';
      html += '                </div>\n';
      html += '              </li>\n';
    }
    
    html += '            </ul>\n';
    html += '          </li>\n';
  }
  
  html += '        </ul>\n';
  html += '      </li>\n';
  
  return html;
}

// メイン処理
console.log('🔍 Scanning directories...');
const tree = scanDirectory('.');
console.log(`   Found ${tree.length} pages`);

console.log('📊 Grouping by category...');
const groups = groupByCategory(tree);
for (const [cat, items] of Object.entries(groups)) {
  console.log(`   ${cat}: ${items.length} items`);
}

// tree-config.jsonのmetadataセクションを最新のHTMLメタ情報で更新
console.log('🔄 Updating tree-config.json metadata...');
const updatedMetadata = {};
for (const item of tree) {
  if (item.type === 'page') {
    updatedMetadata[item.name] = {
      title: item.title,
      category: item.category,
      icon: item.icon,
      description: item.description
    };
  }
}

// 既存のconfigを更新
config.metadata = updatedMetadata;

// tree-config.jsonに書き戻し
fs.writeFileSync('tree-config.json', JSON.stringify(config, null, 2));
console.log('✅ tree-config.json updated successfully!');

console.log('🔨 Generating HTML...');
const treeHTML = generateTreeHTML(groups);

// テンプレートと結合
const template = fs.readFileSync('index.template.html', 'utf8');
let finalHTML = template.replace('{{TREE}}', treeHTML);
finalHTML = finalHTML.replace('{{VERSION}}', config.version);
finalHTML = finalHTML.replace('{{ROOT_LABEL}}', config.rootLabel);

fs.writeFileSync('index.html', finalHTML);
console.log('✅ index.html generated successfully!');
console.log(`   Version: ${config.version}`);
