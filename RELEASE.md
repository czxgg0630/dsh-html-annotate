# 发布清单（czxgg0630/dsh-html-annotate）

目标：npm 发版 → GitHub 仓库加 `dsh-plugin` topic → 往 awesome-dsh-plugin 提 `data/plugins/czxgg0630__dsh-html-annotate.yml`。

## 1. 仓库与身份

- `package.json`：`name: dsh-html-annotate`、无 `private`、`repository`/`homepage`/`bugs` 指向 `github.com/czxgg0630/dsh-html-annotate`、
  `engines.dsh: ">=0.2.0-0 <0.3.0-0"`（右上界用 `-0`，把下一个预发布版也排除）、`license: MIT` + `LICENSE`（署名 czxgg0630）。
- 改名时四处要同步：`client.js` 的 `window.__ModuleLoader__.load({ id })`、`client.js` 的 `const ID`、`cordis.patch.yml` 的 `name`、
  `test/client.test.cjs` 的模块 id 断言。漏一处就是「装了但 tab 不出现」。

## 2. 本地验证

```bash
cd <插件目录>
node --check client.js
node --test test/
npm pack
```

## 3. 发 npm

```bash
npm login
npm publish --access public
```

## 4. GitHub

```bash
git init && git add -A && git commit -m "feat: 右侧栏 HTML 批注插件 v0.1.0"
git remote add origin git@github.com:czxgg0630/dsh-html-annotate.git
git push -u origin main
gh repo edit --add-topic dsh-plugin
```

## 5. 收录（仓库创建满 1 天后）

在 awesome-dsh-plugin 仓库新建 `data/plugins/czxgg0630__dsh-html-annotate.yml`：

```yaml
url: https://github.com/czxgg0630/dsh-html-annotate
name: czxgg0630/dsh-html-annotate
category: ui
description:
  en: Preview local HTML in the right sidebar, annotate elements or regions, and send the selections with current and target styles into the current session.
  zh: 在右侧栏预览本地 HTML，点选元素或框选区域写批注，把选中项、当前样式与目标样式一起发进当前会话。
```

只提交这一个文件，不要手改 README。

## 6. 不要提交

`node_modules/`、`*.tgz`、`.plugin-manager/`、任何本机 profile 路径。
