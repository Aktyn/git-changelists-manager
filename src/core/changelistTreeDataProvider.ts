import type { TreeItem } from 'vscode'
import {
  EventEmitter,
  type CancellationToken,
  type ProviderResult,
  type TreeDataProvider,
} from 'vscode'
import { ChangelistEntry } from './changelistEntry'
import { logger } from '../logger'
import type { DataSchema } from '../common'

export class ChangelistTreeDataProvider implements TreeDataProvider<ChangelistEntry> {
  private changelists: ChangelistEntry[] = []

  private onDidChangeTreeDataEmitter = new EventEmitter<ChangelistEntry | undefined>()
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event

  constructor(data: DataSchema[]) {
    for (const schema of data) {
      this.changelists.push(
        new ChangelistEntry(
          schema.label,
          schema.files?.map((file) => new ChangelistEntry(file)),
        ),
      )
    }

    if (this.changelists.length) {
      logger.appendLine(`Loaded: ${this.changelists.length} changelists`)
      this.refresh()
    }
  }

  getChildren(element?: ChangelistEntry | undefined) {
    if (element) {
      return element.items ?? []
    } else {
      return this.changelists
    }
  }
  getParent?(_element: ChangelistEntry): ProviderResult<ChangelistEntry> {
    throw new Error('Method not implemented.')
  }
  resolveTreeItem?(
    _item: TreeItem,
    _element: ChangelistEntry,
    _token: CancellationToken,
  ): ProviderResult<TreeItem> {
    throw new Error('Method not implemented.')
  }

  getTreeItem(element: ChangelistEntry) {
    return element
  }

  public addChangelist(name: string) {
    const entry = new ChangelistEntry(name, [])

    this.changelists.push(entry)
    this.refresh()

    logger.appendLine(
      `New changelist "${name}" created!\nTotal changelists: ${this.changelists.length}`,
    )
  }

  public removeChangelist(name: string) {
    this.changelists = this.changelists.filter((changelist) => changelist.label !== name)
    this.refresh()

    logger.appendLine(
      `Changelist "${name}" removed!\nTotal changelists: ${this.changelists.length}`,
    )
  }

  refresh() {
    this.onDidChangeTreeDataEmitter.fire(void 0)
  }
}
