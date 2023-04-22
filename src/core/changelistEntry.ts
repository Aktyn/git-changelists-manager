import { TreeItem, TreeItemCollapsibleState } from 'vscode'

export class ChangelistEntry extends TreeItem {
  public readonly contextValue: 'changelist' | 'filePath'

  constructor(public readonly label: string, public readonly items?: ChangelistEntry[]) {
    super(label, items ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None)
    this.contextValue = items ? 'changelist' : 'filePath'
  }
}
