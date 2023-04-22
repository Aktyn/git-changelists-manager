import { execSync, type ExecSyncOptionsWithStringEncoding } from 'child_process'
import * as fs from 'fs'
import { EOL } from 'os'
import * as path from 'path'
import { window, workspace } from 'vscode'
import type { DataSchema } from './common'
import type { ChangelistEntry } from './core/changelistEntry'
import { logger } from './logger'

export class GitAPI {
  private readonly commentPrefix = '# <<< Git changelists manager data >>>'
  protected readonly gitRootDirectory: string | null

  constructor() {
    try {
      const options: ExecSyncOptionsWithStringEncoding = {
        encoding: 'utf-8',
        cwd: workspace.workspaceFolders?.[0].uri.fsPath,
      }

      execSync('git rev-parse --is-inside-work-tree', options)

      this.gitRootDirectory = execSync('git rev-parse --git-dir', options).trim()
    } catch (error) {
      this.gitRootDirectory = null
    }

    logger.appendLine(`Git root directory: ${this.gitRootDirectory}`)
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
  }

  @withExcludeFile
  private updateExcludeFile(changelists: ChangelistEntry[], ...args: unknown[]) {
    const excludeFilePath = args.pop() as string
    if (!excludeFilePath) {
      return
    }

    const stringifiedData = JSON.stringify(
      changelists.map<DataSchema>((changelist) => ({
        label: changelist.label,
        files: changelist.items?.map((item) => item.label) ?? [],
      })),
    )

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
      window.showErrorMessage(`Exclude file not found at ${excludeFilePath}`)
      return
    }

    return originalMethod.apply(this, [...args, excludeFilePath])
  }

  return descriptor
}
