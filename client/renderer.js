const { ipcRenderer } = require('electron')

// DOMs
const selectDirsBtn = document.getElementById('selectDirs');
const directoriesList = document.getElementById('directories-list');
const commitContainer = document.getElementById('commit-container');
const commitMessageInput = document.getElementById('commitMessage');
const commitBtn = document.getElementById('commitBtn');
const searchContainer = document.querySelector('.search-container');
const projectSearchInput = document.getElementById('projectSearch');
const showChangesOnlyCheckbox = document.getElementById('showChangesOnly');

// Modals
const commitModal = document.getElementById('commitModal');
const modalContent = document.querySelector('.modal-content');
const closeButton = document.querySelector('.close-button');

const gitInitModal = document.getElementById('gitInitModal');
const gitInitProjectName = document.getElementById('gitInitProjectName');
const remoteUrlInput = document.getElementById('remoteUrl');
const initGitBtn = document.getElementById('initGitBtn');
const gitInitClose = document.querySelector('.gitInitClose');

const resultsModal = document.getElementById('resultsModal');
const resultsContent = document.getElementById('resultsContent');
const resultsClose = document.querySelector('.resultsClose');

// Dizinleri saklamak için
let directories = [];
let currentDirectory = null;

document.addEventListener('DOMContentLoaded', () => {
  // Version bilgisini güncelle
  const versionElement = document.querySelector('.version');

  if (versionElement) {
    versionElement.textContent = `Stackmit v1.0.0`;
  }
});

// Klasör seçme işlemi
selectDirsBtn.addEventListener('click', async () => {
  try {
    directories = await ipcRenderer.invoke('select-directories');
    renderDirectories();

    if (directories.length > 0) {
      commitContainer.style.display = 'block';
      searchContainer.style.display = 'block';
    }
  } catch (error) {
    console.error('Klasör seçme hatası:', error);
    alert('Klasör seçme sırasında bir hata oluştu.');
  }
});

function getDiffStatusClass(status) {
  if (status === 'A') return 'added';
  if (status === 'M') return 'modified';
  if (status === 'D') return 'deleted';
  if (status === '??') return 'untracked';
  return '';
}

// Dizinleri listele
function renderDirectories() {
  directoriesList.innerHTML = '';

  if (projectSearchInput.value.trim() !== '') {
    filterDirectories();
  }

  directories.forEach((dir, index) => {
    console.log("dir", dir)
    const directoryItem = document.createElement('div');
    directoryItem.className = 'directory-item';

    // Checkbox ekle (Git repo ise)
    let checkboxHtml = '';
    if (dir.isGitRepo) {
      checkboxHtml = `
        <div class="checkbox-container">
          <input type="checkbox" id="dir-${index}" data-index="${index}" class="dir-checkbox" ${dir.pendingChanges ? 'checked' : ''}>
        </div>
      `;
    }

    // Git durumunu belirten badge
    const gitStatusBadge = dir.isGitRepo
      ? `<span class="git-status status-connected">
      <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewBox="0 0 24 24" fill="none" stroke="#11ac3f">
        <g id="SVGRepo_bgCarrier" stroke-width="0"/>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>
        <g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M13.4142 3.82843C12.6332 3.04738 11.3668 3.04738 10.5858 3.82843L9.91421 4.5L11.482 6.06774C11.6472 6.02356 11.8208 6 12 6C13.1046 6 14 6.89543 14 8C14 8.17916 13.9764 8.35282 13.9323 8.51804L15.982 10.5677C16.1472 10.5236 16.3208 10.5 16.5 10.5C17.6046 10.5 18.5 11.3954 18.5 12.5C18.5 13.6046 17.6046 14.5 16.5 14.5C15.3954 14.5 14.5 13.6046 14.5 12.5C14.5 12.3208 14.5236 12.1472 14.5677 11.982L13 10.4142V15.2676C13.5978 15.6134 14 16.2597 14 17C14 18.1046 13.1046 19 12 19C10.8954 19 10 18.1046 10 17C10 16.2597 10.4022 15.6134 11 15.2676V9.73244C10.4022 9.38663 10 8.74028 10 8C10 7.82084 10.0236 7.64718 10.0677 7.48196L8.5 5.91421L3.82843 10.5858C3.04738 11.3668 3.04738 12.6332 3.82843 13.4142L10.5858 20.1716C11.3668 20.9526 12.6332 20.9526 13.4142 20.1716L20.1716 13.4142C20.9526 12.6332 20.9526 11.3668 20.1716 10.5858L13.4142 3.82843ZM9.17157 2.41421C10.7337 0.852115 13.2663 0.852119 14.8284 2.41422L21.5858 9.17157C23.1479 10.7337 23.1479 13.2663 21.5858 14.8284L14.8284 21.5858C13.2663 23.1479 10.7337 23.1479 9.17157 21.5858L2.41421 14.8284C0.852115 13.2663 0.852119 10.7337 2.41422 9.17157L9.17157 2.41421Z" fill="#2e2929"/> </g>
      </svg>
      Git Connection Available
      </span>`
      : `<span class="git-status status-disconnected">No Git Connection</span>`;

    // Değişiklik varsa badge göster
    const changesBadge = dir.pendingChanges
      ? `<span class="changes-badge" data-index="${index}"> 
      <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewBox="0 0 24 24" fill="none" stroke="#ffffff">
        <g id="SVGRepo_bgCarrier" stroke-width="0"/>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>
        <g id="SVGRepo_iconCarrier"> <path d="M9 17H13M9 13H13M9 9H10M17 18V21M17 15H17.01M13 3H8.2C7.0799 3 6.51984 3 6.09202 3.21799C5.71569 3.40973 5.40973 3.71569 5.21799 4.09202C5 4.51984 5 5.0799 5 6.2V17.8C5 18.9201 5 19.4802 5.21799 19.908C5.40973 20.2843 5.71569 20.5903 6.09202 20.782C6.51984 21 7.0799 21 8.2 21H13M13 3L19 9M13 3V7.4C13 7.96005 13 8.24008 13.109 8.45399C13.2049 8.64215 13.3578 8.79513 13.546 8.89101C13.7599 9 14.0399 9 14.6 9H19M19 9V11.5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/> </g>
      </svg>
        Changes
      </span>`
      : '';

    directoryItem.innerHTML = `
      ${checkboxHtml}
      <div class="directory-info">
        <div class="directory-name">${dir.name}</div>
        <div class="directory-path">${dir.path}</div>
        <div class="directory-badges">
          ${gitStatusBadge}
          ${changesBadge}
        </div>
      </div>
      <div class="directory-actions">
        ${!dir.isGitRepo ? `<button class="btn secondary init-git" data-index="${index}">Git Remote Start</button>` : ''}
        <button type="auto" class="btn refresh-btn" data-path="${dir.path}">Refresh</button>
        <button type="auto" class="btn pull-btn"data-path="${dir.path}">Pull</button>
      </div>

    `;

    directoriesList.appendChild(directoryItem);
  });

  // Değişiklik badge'lerini dinle
  document.querySelectorAll('.changes-badge').forEach(badge => {
    badge.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      showChanges(directories[index]);
    });
  });

  // Git başlat butonlarını dinle
  document.querySelectorAll('.init-git').forEach(btn => {
    btn?.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      showGitInitModal(directories[index]);
    });
  });
}

