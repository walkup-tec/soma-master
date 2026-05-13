/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// Manually generated route tree (TanStack auto-generation didn't run in this env).

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as LoginRouteImport } from './routes/login'
import { Route as AppRouteImport } from './routes/_app'
import { Route as AppIndexRouteImport } from './routes/_app/index'
import { Route as AppClientesRouteImport } from './routes/_app/clientes'
import { Route as AppClientesNovoRouteImport } from './routes/_app/clientes.novo'
import { Route as AppPropostasRouteImport } from './routes/_app/propostas'
import { Route as AppRemarketingRouteImport } from './routes/_app/remarketing'
import { Route as AppAgendaRouteImport } from './routes/_app/agenda'
import { Route as AppDocumentosRouteImport } from './routes/_app/documentos'
import { Route as AppRelatoriosRouteImport } from './routes/_app/relatorios'
import { Route as AppWhatsappRouteImport } from './routes/_app/whatsapp'
import { Route as AppConfiguracoesRouteImport } from './routes/_app/configuracoes'

const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRouteImport,
} as any)

const LoginRoute = LoginRouteImport.update({
  id: '/login',
  path: '/login',
  getParentRoute: () => rootRouteImport,
} as any)

const AppRoute = AppRouteImport.update({
  id: '/_app',
  getParentRoute: () => rootRouteImport,
} as any)

const AppIndexRoute = AppIndexRouteImport.update({
  id: '/',
  path: '/app',
  getParentRoute: () => AppRoute,
} as any)

const AppClientesRoute = AppClientesRouteImport.update({
  id: '/clientes',
  path: '/app/clientes',
  getParentRoute: () => AppRoute,
} as any)

const AppClientesNovoRoute = AppClientesNovoRouteImport.update({
  id: '/clientes/novo',
  path: '/app/clientes/novo',
  getParentRoute: () => AppRoute,
} as any)

const AppPropostasRoute = AppPropostasRouteImport.update({
  id: '/propostas',
  path: '/app/propostas',
  getParentRoute: () => AppRoute,
} as any)

const AppRemarketingRoute = AppRemarketingRouteImport.update({
  id: '/remarketing',
  path: '/app/remarketing',
  getParentRoute: () => AppRoute,
} as any)

const AppAgendaRoute = AppAgendaRouteImport.update({
  id: '/agenda',
  path: '/app/agenda',
  getParentRoute: () => AppRoute,
} as any)

const AppDocumentosRoute = AppDocumentosRouteImport.update({
  id: '/documentos',
  path: '/app/documentos',
  getParentRoute: () => AppRoute,
} as any)

const AppRelatoriosRoute = AppRelatoriosRouteImport.update({
  id: '/relatorios',
  path: '/app/relatorios',
  getParentRoute: () => AppRoute,
} as any)

const AppWhatsappRoute = AppWhatsappRouteImport.update({
  id: '/whatsapp',
  path: '/app/whatsapp',
  getParentRoute: () => AppRoute,
} as any)

const AppConfiguracoesRoute = AppConfiguracoesRouteImport.update({
  id: '/configuracoes',
  path: '/app/configuracoes',
  getParentRoute: () => AppRoute,
} as any)

interface AppRouteChildren {
  AppIndexRoute: typeof AppIndexRoute
  AppClientesRoute: typeof AppClientesRoute
  AppClientesNovoRoute: typeof AppClientesNovoRoute
  AppPropostasRoute: typeof AppPropostasRoute
  AppRemarketingRoute: typeof AppRemarketingRoute
  AppAgendaRoute: typeof AppAgendaRoute
  AppDocumentosRoute: typeof AppDocumentosRoute
  AppRelatoriosRoute: typeof AppRelatoriosRoute
  AppWhatsappRoute: typeof AppWhatsappRoute
  AppConfiguracoesRoute: typeof AppConfiguracoesRoute
}

const AppRouteChildren: AppRouteChildren = {
  AppIndexRoute,
  AppClientesRoute,
  AppClientesNovoRoute,
  AppPropostasRoute,
  AppRemarketingRoute,
  AppAgendaRoute,
  AppDocumentosRoute,
  AppRelatoriosRoute,
  AppWhatsappRoute,
  AppConfiguracoesRoute,
}

