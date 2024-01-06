import {
  EventEmitter,
  Uri,
  type CancellationToken,
  type ProviderResult,
  type TreeDataProvider,
  type TreeItem,
} from 'vscode'
import type { DataSchema } from '../common'
import { getPathRelativeToWorkspace } from '../common'
import { logger } from '../logger'
import { ChangelistEntry, ChangelistFileEntry, type TreeEntry } from './entry'

export class ChangelistTreeDataProvider implements TreeDataProvider<TreeEntry> {
  private changelists: ChangelistEntry[] = []

  private onDidChangeTreeDataEmitter = new EventEmitter<TreeEntry | undefined>()
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event

  constructor(data: DataSchema[]) {
    for (const schema of data) {
      const changelist = new ChangelistEntry(schema.label, [])
      changelist.items.push(
        ...(schema.files ?? []).map(
          (file) => new ChangelistFileEntry(file.name, Uri.parse(file.uri), changelist),
        ),
      )
      this.changelists.push(changelist)
    }

    if (this.changelists.length) {
      logger.appendLine(`Loaded: ${this.changelists.length} changelists`)
      this.refresh()
    }
  }

  getChildren(element?: TreeEntry | undefined): TreeEntry[] {
    if (element) {
      return element instanceof ChangelistEntry ? element.items : []
    } else {
      return this.changelists
    }
  }
  getParent?(_element: TreeEntry): ProviderResult<TreeEntry> {
    throw new Error('Method not implemented.')
  }
  resolveTreeItem?(
    _item: TreeItem,
    _element: TreeEntry,
    _token: CancellationToken,
  ): ProviderResult<TreeItem> {
    throw new Error('Method not implemented.')
  }

  getTreeItem(element: TreeEntry) {
    return element
  }

  public getChangelists() {
    return this.changelists
  }

  public addChangelist(name: string) {
    const entry = new ChangelistEntry(name, [])

    this.changelists.push(entry)
    this.refresh()

    logger.appendLine(
      `New changelist "${name}" created!\nTotal changelists: ${this.changelists.length}`,
    )
  }

  public removeChangelist(name: string, ifDelete = true) {
    const changelist = this.changelists.find((changelist) => changelist.label === name)

    if (ifDelete) {
      this.changelists = this.changelists.filter((changelist) => changelist.label !== name)
      this.refresh()
      logger.appendLine(
        `Changelist "${name}" removed!\nTotal changelists: ${this.changelists.length}`,
      )
    }

    return changelist?.items ?? []
  }

  public renameChangelist(changelistName: ChangelistEntry | string, newName: string) {
    const changelist =
      typeof changelistName === 'string'
        ? this.changelists.find((changelist) => changelist.label === changelistName)
        : changelistName
    if (!changelist) {
      return
    }

    const index = this.changelists.indexOf(changelist)
    const updatedChangelist = new ChangelistEntry(newName, changelist.items)
    this.changelists.splice(index, 1, updatedChangelist)
    this.refresh()

    logger.appendLine(
      `Changelist "${
        typeof changelistName === 'string' ? changelistName : changelistName.label
      }" renamed to "${newName}"!`,
    )
  }

  public addFileToChangelist(changelistName: string, fileUris: Uri[]) {
    const changelist = this.changelists.find((changelist) => changelist.label === changelistName)
    if (!changelist) {
      return
    }

    for (const fileUri of fileUris) {
      const fileName = getPathRelativeToWorkspace(fileUri.fsPath)
      changelist.items.push(new ChangelistFileEntry(fileName, fileUri, changelist))
    }

    this.refresh()
  }

  public removeFilesFromChangelist(fileEntries: ChangelistFileEntry[]) {
    const list2Map = <T extends Record<string, any>>(
      list: T[],
      identifier: string | ((item: T) => string),
    ): Record<string, T> => {
      const map: Record<string, T> = {}
      list.forEach((item) => {
        if (identifier instanceof Function) {
          map[identifier(item)] = item
          return
        }
        map[item[identifier] as string] = item
      })
      return map
    }

    const deleteFileEntryMap = list2Map(fileEntries, (item) => item.fileUri.path)

    this.changelists.forEach((changelist) => {
      let i = 0
      while (i < changelist.items.length) {
        if (deleteFileEntryMap[changelist.items[i].fileUri.path]) {
          changelist.items.splice(i, 1)
          continue
        }
        i++
      }
    })

    this.refresh()
  }

  refresh() {
    this.onDidChangeTreeDataEmitter.fire(void 0)
  }
}
