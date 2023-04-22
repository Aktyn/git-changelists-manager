import { commands, window, type ExtensionContext, type TreeView } from 'vscode'
import { CONFIG } from '../config'
import { GitAPI } from '../gitAPI'
import { logger } from '../logger'
import type { ChangelistEntry } from './changelistEntry'
import { ChangelistTreeDataProvider } from './changelistTreeDataProvider'

export class GitChangelistsManager {
  private readonly changelistsTree: TreeView<ChangelistEntry>
  protected readonly treeDataProvider
  protected readonly git = new GitAPI()

  constructor(private readonly context: ExtensionContext) {
    this.context.subscriptions.push(
      commands.registerCommand(`${CONFIG.extensionId}.views.explorer.createNew`, () => {
        this.createChangelist().catch((error) =>
          logger.appendLine(error instanceof Error ? error.message : String(error)),
        )
      }),
    )
    this.context.subscriptions.push(
      commands.registerCommand(`${CONFIG.extensionId}.views.explorer.refresh`, () => {
        this.treeDataProvider.refresh()
      }),
    )
    this.context.subscriptions.push(
      commands.registerCommand(
        `${CONFIG.extensionId}.views.explorer.removeChangeList`,
        (changelist: ChangelistEntry) => {
          if (changelist.contextValue !== 'changelist') {
            return
          }
          this.removeChangelist(changelist.label)
        },
      ),
    )
    this.context.subscriptions.push(
      commands.registerCommand(
        `${CONFIG.extensionId}.views.explorer.addFileToChangelist`,
        (node?: { resourceUri: { fsPath: string } }) => {
          logger.appendLine('addFileToChangelist invoked ' + node?.resourceUri?.fsPath) //TODO: remove
        },
      ),
    )

    this.treeDataProvider = new ChangelistTreeDataProvider(this.git.getData())

    this.changelistsTree = window.createTreeView(`${CONFIG.extensionId}.views.explorer`, {
      treeDataProvider: this.treeDataProvider,
      showCollapseAll: true,
      canSelectMany: true,
    })
    context.subscriptions.push(this.changelistsTree)
  }

  @withGitUpdate
  private async createChangelist() {
    const newChangelistName = await window.showInputBox({
      placeHolder: 'Name',
      prompt: 'Enter unique changelist name',
      value: '',
    })

    if (!newChangelistName) {
      window.showErrorMessage('Changelist name is required!')
      return
    }

    const changelists = this.treeDataProvider.getChildren()
    if (changelists.some((changelist) => changelist.label === newChangelistName)) {
      window.showErrorMessage('Changelist with this name already exists!')
      return
    }

    this.treeDataProvider.addChangelist(newChangelistName)
  }

  @withGitUpdate
  private removeChangelist(name: string) {
    this.treeDataProvider.removeChangelist(name)
  }
}

function withGitUpdate(_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod: (...args: unknown[]) => unknown = descriptor.value

  descriptor.value = async function (this: GitChangelistsManager, ...args: unknown[]) {
    const returnValue = await originalMethod.apply(this, args)
    this.git.update(this.treeDataProvider.getChildren())
    return returnValue
  }

  return descriptor
}
