export interface NovelProject {
  id: string
  title: string
  globalSetting: string
  chapterOutline: string
  chapterDraft: string
}

export interface LayoutState {
  activeNovelId: string
  sidebarCollapsed: boolean
  contextPaneWidth: number
}