document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('refresh-btn')) {
    const button = e.target;
    const dirPath = button.getAttribute('data-path');
    button.innerText = 'Checking for updates...';

    const result = await ipcRenderer.invoke('check-updates', dirPath);

    if (result.success) {
      if (result.count > 0) {
        button.innerText = `${result.count} new commit.`;
        button.style.backgroundColor = '#ff9800';
        button.style.color = '#fff';
      } else {
        button.innerText = `Up to date`;
        button.style.backgroundColor = '#4CAF50';
        button.style.color = '#fff';

        setTimeout(() => {
          button.innerText = `Refresh`;
          button.removeAttribute("style");
        }, 2000);
      }
    } else {
      button.innerText = `Error: ${result.message}`;

      setTimeout(() => {
        button.innerText = `Refresh`;
        button.removeAttribute("style");
      }, 2000);
    }
  }

  if (e.target.classList.contains('pull-btn')) {
    const button = e.target;
    const dirPath = button.getAttribute('data-path');

    button.innerText = 'Pulling...';

    try {
      const result = await ipcRenderer.invoke('pull-updates', dirPath);

      if (result.success) {
        button.innerText = 'Pull success.';

        setTimeout(() => {
          button.innerText = `Pull`;
          button.removeAttribute("style");
        }, 2000);
      } else {
        button.innerText = `Error: ${result.message}`;

        setTimeout(() => {
          button.innerText = `Pull`;
          button.removeAttribute("style");
        }, 2000);
      }
    } catch (error) {
      button.innerText = `Error: ${error.message}`;

      setTimeout(() => {
        button.innerText = `Pull`;
        button.removeAttribute("style");
      }, 2000);
    }
  }
});



function showChanges(directory) {
  console.log("show changes -->", directory);

  let diffsHtml = '';

  if (directory.fileDiffs && directory.fileDiffs.length > 0) {
    diffsHtml = directory.fileDiffs.map((file, index) => {
      const statusClass = getDiffStatusClass(file.status);
      return `
        <div class="file-diff ${statusClass}">
          <h4 class="file-toggle" data-index="${index}">
            <span class="status-label">[${file.status}]</span> ${file.filePath}
          </h4>
          <pre class="diff-block" id="diff-${index}" style="display: none;">${file.diff || '(no diff)'}</pre>
        </div>
      `;
    }).join('');
  } else {
    diffsHtml = '<p>No file changes detected.</p>';
  }

  modalContent.innerHTML = `
  <p><strong>Directory:</strong> ${directory.name}</p>
  <p><strong>Directory Path:</strong> ${directory.path}</p>
    <div class="changes-section">
      <h4>File Changes (click to toggle):</h4>
      ${diffsHtml}
    </div>
  `;

  commitModal.style.display = 'block';

  // Toggle işlemleri
  const toggles = modalContent.querySelectorAll('.file-toggle');
  toggles.forEach(toggle => {
    toggle?.addEventListener('click', () => {
      const index = toggle.getAttribute('data-index');
      const diffBlock = document.getElementById(`diff-${index}`);
      if (diffBlock.style.display === 'none') {
        diffBlock.style.display = 'block';
      } else {
        diffBlock.style.display = 'none';
      }
    });
  });
}


