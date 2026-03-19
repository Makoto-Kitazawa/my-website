# tree-config.json メタデータ同期ガイド

このドキュメントは、`tree-config.json`と各ディレクトリの`index.html`のメタタグの対応を記録しています。
JSONファイルを更新する際は、このガイドに従って対応する`index.html`のメタタグも確認してください。

## メタデータ対応表

| フォルダ名 | index.html パス | title | category | icon | description | status |
|-----------|----------------|-------|----------|------|-------------|--------|
| 01_soundwave | `01_soundwave/index.html` | `project:title` メタタグ | `project:category` | `project:icon` | `project:description` | - |
| 02_soundsource | `02_soundsource/index.html` | `project:title` メタタグ | `project:category` | `project:icon` | `project:description` | - |
| 03_2wave-anime | `03_2wave-anime/index.html` | `project:title` メタタグ | `project:category` | `project:icon` | `project:description` | - |
| 04_beatanime | `04_beatanime/index.html` | `project:title` メタタグ | `project:category` | `project:icon` | `project:description` | - |
| 05_doppler-effect | `05_doppler-effect/index.html` | `project:title` メタタグ | `project:category` | `project:icon` | `project:description` | - |
| 06_displacement | `06_displacement/index.html` | `project:title` メタタグ | `project:category` | `project:icon` | `project:description` | - |
| 07_g-acceleration | `07_g-acceleration/index.html` | `project:title` メタタグ | `project:category` | `project:icon` | `project:description` | - |
| 08_fizeau-ex | `08_fizeau-ex/index.html` | `project:title` メタタグ | `project:category` | `project:icon` | `project:description` | - |
| 09_lens | `09_lens/index.html` | `project:title` メタタグ | `project:category` | `project:icon` | `project:description` | - |

## メタタグの確認方法

各`index.html`の`<head>`セクションで以下のメタタグを確認してください：

```html
<meta name="project:title" content="...">
<meta name="project:category" content="...">
<meta name="project:icon" content="...">
<meta name="project:description" content="...">
```

## 更新手順

新しいプロジェクトを追加する場合：

1. 新しいフォルダ（例：`10_new-project/`）を作成
2. `index.html`に以下のメタタグを追加：
   ```html
   <meta name="project:title" content="プロジェクトタイトル">
   <meta name="project:category" content="物理用ファイル">
   <meta name="project:icon" content="🔬">
   <meta name="project:description" content="説明テキスト">
   ```
3. `tree-config.json`の`metadata`セクションに対応するエントリを追加
4. このドキュメントの対応表に追加行を記入

## 準備中プロジェクト

`status: "preparing"` を持つプロジェクトは、slide-menuで非アクティブ表示になります。
完成後は`status`フィールドを削除してください。

