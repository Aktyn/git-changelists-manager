import type { TreeItem } from 'vscode'
import {
  EventEmitter,
  type CancellationToken,
  type ProviderResult,
  type TreeDataProvider,
} from 'vscode'
import { ChangelistEntry } from './changelistEntry'
import { logger } from '../logger'

export class ChangelistTreeDataProvider implements TreeDataProvider<ChangelistEntry> {
  private changelists: ChangelistEntry[] = []

  private onDidChangeTreeDataEmitter = new EventEmitter<ChangelistEntry | undefined>()
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event

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
    this.onDidChangeTreeDataEmitter.fire(void 0)

    logger.appendLine(
      `New changelist "${name}" created!\nTotal changelists: ${this.changelists.length}`,
    )
  }
}