// Git init modalını göster
function showGitInitModal(directory) {
  currentDirectory = directory;
  gitInitProjectName.textContent = `Proje: ${directory.name} (${directory.path})`;
  remoteUrlInput.value = '';
  gitInitModal.style.display = 'block';
}

// Modal kapatma işlemlerin
closeButton?.addEventListener('click', () => {
  commitModal.style.display = 'none';
});

gitInitClose?.addEventListener('click', () => {
  gitInitModal.style.display = 'none';
});

resultsClose?.addEventListener('click', () => {
  resultsModal.style.display = 'none';
});

// Dizinleri filtreleme fonksiyonu
function filterDirectories() {
  const searchTerm = projectSearchInput.value.toLowerCase();
  const showChangesOnly = showChangesOnlyCheckbox.checked;
  const directoryItems = document.querySelectorAll('.directory-item');

  directoryItems.forEach(item => {
    const directoryName = item.querySelector('.directory-name').textContent.toLowerCase();
    const directoryPath = item.querySelector('.directory-path').textContent.toLowerCase();
    const hasChanges = item.querySelector('.changes-badge') !== null;

    // Arama terimine göre filtrele
    const matchesSearch = directoryName.includes(searchTerm) || directoryPath.includes(searchTerm);

    // Değişiklikler filtresine göre göster/gizle
    if (showChangesOnly) {
      item.style.display = (matchesSearch && hasChanges) ? 'flex' : 'none';
    } else {
      item.style.display = matchesSearch ? 'flex' : 'none';
    }
  });
}

projectSearchInput?.addEventListener('input', filterDirectories);
showChangesOnlyCheckbox?.addEventListener('change', filterDirectories);

window.addEventListener('click', (e) => {
  if (e.target === commitModal) {
    commitModal.style.display = 'none';
  }
  if (e.target === gitInitModal) {
    gitInitModal.style.display = 'none';
  }
  if (e.target === resultsModal) {
    resultsModal.style.display = 'none';
  }
});

// Git başlatma işlemi
initGitBtn?.addEventListener('click', async () => {
  if (!currentDirectory) return;

  const remoteUrl = remoteUrlInput.value.trim();

  try {
    const result = await ipcRenderer.invoke('initialize-git', {
      directory: currentDirectory,
      remoteUrl
    });

    // Sonuçları göster
    resultsContent.innerHTML = `
      <p class="${result.success ? 'success' : 'error'}">
        <strong>${currentDirectory.name}</strong>: ${result.message}
      </p>
    `;

    if (result.success) {
      // Dizinleri yenile
      projectSearchInput.value = ''
      commitMessageInput.value = ''
      directoriesList.innerHTML = '';

      // directories = await ipcRenderer.invoke('select-directories');
      // renderDirectories();
    }

    // Modal değiştir
    gitInitModal.style.display = 'none';
    resultsModal.style.display = 'block';

  } catch (error) {
    console.error('Git Start Error', error);
    alert('An error occurred during Git initialisation.');
  }
});

// Commit işlemi
commitBtn?.addEventListener('click', async () => {
  const commitMessage = commitMessageInput.value.trim();

  if (!commitMessage) {
    alert('Please enter a commit message.');
    return;
  }

  // Seçili dizinleri al
  const selectedCheckboxes = document.querySelectorAll('.dir-checkbox:checked');
  const selectedDirs = Array.from(selectedCheckboxes).map(checkbox => {
    const index = parseInt(checkbox.getAttribute('data-index'));
    return directories[index];
  });

  if (selectedDirs.length === 0) {
    alert('Please select at least one directory.');
    return;
  }

  try {
    const results = await ipcRenderer.invoke('commit-changes', {
      directories: selectedDirs,
      commitMessage
    });

    // Sonuçları göster
    let resultsHtml = '';
    results.forEach(result => {
      resultsHtml += `
        <p class="${result.success ? 'success' : 'error'}">
          <strong>${result.name}</strong>: ${result.message}
        </p>
      `;
    });

    resultsContent.innerHTML = resultsHtml;
    resultsModal.style.display = 'block';

    // // Dizinleri yenile
    // directories = await ipcRenderer.invoke('select-directories');
    // renderDirectories();

  } catch (error) {
    console.error('Commit Error:', error);
    alert('An error occurred during commit.');
  }
});