import { TreeItem, TreeItemCollapsibleState } from 'vscode'

export class ChangelistEntry extends TreeItem {
  constructor(public readonly label: string, public readonly items?: ChangelistEntry[]) {
    super(label, items ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None)
  }
}
