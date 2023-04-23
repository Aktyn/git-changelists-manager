# Git changelists manager

Inspired by the [this vscode extension](https://github.com/koenigstag/git-changelists), which I used for a short time before it stopped working.

This extension mainly uses the `git update-index --assume-unchanged <filepath` and `git update-index --no-assume-unchanged <filepath` commands to **locally** ignore files from git without using the `.gitignore` file.

It also allows the user to group files into changelists so that they can be restored all at once later.

Tested on linux only.

## Known Issues
\-

## Release Notes
### 1.0.0
Initial release