import { workspace } from 'vscode'
import * as path from 'path'

export interface DataSchema {
  label: string
  files: { name: string; uri: string }[]
}

export function getWorkspacePath() {
  return workspace.workspaceFolders?.[0].uri.fsPath
}

export function getPathRelativeToWorkspace(filePath: string) {
  const workspacePath = getWorkspacePath()
  return workspacePath && path.isAbsolute(filePath)
    ? path.relative(workspacePath, filePath)
    : filePath
}

export function forceArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

type IdentifierCallback<T> = (item: T) => string
export function list2Map<T extends object>(
  list: T[],
  identifier: T extends Record<string, unknown>
    ? string | IdentifierCallback<T>
    : IdentifierCallback<T>,
) {
  const map: Record<string, T> = {}
  list.forEach((item) => {
    if (identifier instanceof Function) {
      map[identifier(item)] = item
      return
    }
    map[item[identifier]] = item
  })
  return map
}
