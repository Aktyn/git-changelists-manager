import { TreeItem, TreeItemCollapsibleState, type Uri } from 'vscode'
import type { DataSchema } from '../common'

export class ChangelistEntry extends TreeItem {
  public readonly contextValue = 'changelist'

  constructor(public readonly label: string, public readonly items: ChangelistFileEntry[]) {
    super(label, TreeItemCollapsibleState.Expanded)
  }

  public toData(): DataSchema {
    return {
      label: this.label,
      files: this.items?.map((item) => item.toData()) ?? [],
    }
  }
}

export class ChangelistFileEntry extends TreeItem {
  public readonly contextValue = 'filePath'
  public readonly items = []

  constructor(
    public readonly label: string,
    public readonly fileUri: Uri,
    public readonly changelist: ChangelistEntry,
  ) {
    super(label, TreeItemCollapsibleState.None)
    this.resourceUri = fileUri
  }

  public toData(): Required<DataSchema>['files'][number] {
    return { name: this.label, uri: this.fileUri.toString() }
  }
}

export type TreeEntry = ChangelistEntry | ChangelistFileEntry
