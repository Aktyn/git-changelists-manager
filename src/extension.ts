import type { ExtensionContext } from 'vscode'
import { CONFIG } from './config'
import { GitChangelistsManager } from './core/gitChangelistsManager'
import { logger } from './logger'

export function activate(context: ExtensionContext) {
  logger.appendLine(`Extension "${CONFIG.extensionId}" is now active!`)

  new GitChangelistsManager(context)
}

export function deactivate() {
  logger.appendLine(`Extension "${CONFIG.extensionId}" is not longer active!`)
}