const AppRouteWithChildren = AppRoute._addFileChildren(AppRouteChildren)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/app': typeof AppIndexRoute
  '/app/clientes': typeof AppClientesRoute
  '/app/clientes/novo': typeof AppClientesNovoRoute
  '/app/propostas': typeof AppPropostasRoute
  '/app/remarketing': typeof AppRemarketingRoute
  '/app/agenda': typeof AppAgendaRoute
  '/app/documentos': typeof AppDocumentosRoute
  '/app/relatorios': typeof AppRelatoriosRoute
  '/app/whatsapp': typeof AppWhatsappRoute
  '/app/configuracoes': typeof AppConfiguracoesRoute
}
export interface FileRoutesByTo extends FileRoutesByFullPath {}
export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/_app': typeof AppRouteWithChildren
  '/_app/': typeof AppIndexRoute
  '/_app/clientes': typeof AppClientesRoute
  '/_app/clientes/novo': typeof AppClientesNovoRoute
  '/_app/propostas': typeof AppPropostasRoute
  '/_app/remarketing': typeof AppRemarketingRoute
  '/_app/agenda': typeof AppAgendaRoute
  '/_app/documentos': typeof AppDocumentosRoute
  '/_app/relatorios': typeof AppRelatoriosRoute
  '/_app/whatsapp': typeof AppWhatsappRoute
  '/_app/configuracoes': typeof AppConfiguracoesRoute
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths:
    | '/'
    | '/login'
    | '/app'
    | '/app/clientes'
    | '/app/clientes/novo'
    | '/app/propostas'
    | '/app/remarketing'
    | '/app/agenda'
    | '/app/documentos'
    | '/app/relatorios'
    | '/app/whatsapp'
    | '/app/configuracoes'
  fileRoutesByTo: FileRoutesByTo
  to:
    | '/'
    | '/login'
    | '/app'
    | '/app/clientes'
    | '/app/clientes/novo'
    | '/app/propostas'
    | '/app/remarketing'
    | '/app/agenda'
    | '/app/documentos'
    | '/app/relatorios'
    | '/app/whatsapp'
    | '/app/configuracoes'
  id:
    | '__root__'
    | '/'
    | '/login'
    | '/_app'
    | '/_app/'
    | '/_app/clientes'
    | '/_app/clientes/novo'
    | '/_app/propostas'
    | '/_app/remarketing'
    | '/_app/agenda'
    | '/_app/documentos'
    | '/_app/relatorios'
    | '/_app/whatsapp'
    | '/_app/configuracoes'
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  LoginRoute: typeof LoginRoute
  AppRoute: typeof AppRouteWithChildren
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/login': {
      id: '/login'
      path: '/login'
      fullPath: '/login'
      preLoaderRoute: typeof LoginRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/_app': {
      id: '/_app'
      path: ''
      fullPath: ''
      preLoaderRoute: typeof AppRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/_app/': {
      id: '/_app/'
      path: '/app'
      fullPath: '/app'
      preLoaderRoute: typeof AppIndexRouteImport
      parentRoute: typeof AppRoute
    }
    '/_app/clientes': {
      id: '/_app/clientes'
      path: '/app/clientes'
      fullPath: '/app/clientes'
      preLoaderRoute: typeof AppClientesRouteImport
      parentRoute: typeof AppRoute
    }
    '/_app/clientes/novo': {
      id: '/_app/clientes/novo'
      path: '/app/clientes/novo'
      fullPath: '/app/clientes/novo'
      preLoaderRoute: typeof AppClientesNovoRouteImport
      parentRoute: typeof AppRoute
    }
    '/_app/propostas': {
      id: '/_app/propostas'
      path: '/app/propostas'
      fullPath: '/app/propostas'
      preLoaderRoute: typeof AppPropostasRouteImport
      parentRoute: typeof AppRoute
    }
    '/_app/remarketing': {
      id: '/_app/remarketing'
      path: '/app/remarketing'
      fullPath: '/app/remarketing'
      preLoaderRoute: typeof AppRemarketingRouteImport
      parentRoute: typeof AppRoute
    }
    '/_app/agenda': {
      id: '/_app/agenda'
      path: '/app/agenda'
      fullPath: '/app/agenda'
      preLoaderRoute: typeof AppAgendaRouteImport
      parentRoute: typeof AppRoute
    }
    '/_app/documentos': {
      id: '/_app/documentos'
      path: '/app/documentos'
      fullPath: '/app/documentos'
      preLoaderRoute: typeof AppDocumentosRouteImport
      parentRoute: typeof AppRoute
    }
    '/_app/relatorios': {
      id: '/_app/relatorios'
      path: '/app/relatorios'
      fullPath: '/app/relatorios'
      preLoaderRoute: typeof AppRelatoriosRouteImport
      parentRoute: typeof AppRoute
    }
    '/_app/whatsapp': {
      id: '/_app/whatsapp'
      path: '/app/whatsapp'
      fullPath: '/app/whatsapp'
      preLoaderRoute: typeof AppWhatsappRouteImport
      parentRoute: typeof AppRoute
    }
    '/_app/configuracoes': {
      id: '/_app/configuracoes'
      path: '/app/configuracoes'
      fullPath: '/app/configuracoes'
      preLoaderRoute: typeof AppConfiguracoesRouteImport
      parentRoute: typeof AppRoute
    }
  }
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute,
  LoginRoute,
  AppRoute: AppRouteWithChildren,
}
export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()
