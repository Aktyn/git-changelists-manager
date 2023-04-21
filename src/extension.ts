import * as vscode from 'vscode'
import { logger } from './logger'

const EXTENSION_ID = 'git-changelists-manager'

export function activate(context: vscode.ExtensionContext) {
  logger.appendLine(`Extension "${EXTENSION_ID}" is now active!`)

  console.log('Congratulations, your extension "git-changelists-manager" is now active!')

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand('git-changelists-manager.helloWorld', () => {
    // The code you place here will be executed every time your command is executed
    // Display a message box to the user
    vscode.window.showInformationMessage('Hello World from Git changelists manager!')
  })

  context.subscriptions.push(disposable)
}

// This method is called when your extension is deactivated
export function deactivate() {
  // noop
}
