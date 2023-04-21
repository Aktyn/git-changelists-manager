import { commands, window, type ExtensionContext, type TreeView } from 'vscode'
import { CONFIG } from '../config'
import { GitAPI } from '../gitAPI'
import { logger } from '../logger'
import type { ChangelistEntry } from './changelistEntry'
import { ChangelistTreeDataProvider } from './changelistTreeDataProvider'

export class GitChangelistsManager {
  private readonly changelistsTree: TreeView<ChangelistEntry>
  private readonly treeDataProvider = new ChangelistTreeDataProvider()
  private readonly api = new GitAPI()

  constructor(private readonly context: ExtensionContext) {
    this.context.subscriptions.push(
      commands.registerCommand(`${CONFIG.extensionId}.views.explorer.createNew`, () => {
        this.createNew().catch((error) =>
          logger.appendLine(error instanceof Error ? error.message : String(error)),
        )
      }),
    )
    this.context.subscriptions.push(
      commands.registerCommand(`${CONFIG.extensionId}.views.explorer.refresh`, () => {
        window.showInformationMessage('TODO')
      }),
    )

    this.changelistsTree = window.createTreeView(`${CONFIG.extensionId}.views.explorer`, {
      treeDataProvider: this.treeDataProvider,
      showCollapseAll: true,
      canSelectMany: true,
    })
    context.subscriptions.push(this.changelistsTree)
  }

  private async createNew() {
    const newChangelistName = await window.showInputBox({
      placeHolder: 'Name',
      prompt: 'Enter unique changelist name',
      value: '',
    })

    if (!newChangelistName) {
      window.showErrorMessage('Changelist name is required!')
      return
    }

    // if (Object.keys(ChangeListView.tree).includes(newChangelistName)) {
    //   window.showErrorMessage(changelistNameAlreadyExists)
    //   return
    // }

    //viewInstance.addNewChangelist(newChangelistName)
    this.treeDataProvider.addChangelist(newChangelistName)
  }
}
