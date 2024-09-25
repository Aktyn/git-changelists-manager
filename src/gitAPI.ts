import { execSync, type ExecSyncOptionsWithStringEncoding } from 'child_process'
import * as fs from 'fs'
import { EOL } from 'os'
import * as path from 'path'
import { window } from 'vscode'
import type { DataSchema } from './common'
import { forceArray, getPathRelativeToWorkspace, getWorkspacePath } from './common'
import { CONFIG } from './config'
import type { ChangelistEntry } from './core/entry'
import { logger } from './logger'

export class GitAPI {
  private readonly commentPrefix = '# <<< Git changelists manager data >>>'
  protected readonly gitRootDirectory: string | null
  private syncTimeout: NodeJS.Timeout | null = null

  constructor() {
    try {
      execSync('git rev-parse --is-inside-work-tree', this.execOptions)
      const gitDir = execSync('git rev-parse --git-dir', this.execOptions).trim()

      const workspacePath = getWorkspacePath()
      this.gitRootDirectory =
        path.isAbsolute(gitDir) || !workspacePath ? gitDir : path.join(workspacePath, gitDir)
    } catch {
      this.gitRootDirectory = null
    }

    logger.appendLine(
      `Git root directory: ${
        this.gitRootDirectory ? path.resolve(this.gitRootDirectory) : 'not found'
      }`,
    )
  }

  private get execOptions(): ExecSyncOptionsWithStringEncoding {
    return {
      encoding: 'utf-8',
      cwd: getWorkspacePath(),
    }
  }

  @withExcludeFile
  public getData(...args: unknown[]): DataSchema[] {
    try {
      const excludeFilePath = args.pop() as string
      if (!excludeFilePath) {
        return []
      }

      const excludeFileContent = fs.readFileSync(excludeFilePath, 'utf-8')
      const match = excludeFileContent.match(new RegExp(`${this.commentPrefix} (.*)\r?\n`))
      if (match && match[1]) {
        return JSON.parse(match[1])
      }
    } catch (error) {
      logger.appendLine(error instanceof Error ? error.message : String(error))
    }
    return []
  }

  public update(changelists: ChangelistEntry[]) {
    this.updateExcludeFile(changelists)
    this.sync(changelists)
  }

  @withExcludeFile
  private updateExcludeFile(changelists: ChangelistEntry[], ...args: unknown[]) {
    const excludeFilePath = args.pop() as string
    if (!excludeFilePath) {
      return
    }

    const stringifiedData = JSON.stringify(changelists.map((changelist) => changelist.toData()))

    const excludeFileContent = fs.readFileSync(excludeFilePath, 'utf-8')
    const lines = excludeFileContent.split(/\r?\n/)
    const lineWithComment = lines.findIndex((line) => line.startsWith(this.commentPrefix))

    if (lineWithComment === -1) {
      fs.appendFileSync(excludeFilePath, `${EOL}${this.commentPrefix} ${stringifiedData}`, 'utf-8')
    } else {
      const linesBeforeComment = lines.slice(0, lineWithComment)
      const linesAfterComment = lines.slice(lineWithComment + 1)
      fs.writeFileSync(
        excludeFilePath,
        `${linesBeforeComment.join(EOL)}${EOL}${
          this.commentPrefix
        } ${stringifiedData}${EOL}${linesAfterComment.join(EOL)}`,
        'utf-8',
      )
    }

    logger.appendLine(`Exclude file updated`)
  }

  private isFileTracked(filePath: string) {
    try {
      execSync(`git ls-files ${filePath} | grep .`, this.execOptions)
      return true
    } catch (error) {
      logger.appendLine(error instanceof Error ? error.message : String(error))
      logger.appendLine(`File "${filePath}" is not tracked by git`)
      return false
    }
  }

  public changeAssumeUnchangedStatus(filePaths: string | string[], assumeUnchanged: boolean) {
    try {
      for (const filePath of forceArray(filePaths)) {
        if (!this.isFileTracked(filePath)) {
          continue
        }

        const relativePath = getPathRelativeToWorkspace(filePath)
        execSync(
          `git update-index --${
            assumeUnchanged ? 'assume-unchanged' : 'no-assume-unchanged'
          } ${relativePath}`,
          this.execOptions,
        )
        logger.appendLine(
          `File "${relativePath}" marked as ${assumeUnchanged ? 'unchanged' : 'changed'}`,
        )
      }
    } catch (error) {
      window.showErrorMessage(error instanceof Error ? error.message : String(error))
    }
  }

  public sync(changelists: ChangelistEntry[]) {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout)
    }

    this.syncTimeout = setTimeout(() => {
      try {
        logger.appendLine('Syncing git index according to --assume-unchanged flag...')

        const files = execSync('git ls-files -v', this.execOptions).trim().split(/\r?\n/)
        const gitAssumeUnchangedFiles = files.reduce((acc, file) => {
          if (file.startsWith('h ')) {
            acc.push(file.slice(2))
          }
          return acc
        }, [] as string[])

        const extensionAssumeUnchangedFiles = changelists.reduce((acc, changelist) => {
          acc.push(
            ...changelist.items.map((item) => getPathRelativeToWorkspace(item.fileUri.fsPath)),
          )
          return acc
        }, [] as string[])

        const filesToAssumeChanged = gitAssumeUnchangedFiles.filter(
          (file) => !extensionAssumeUnchangedFiles.includes(file),
        )
        const filesToAssumeUnchanged = extensionAssumeUnchangedFiles.filter(
          (file) => !gitAssumeUnchangedFiles.includes(file),
        )

        for (const file of filesToAssumeChanged) {
          this.changeAssumeUnchangedStatus(file, false)
        }
        for (const file of filesToAssumeUnchanged) {
          this.changeAssumeUnchangedStatus(file, true)
        }

        logger.appendLine(
          `Synced ${filesToAssumeChanged.length + filesToAssumeUnchanged.length} files`,
        )
      } catch (error) {
        logger.appendLine(`Sync error: ${error instanceof Error ? error.message : String(error)}`)
      }

      this.syncTimeout = null
    }, CONFIG.gitSyncDelay)
  }
}

function withExcludeFile(_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod: (...args: unknown[]) => void = descriptor.value

  descriptor.value = function (this: GitAPI, ...args: unknown[]) {
    if (!this.gitRootDirectory) {
      window.showErrorMessage('Git repository not found!')
      return
    }

    const excludeFilePath = path.join(this.gitRootDirectory, 'info', 'exclude')
    if (!fs.existsSync(excludeFilePath)) {
      window.showErrorMessage(`Exclude file not found at ${path.resolve(excludeFilePath)}`)
      return
    }

    return originalMethod.apply(this, [...args, excludeFilePath])
  }

  return descriptor
}
