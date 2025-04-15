const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

let mainWindow;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Developer tools
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC olaylarını dinle
ipcMain.handle('select-directories', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'multiSelections']
  });

  if (result.canceled) {
    return [];
  }

  const directoryInfos = await Promise.all(result.filePaths.map(async (dirPath) => {
    try {
      const isGitRepo = fs.existsSync(path.join(dirPath, '.git'));

      let pendingChanges = '';
      let gitRemoteUrl = '';
      let currentBranch = '';
      let allBranches = [];
      let fileDiffs = [];

      if (isGitRepo) {
        try {
          // Git durumunu kontrol et
          const { stdout: pendingChangesOutput } = await execPromise('git status -s', { cwd: dirPath });
          pendingChanges = pendingChangesOutput;

          // Remote URL'yi al
          const { stdout: remoteOutput } = await execPromise('git remote get-url origin', { cwd: dirPath });
          gitRemoteUrl = remoteOutput.trim();

          // Git current branch
          const { stdout: branchOutput } = await execPromise('git rev-parse --abbrev-ref HEAD', { cwd: dirPath });
          currentBranch = branchOutput.trim();

          // Tüm local branch'ler
          const { stdout: branchesOutput } = await execPromise('git branch --format="%(refname:short)"', { cwd: dirPath });
          allBranches = branchesOutput.trim().split('\n').map(b => b.trim());

          const { stdout: fileStatusOutput } = await execPromise('git status --porcelain', { cwd: dirPath });

          const changedFileInfos = fileStatusOutput
            .trim()
            .split('\n')
            .filter(Boolean)
            .map(line => {
              const status = line.slice(0, 2).trim(); // M, A, D, ?? vs.
              const file = line.slice(3).trim();
              return { file, status };
            });

          // Her dosya için diff al
          for (const { file, status } of changedFileInfos) {
            try {
              const { stdout: diffOutput } = await execPromise(`git diff --no-prefix -- ${file}`, { cwd: dirPath });
              fileDiffs.push({
                filePath: file,
                status,
                diff: diffOutput.trim()
              });
            } catch (diffError) {
              console.error(`Diff alınamadı: ${diffError.message}`);
              fileDiffs.push({
                filePath: file,
                status,
                diff: '',
                error: diffError.message
              });
            }
          }

        } catch (error) {
          console.error(`Git komut hatası: ${error.message}`);
        }
      }

      return {
        path: dirPath,
        name: path.basename(dirPath),
        isGitRepo,
        pendingChanges,
        gitRemoteUrl,
        currentBranch,
        allBranches,
        fileDiffs
      };
    } catch (error) {
      console.error(`Dizin kontrolünde hata: ${error.message}`);
      return {
        path: dirPath,
        name: path.basename(dirPath),
        isGitRepo: false,
        pendingChanges: '',
        gitRemoteUrl: '',
        error: error.message
      };
    }
  }));

  return directoryInfos;
});

ipcMain.handle('commit-changes', async (event, { directories, commitMessage }) => {
  const results = [];

  for (const dir of directories) {
    try {
      // Değişiklikleri kaydet
      await execPromise('git add .', { cwd: dir.path });

      // Commit oluştur
      await execPromise(`git commit -m "${commitMessage}"`, { cwd: dir.path });

      // Push
      await execPromise('git push origin HEAD', { cwd: dir.path });

      results.push({
        path: dir.path,
        name: dir.name,
        success: true,
        message: 'Commit ve push başarılı'
      });
    } catch (error) {
      results.push({
        path: dir.path,
        name: dir.name,
        success: false,
        message: `Hata: ${error.message}`
      });
    }
  }

  return results;
});

ipcMain.handle('initialize-git', async (event, { directory, remoteUrl }) => {
  try {
    // Git repo başlat
    await execPromise('git init', { cwd: directory.path });

    // Remote ekle
    if (remoteUrl) {
      await execPromise(`git remote add origin ${remoteUrl}`, { cwd: directory.path });
    }

    return {
      success: true,
      message: 'Git başarıyla başlatıldı'
    };
  } catch (error) {
    return {
      success: false,
      message: `Git başlatma hatası: ${error.message}`
    };
  }
});

ipcMain.handle('get-file-changes', async (event, { directory, filePath }) => {
  try {
    const { stdout } = await execPromise(
      `git diff --cached -- ${filePath}`, // `--cached` staged değişiklikleri gösterir, gerekirse kaldırılabilir
      { cwd: directory }
    );
    return stdout;
  } catch (error) {
    console.error(`Dosya değişikliği alınamadı: ${error.message}`);
    return `Değişiklikler alınamadı: ${error.message}`;
  }
});

ipcMain.handle('check-updates', async (event, dirPath) => {
  try {
    // Fetch yap
    await execPromise('git fetch', { cwd: dirPath });

    // Geçerli branch adını al
    const { stdout: branchStdout } = await execPromise('git rev-parse --abbrev-ref HEAD', { cwd: dirPath });
    const currentBranch = branchStdout.trim();

    // Uzakta kaç yeni commit olduğunu al
    const { stdout: countStdout } = await execPromise(`git rev-list HEAD..origin/${currentBranch} --count`, {
      cwd: dirPath
    });

    const aheadCount = parseInt(countStdout.trim(), 10);

    return {
      success: true,
      count: aheadCount
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
});

ipcMain.handle('pull-updates', async (event, dirPath) => {
  try {
    await execPromise('git pull', { cwd: dirPath });
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});
