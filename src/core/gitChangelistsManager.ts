import type { Uri } from 'vscode'
import { commands, window, type ExtensionContext, type TreeView } from 'vscode'
import { CONFIG } from '../config'
import { GitAPI } from '../gitAPI'
import { logger } from '../logger'
import { ChangelistTreeDataProvider } from './changelistTreeDataProvider'
import type { ChangelistEntry, ChangelistFileEntry, TreeEntry } from './entry'

const catchError = (error: unknown) =>
  logger.appendLine(error instanceof Error ? error.message : String(error))

export class GitChangelistsManager {
  private readonly changelistsTree: TreeView<TreeEntry>
  protected readonly treeDataProvider: ChangelistTreeDataProvider
  protected readonly git = new GitAPI()

  constructor(private readonly context: ExtensionContext) {
    this.registerViewCommands()

    this.treeDataProvider = new ChangelistTreeDataProvider(this.git.getData())

    this.changelistsTree = window.createTreeView(`${CONFIG.extensionId}.views.explorer`, {
      treeDataProvider: this.treeDataProvider,
      showCollapseAll: true,
      canSelectMany: true,
    })
    context.subscriptions.push(this.changelistsTree)

    this.git.sync(this.treeDataProvider.getChangelists())
  }

  private registerViewCommands() {
    this.context.subscriptions.push(
      commands.registerCommand(`${CONFIG.extensionId}.views.explorer.createNew`, () => {
        this.createChangelist().catch(catchError)
      }),
    )
    this.context.subscriptions.push(
      commands.registerCommand(
        `${CONFIG.extensionId}.views.explorer.rename`,
        (changelist: ChangelistEntry) => this.renameChangelist(changelist).catch(catchError),
      ),
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
        (node?: { resourceUri: Uri }) => {
          if (!node) {
            return
          }
          this.addFileToChangelist(node.resourceUri)
        },
      ),
    )
    this.context.subscriptions.push(
      commands.registerCommand(
        `${CONFIG.extensionId}.views.explorer.removeFile`,
        (fileEntry?: ChangelistFileEntry) => {
          if (!fileEntry) {
            return
          }
          this.removeFileFromChangelist(fileEntry)
        },
      ),
    )
  }

  private parseChangelistName(name?: string) {
    if (!name) {
      window.showErrorMessage('Changelist name is required!')
      return null
    }

    const changelists = this.treeDataProvider.getChildren()
    if (changelists.some((changelist) => changelist.label === name)) {
      window.showErrorMessage('Changelist with this name already exists!')
      return null
    }
    return name
  }

  @withGitUpdate
  private async createChangelist() {
    const newChangelistName = await window.showInputBox({
      placeHolder: 'Name',
      prompt: 'Enter unique changelist name',
      value: '',
    })

    const parsedName = this.parseChangelistName(newChangelistName)
    if (!parsedName) {
      return
    }

    this.treeDataProvider.addChangelist(parsedName)
  }

  @withGitUpdate
  private async renameChangelist(changelist: ChangelistEntry) {
    const newName = await window.showInputBox({
      placeHolder: 'Name',
      prompt: 'Enter unique changelist name',
      value: changelist.label,
      ignoreFocusOut: true,
    })

    const parsedName = this.parseChangelistName(newName)
    if (!parsedName) {
      return
    }

    this.treeDataProvider.renameChangelist(changelist, parsedName)
  }

  @withGitUpdate
  private removeChangelist(name: string) {
    const files = this.treeDataProvider.removeChangelist(name)
    files.forEach((file) => this.git.changeAssumeUnchangedStatus(file.fileUri.fsPath, false))
  }

  @withGitUpdate
  private async addFileToChangelist(fileUri: Uri) {
    const changelistName = await this.selectChangelistName()
    if (!changelistName) {
      return
    }

    this.treeDataProvider.addFileToChangelist(changelistName, fileUri)
    this.git.changeAssumeUnchangedStatus(fileUri.fsPath, true)
  }

  @withGitUpdate
  private removeFileFromChangelist(fileEntry: ChangelistFileEntry) {
    this.treeDataProvider.removeFileFromChangelist(fileEntry)
    this.git.changeAssumeUnchangedStatus(fileEntry.fileUri.fsPath, false)
  }

  private async selectChangelistName() {
    const changelists = this.treeDataProvider.getChangelists()
    if (!changelists.length) {
      window.showErrorMessage('No changelists found!')
      return null
    }

    if (changelists.length === 1) {
      return changelists[0].label
    }

    const changelistName = await window.showQuickPick(
      changelists.map((changelist) => changelist.label),
      {
        placeHolder: 'Select changelist',
        canPickMany: false,
      },
    )

    return changelistName
  }
}

function withGitUpdate(_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod: (...args: unknown[]) => unknown = descriptor.value

  descriptor.value = async function (this: GitChangelistsManager, ...args: unknown[]) {
    const returnValue = await originalMethod.apply(this, args)
    this.git.update(this.treeDataProvider.getChangelists())
    return returnValue
  }

  return descriptor
}
