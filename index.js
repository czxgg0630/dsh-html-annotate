// Host 半边：注册只读预览路由。客户端把 iframe 指到这里，页面里的相对链接、
// query、history 都按原生方式工作；批注桥由 serve.js 注进每个 HTML 响应。
import { createPreviewHandler, ROUTE_PREFIX } from './serve.js'

export const name = 'html-annotate'
export const inject = ['webServer']

export function apply(ctx) {
  ctx.inject(['webServer', 'sessions', 'workspaceFiles'], (inner) => {
    inner.effect(() => inner.webServer.register({
      kind: 'prefix',
      path: ROUTE_PREFIX,
      handler: createPreviewHandler({
        sessions: inner.sessions,
        workspaceFiles: inner.workspaceFiles,
        connection: ctx.get('connection'),
      }),
    }))
  })
}
