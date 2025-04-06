# Wiki.js MCP Server

このMCP (Model Context Protocol) サーバーは、Claude DesktopがWiki.jsと対話するためのインターフェースを提供します。Wiki.jsのページを一覧表示、読み取り、作成、更新するための機能を実装しています。

## 機能

* **ページ一覧の取得**: Wiki.jsのページを一覧表示
* **ページ内容の取得**: 特定のページの内容を取得
* **ページの作成**: 新しいページを作成
* **ページの更新**: 既存のページを更新

## インストール

```bash
npm install -g wikimcp
```

## セットアップ

### Wiki.js APIトークンの取得

1. Wiki.jsの管理画面にログイン
2. 「管理」→「APIアクセス」に移動
3. 新しいAPIトークンを作成（ページへの読み書き権限を付与）

### Claude Desktopでの使用

`claude_desktop_config.json`に以下を追加:

```json
{
  "mcpServers": {
    "wiki": {
      "command": "npx",
      "args": ["-y", "wikimcp"],
      "env": {
        "WIKI_API_URL": "https://your-wiki-instance.com",
        "WIKI_API_TOKEN": "your_api_token_here"
      }
    }
  }
}
```

## 使用例

### ページ一覧の取得
```
"wiki_list_pagesで、すべてのページを一覧表示して"
"wiki_list_pagesで最新10件のページを日付順に取得して"
```

### ページ内容の取得
```
"wiki_get_pageで、ID「15」のページを読み取って"
"wiki_get_pageで、パス「/home」のページを読み取って"
```

### ページの作成
```
"wiki_create_pageで、パス「/新しいページ」、タイトル「新しいページ」、内容「これは新しいページです。」のページを作成して"
```

### ページの更新
```
"wiki_update_pageで、ID「15」のページの内容を「更新された内容です。」に更新して"
"wiki_update_pageで、パス「/home」のページのタイトルを「ホームページ」に変更して"
```
