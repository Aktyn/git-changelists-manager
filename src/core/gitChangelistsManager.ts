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
        `${CONFIG.extensionId}.views.explorer.restoreChangeList`,
        (changelist: ChangelistEntry) => {
          if (changelist.contextValue !== 'changelist') {
            return
          }
          this.removeChangelist(changelist.label, false)
        },
      ),
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
        `${CONFIG.extensionId}.views.explorer.addChangesToChangelist`,
        (node: { resourceStates: Array<{ resourceUri: Uri }> }) => {
          const resourceStates = node?.resourceStates || []
          if (!(resourceStates?.length > 0)) {
            return
          }
          this.addFileToChangelist(resourceStates?.map((r) => r.resourceUri))
        },
      ),
    )
    this.context.subscriptions.push(
      commands.registerCommand(
        `${CONFIG.extensionId}.views.explorer.addFileToChangelist`,
        (...nodes: Array<{ resourceUri: Uri }>) => {
          if (!(nodes?.length > 0)) {
            return
          }
          this.addFileToChangelist(nodes.map((node) => node.resourceUri))
        },
      ),
    )
    this.context.subscriptions.push(
      commands.registerCommand(
        `${CONFIG.extensionId}.views.explorer.removeFile`,
        (fileEntry?: ChangelistFileEntry, multiFileEntries?: ChangelistFileEntry[]) => {
          const fileEntries = (!multiFileEntries ? [fileEntry] : multiFileEntries || []).filter(
            Boolean,
          ) as ChangelistFileEntry[]
          if (!(fileEntries?.length > 0)) {
            return
          }
          this.removeFileFromChangelist(fileEntries)
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

    if (newChangelistName === undefined) {
      // user pressed esc
      return
    }
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

    if (newName === undefined) {
      // user pressed esc
      return
    }
    const parsedName = this.parseChangelistName(newName)
    if (!parsedName) {
      return
    }

    this.treeDataProvider.renameChangelist(changelist, parsedName)
  }

  @withGitUpdate
  private removeChangelist(name: string, ifDelete = true) {
    const files = this.treeDataProvider.removeChangelist(name, ifDelete)
    this.git.changeAssumeUnchangedStatus(
      files.map((file) => file.fileUri.fsPath),
      false,
    )
    if (!ifDelete) {
      // when not removing changelist, we need to remove files under the changelist
      this.treeDataProvider.removeFilesFromChangelist(files)
    }
  }

  @withGitUpdate
  private async addFileToChangelist(fileUris: Uri[]) {
    const changelistName = await this.selectChangelistName()
    if (!changelistName) {
      return
    }

    this.treeDataProvider.addFileToChangelist(changelistName, fileUris)
    this.git.changeAssumeUnchangedStatus(
      fileUris.map((fileUri) => fileUri.fsPath),
      true,
    )
  }

  @withGitUpdate
  private removeFileFromChangelist(fileEntries: Array<ChangelistFileEntry>) {
    this.git.changeAssumeUnchangedStatus(
      fileEntries.map((fileEntry) => fileEntry.fileUri.fsPath),
      false,
    )
    this.treeDataProvider.removeFilesFromChangelist(fileEntries)
  }

  private async selectChangelistName() {
    const changelists = this.treeDataProvider.getChangelists()
    if (!changelists.length) {
      const newChangelistName = 'Unnamed Changelist'
      this.treeDataProvider.addChangelist(newChangelistName)
      return newChangelistName
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
