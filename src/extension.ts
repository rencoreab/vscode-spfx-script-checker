import * as vscode from 'vscode';
import * as fs from 'fs';
import CDNQuality from './cdnQuality';
import ScriptChecker, { ScriptType } from './scriptChecker';
import ExternalLibrary, { IConfig } from './externalLibrary';

export interface IScriptData {
  url: string;
}

/**
 * Questions
 */
const scriptUrlOption: vscode.InputBoxOptions = {
  ignoreFocusOut: true,
  placeHolder: "Enter the URL of the external library you want to check and add to your config.",
  prompt: "Example: https://code.jquery.com/jquery-2.2.4.min.js"
};

const moduleNameOption: vscode.InputBoxOptions = {
  ignoreFocusOut: true,
  placeHolder: "Enter the name of your module.",
  prompt: "Enter the name of your module. Example: jQuery, angular, ..."
};

const scriptPluginOption: vscode.InputBoxOptions = {
  ignoreFocusOut: true,
  placeHolder: "Is this module a plugin?",
  prompt: `Is this module a plugin? Enter: "true" OR "false"`,
  validateInput: (val: string) => (val === 'true' || val === 'false' ? "" : `Please enter: "true" OR "false".`)
};

const globalNameOption: vscode.InputBoxOptions = {
  ignoreFocusOut: true,
  placeHolder: "Enter the global module name.",
  prompt: "Enter the global module name. Example: jQuery, angular, ...",
};

const dependencyOptions: vscode.InputBoxOptions = {
  ignoreFocusOut: true,
  placeHolder: "Enter the module dependencies (comma-separated if multiple).",
  prompt: "Enter the module dependencies (comma-separated if multiple). Example: jQuery, angular, ...",
};

/**
 * Visual Studio Code Activate Extension
 * @param context
 */
export function activate(context: vscode.ExtensionContext) {
  // register VSCode command "SPFx Script Check"
  const disposable = vscode.commands.registerCommand('spfx.scriptcheck', () => {
    // Show the script URL option
    const url = vscode.window.showInputBox(scriptUrlOption).then(async (url) => {
      if (url) {
        // Create script data for calling the API
        const scriptData: IScriptData = { url };

        // Check the script type
        const scriptType: ScriptType | string = await ScriptChecker.check(scriptData);
        if (typeof scriptType === "string") {
          vscode.window.showErrorMessage(`${scriptType}`);
          return;
        } else if (scriptType === null) {
          vscode.window.showErrorMessage('Sorry, something went wrong');
          return;
        } else {
          // Ask the module name
          const moduleName: string = await vscode.window.showInputBox(moduleNameOption);
          if (moduleName) {
            // Check to see if other questions need to be asked when script is not a module
            let scriptPlugin: boolean = null;
            let globalName: string = null;
            let scriptDependencies: string = null;

            // Check if it was a non-module
            if (scriptType === ScriptType.nonModule) {
              // Set the default value for the plugin script to "false"
              scriptPluginOption.value = "false";
              const scriptPluginTxt = await vscode.window.showInputBox(scriptPluginOption);
              if (!scriptPluginTxt) {
                vscode.window.showErrorMessage(`You entered an incorrect value.`);
                return;
              }
              scriptPlugin = scriptPluginTxt === "true";
            }

            // Check if file is a plugin
            if (scriptPlugin) {
              globalName = await vscode.window.showInputBox(globalNameOption);
              scriptDependencies = await vscode.window.showInputBox(dependencyOptions);
            }

            // Retrieve the SharePoint Framework config file
            const filesUri: vscode.Uri[] = await vscode.workspace.findFiles('**/config/config.json');
            if (filesUri && filesUri.length > 0) {
              // Get the first config file
              const configFileUri = filesUri[0];
              // Open and show the config file
              vscode.window.showTextDocument(configFileUri);
              const configFile: vscode.TextDocument = await vscode.workspace.openTextDocument(configFileUri);
              const configContent = configFile.getText();
              // Check if file content is retrieved
              if (configContent) {
                // Parse the JSON content
                const configJson: IConfig = JSON.parse(configContent);
                if (!configJson.externals) {
                  // If the config file does not contain an external section, we stop,
                  // it might be a wrong file or something is wrong with the file
                  vscode.window.showErrorMessage(`Your config file does not have a "externals" section.`);
                  return;
                }
                // Update the config file based on the information from the questions
                const updatedConfig = ExternalLibrary.update(configJson, scriptType, moduleName, url, globalName, scriptDependencies);
                // Write the updated content back to the config file
                fs.writeFileSync(configFileUri.path, JSON.stringify(updatedConfig, null, 2), 'utf8');
                vscode.window.showInformationMessage("Config has been updated with the provided information.");
              } else {
                vscode.window.showErrorMessage(`Failed retrieving the config.json file.`);
                return;
              }
            }
          }
        }

        // Check the CDN quality
        const quality = await CDNQuality.test(scriptData);
        if (quality) {
          vscode.window.showInformationMessage(quality);
        }
      }
    });
  });

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
