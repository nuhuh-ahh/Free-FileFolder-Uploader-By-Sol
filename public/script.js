let loggedUser = null;

// DOM Elements
const loginModal = document.getElementById('loginModal');
const authMessage = document.getElementById('authMessage');
const logoutBtn = document.getElementById('logoutBtn');
const uploadBtn = document.getElementById('uploadBtn');
const accessModeSelect = document.getElementById('accessMode');

const fileInput = document.getElementById('fileInput');
const chooseFileBtn = document.getElementById('chooseFileBtn');

// Info modal setup
const modal = document.getElementById('modal');
const modalMsg = document.getElementById('modalMessage');
const modalCloseBtn = document.getElementById('modalCloseBtn');

function showModal(message) {
  modalMsg.textContent = message;
  modal.style.display = 'block';
}

modalCloseBtn.onclick = () => {
  modal.style.display = 'none';
};

window.onclick = (event) => {
  if (event.target === modal) modal.style.display = 'none';
};

// Khi bấm nút chọn file/folder, hiện popup hỏi type upload
chooseFileBtn.onclick = () => {
  // Tạo một modal xác nhận chọn kiểu upload
  const confirmDiv = document.createElement('div');
  confirmDiv.style.position = 'fixed';
  confirmDiv.style.top = '0';
  confirmDiv.style.left = '0';
  confirmDiv.style.width = '100vw';
  confirmDiv.style.height = '100vh';
  confirmDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
  confirmDiv.style.display = 'flex';
  confirmDiv.style.justifyContent = 'center';
  confirmDiv.style.alignItems = 'center';
  confirmDiv.style.zIndex = '10000';

  const box = document.createElement('div');
  box.style.backgroundColor = 'white';
  box.style.padding = '20px 30px';
  box.style.textAlign = 'center';
  box.style.borderRadius = '10px';
  box.style.minWidth = '250px';

  const question = document.createElement('p');
  question.textContent = 'What type upload do you want?';

  const btnFolder = document.createElement('button');
  btnFolder.textContent = 'Folder';
  btnFolder.style.margin = '10px';
  btnFolder.onclick = () => {
    fileInput.removeAttribute('multiple');
    fileInput.setAttribute('webkitdirectory', '');
    confirmDiv.remove();
    fileInput.value = null;
    fileInput.click();
  };

  const btnFiles = document.createElement('button');
  btnFiles.textContent = 'Files';
  btnFiles.style.margin = '10px';
  btnFiles.onclick = () => {
    fileInput.setAttribute('multiple', '');
    fileInput.removeAttribute('webkitdirectory');
    confirmDiv.remove();
    fileInput.value = null;
    fileInput.click();
  };

  box.appendChild(question);
  box.appendChild(btnFolder);
  box.appendChild(btnFiles);
  confirmDiv.appendChild(box);
  document.body.appendChild(confirmDiv);
};

// Khi user chọn file hay folder => cho phép bấm Upload
fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    uploadBtn.disabled = false;
  }
});

function setLoggedIn(username, remember) {
  loggedUser = username;
  loginModal.style.display = 'none';
  uploadBtn.disabled = false;
  logoutBtn.style.display = 'inline-block';

  if (remember) localStorage.setItem('username', username);
  else localStorage.removeItem('username');

  loadSharedFiles('');
}

function logout() {
  loggedUser = null;
  loginModal.style.display = 'block';
  uploadBtn.disabled = true;
  logoutBtn.style.display = 'none';

  document.getElementById('sharedLinks').innerHTML =
    '<p style="text-align:center; color: gray;">Login to see shared files</p>';
}

document.getElementById('authForm').onsubmit = async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const remember = document.getElementById('remember').checked;

  try {
    const res = await fetch('/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (res.ok) {
      authMessage.style.color = 'green';
      authMessage.textContent = data.message;
      setLoggedIn(username, remember);
    } else {
      authMessage.style.color = 'red';
      authMessage.textContent = data.error || 'Error';
    }
  } catch {
    authMessage.textContent = 'Network error';
  }
};

uploadBtn.onclick = async () => {
  if (!loggedUser) {
    showModal('Please login/register first');
    return;
  }
  if (fileInput.files.length === 0) {
    showModal('Select files or folders to upload');
    return;
  }
  const accessMode = accessModeSelect.value;
  const formData = new FormData();
  for (const file of fileInput.files) {
    formData.append('uploadFile', file, file.webkitRelativePath || file.name);
  }
  formData.append('username', loggedUser);
  formData.append('accessMode', accessMode);

  try {
    const res = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();

    if (res.ok) {
      document.getElementById('uploadMessage').style.color = 'green';
      document.getElementById('uploadMessage').textContent = data.message;
      loadSharedFiles('');
    } else {
      document.getElementById('uploadMessage').style.color = 'red';
      document.getElementById('uploadMessage').textContent = data.error;
    }
  } catch {
    document.getElementById('uploadMessage').textContent = 'Upload failed';
  }
};

logoutBtn.onclick = () => {
  logout();
  localStorage.removeItem('username');
};

