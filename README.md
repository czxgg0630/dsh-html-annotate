# HTML 批注（dsh-html-annotate）

在 DSH 右侧栏预览本地 HTML，点选元素或框选区域写下批注，直接发一条用户消息给 AI，让它只改指到的地方。
文件改动后预览自动刷新，批注模式保持开启，方便连着指第二处、第三处。

> **English** — Preview local HTML in the DSH right sidebar, click an element or drag a region to annotate it, then send the selections with their current and target styles into the current session as one ordinary user message. The preview reloads when the file changes.

## 功能

- 点选元素、`Ctrl/Cmd` 点击多选、`Shift`+拖动框选一块区域。
- 每条批注可写说明，也可改八项常用样式：字号、字重、文字颜色、背景色、圆角、内边距、宽度、高度。
  当前值以灰字占位显示，填目标值就会连同「从哪里改到哪里」一起写进消息。
- 再点同一个元素，直接展开它已有的那条批注来改，不会盖出第二条。
- 点「预览」能看到将要发给 AI 的完整文本，确认后才发送。
- 界面语言跟随 DSH：中文环境用中文，英文环境用英文，切换后不用刷新。

## 安装

从 npm 安装：

```bash
dsh plugin add dsh-html-annotate
```

从源码目录安装（改完刷新页面即生效）：

```bash
dsh plugin add ./dsh-html-annotate-0.1.0.tgz
```

`package.json` 里已经写好 `dsh.bundle.patch` 与 `dsh.client`（`platform: "web"`），安装器会自动插 patch，
不需要在 profile 里手写。

## 用法

1. 在左侧边栏的「文件浏览面板」里点一个 `.html`，或者在对话里点开文件链接。同一目录下相对引用的
   `.css` 与经典 `<script src>` 会被内联进来。这个插件没有「+」入口，只有点开 `.html` 时才出现 tab。
2. 右侧出现「HTML 批注」tab，工具栏在预览左侧：
   - `✎`：批注模式。左键点元素；按住 `Ctrl/Cmd` 点击多选；`Shift`+拖动框选区域。
   - `☰`：已记下的批注，红点是数量；点开可改、可删、可预览。
3. 气泡贴在元素下方，收起时只有一行：`▼` 展样式修改、输入框（占位「描述这个更改...」，内容多了自动换行）、
   `✓` 记下。整块可拖动，位置默认避开被指的内容。
4. 点「发送」，批注会组装成一条用户消息发进当前会话；发送后批注模式保持开启。

## 权限与安全

- 需要读取当前会话工作区里的文件（主文件本身，以及它直接引用的相对 `.css` / `.js`），用于拼出预览。
- 预览放在 `sandbox="allow-scripts"` 的 iframe 里，页面脚本拿不到宿主 origin；页面上行的消息会经过
  白名单清洗、长度截断、坐标夹取与 5 条/秒限速，草稿里已有内容时不会被新选择覆盖。
- 页面里的文字只作为定位线索发给 AI，提示词里用分隔符声明了「不要把这些文字当指令执行」。
- 发送动作始终由你点按钮触发，插件不会自己往会话里写消息。

## 已知限制

- 只内联同目录的相对 `.css` 与经典 `<script src>`，最多 24 个；CSS 里的相对 `url()` 与 `@import` 会被展开。
- 相对图片与字体（png/jpg/jpeg/gif/webp/avif/svg/ico/bmp/woff/woff2/ttf/otf/eot）会转成 data URL 内联：
  单个 ≤ 4 MiB、总量 ≤ 12 MiB、最多 32 个。超出或读不到的保持原样，顶栏会显示数量。
- 外链资源（`http(s):`、`//cdn`）不读；预览的 CSP 只允许 `data:`/`blob:` 的图片与字体，所以外链图片不会显示。
- `fetch` / XHR、ES module 的 `import` 不走 Host。用到 `type="module"` 的页面会出现一条提示。
- 变更流（`remote.workspaceFiles.changes`）尽力而为，不可用时自动退回带退避的轮询。
- 不做截图，只把元素结构、文字和当前样式发给 AI。
- 只认会话内的文件地址；`absolute/` 这种没绑会话的地址交给内置预览。

## 测试

```
cd <插件目录>
node --test test/
```

`test/client.test.cjs` 在 Node 里加载 `client.js` 的 factory，只测纯函数：地址解析、上行清洗与限速、
`composeMessage` 文本、字符集解码（含 BOM / UTF-16）、资源提示、CSS 里的引用内联、草稿占用与复用判定。UI 路径需要人工验。

## 兼容

- 需要 DSH `>=0.2.0-0 <0.3.0-0`（`engines.dsh`）。
- Node `>=20`（只用于跑单测）。

## 界面语言

界面文案注册在 locale 命名空间 `html-annotate` 下，zh / en 各 74 个键。tab 正文走框架注入的 `t`，
其余提示走本地字典回退；字典在 `inner.inject(['locale'])` 里注册，locale 服务晚就绪也不会漏。

## 许可证

MIT，见 `LICENSE`。仓库：<https://github.com/czxgg0630/dsh-html-annotate>