async function loadSharedFiles(path) {
  if (!loggedUser) {
    document.getElementById('sharedLinks').innerHTML =
      '<p style="text-align:center; color: gray;">Login to see shared files</p>';
    return;
  }
  try {
    const urlPath = encodeURIComponent(path);
    const res = await fetch(`/list/${encodeURIComponent(loggedUser)}/${urlPath}`);
    const items = await res.json();

    const container = document.getElementById('sharedLinks');
    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = '<p>No files or folders found</p>';
      return;
    }

    items.forEach((item) => {
      const itemDiv = document.createElement('div');
      itemDiv.style.display = 'flex';
      itemDiv.style.justifyContent = 'space-between';
      itemDiv.style.alignItems = 'center';
      itemDiv.style.maxWidth = '600px';
      itemDiv.style.margin = '6px auto';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = item.name;
      nameSpan.style.flexGrow = '1';
      nameSpan.style.userSelect = 'text';

      if (item.type === 'folder') {
        nameSpan.style.fontWeight = 'bold';
        nameSpan.style.cursor = 'pointer';
        nameSpan.title = 'Click to open folder';
        nameSpan.onclick = () => loadSharedFiles(path ? `${path}/${item.name}` : item.name);
      } else {
        if (item.mode === 'public') {
          const link = document.createElement('a');
          link.href = `/download/${encodeURIComponent(loggedUser)}/${encodeURIComponent(
            path ? path + '/' + item.name : item.name
          )}`;
          link.textContent = item.name;
          link.className = 'share-link';
          link.target = '_blank';
          link.style.flexGrow = '1';
          nameSpan.replaceWith(link);
        } else if (item.mode === 'testing') {
          nameSpan.style.color = 'gray';
          nameSpan.title = 'Testing mode - only view, no download';
        } else {
          const link = document.createElement('a');
          link.href = '#';
          link.textContent = item.name + ' (Private)';
          link.style.flexGrow = '1';
          link.style.color = 'red';
          link.style.textDecoration = 'none';
          link.title = 'Download disabled for private file';
          link.onclick = (e) => {
            e.preventDefault();
            showModal('Download blocked: private file');
          };
          nameSpan.replaceWith(link);
        }
      }

      // Download button for files and folders
      const downloadBtn = document.createElement('button');
      downloadBtn.textContent = 'Download';
      downloadBtn.style.marginRight = '5px';

      downloadBtn.onclick = () => {
        // For folders, use zip archive or error message
        if (item.type === 'folder') {
          showModal('Downloading folders is not supported yet.');
          // Alternatively implement zipping functionality on server
        } else if (item.mode === 'private' || item.mode === 'testing') {
          showModal('Download blocked due to file access restrictions.');
        } else {
          const url = `/download/${encodeURIComponent(loggedUser)}/${encodeURIComponent(
            path ? path + '/' + item.name : item.name
          )}`;
          window.open(url, '_blank');
        }
      };

      // Other control buttons: view, rename, delete, move
      const ctrlDiv = document.createElement('div');
      ctrlDiv.style.display = 'flex';
      ctrlDiv.style.gap = '5px';

      if (item.type === 'file') {
        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'View';
        viewBtn.title = 'View file content';
        viewBtn.onclick = () => viewFileContent(path ? `${path}/${item.name}` : item.name);
        ctrlDiv.appendChild(viewBtn);
      }

      const renameBtn = document.createElement('button');
      renameBtn.textContent = 'Rename';
      renameBtn.title = 'Rename file/folder';
      renameBtn.onclick = () => {
        let newName = prompt(`New name for ${item.name}`, item.name);
        if (newName && newName.trim() !== '' && newName.trim() !== item.name) {
          renameItem(path ? `${path}/${item.name}` : item.name, path ? `${path}/${newName.trim()}` : newName.trim());
        }
      };
      ctrlDiv.appendChild(renameBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.style.backgroundColor = '#e02424';
      deleteBtn.style.color = 'white';
      deleteBtn.title = 'Delete file/folder';
      deleteBtn.onclick = () => {
        if (confirm(`Are you sure want to delete ${item.name}?`)) {
          deleteItem(path ? `${path}/${item.name}` : item.name);
        }
      };
      ctrlDiv.appendChild(deleteBtn);

      const moveUpBtn = document.createElement('button');
      moveUpBtn.textContent = 'Move up';
      moveUpBtn.title = 'Move file/folder up one folder';
      moveUpBtn.onclick = () => {
        const fullPath = path ? `${path}/${item.name}` : item.name;
        const parts = fullPath.split('/');
        if (parts.length <= 1) {
          showModal('Already in root folder');
          return;
        }
        const newPath = parts.slice(0, -2).concat(parts[parts.length - 1]).join('/');
        moveItem(fullPath, newPath);
      };
      ctrlDiv.appendChild(moveUpBtn);

      itemDiv.appendChild(nameSpan);
      itemDiv.appendChild(downloadBtn);
      itemDiv.appendChild(ctrlDiv);
      container.appendChild(itemDiv);
    });

    if (path) {
      const backDiv = document.createElement('div');
      backDiv.style.textAlign = 'center';
      backDiv.style.margin = '10px';
      const backBtn = document.createElement('button');
      backBtn.textContent = 'Back';
      backBtn.onclick = () => {
        const parent = path.split('/').slice(0, -1).join('/');
        loadSharedFiles(parent);
      };
      backDiv.appendChild(backBtn);
      container.prepend(backDiv);
    }
  } catch {
    document.getElementById('sharedLinks').textContent = 'Cannot load content';
  }
};

// Các hàm renameItem, deleteItem, moveItem, viewFileContent giữ nguyên như trước

window.onload = () => {
  const remembered = localStorage.getItem('username');
  if (remembered) {
    setLoggedIn(remembered, true);
  } else {
    logout();
  }
};
