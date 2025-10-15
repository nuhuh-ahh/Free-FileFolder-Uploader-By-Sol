const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const app = express();
const PORT = 3000;

// Thư mục lưu trữ file uploads
const UPLOAD_DIR = path.join(__dirname, 'uploads');

app.use(express.json());
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory users (demo)
const users = [];

// Đơn giản: Lưu metadata cho mỗi file/folder dùng 1 file JSON kèm theo (.meta)
async function saveMeta(filePath, meta) {
  const metaPath = filePath + '.meta.json';
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
}

async function readMeta(filePath) {
  const metaPath = filePath + '.meta.json';
  if (!fsSync.existsSync(metaPath)) return null;
  const data = await fs.readFile(metaPath, 'utf-8');
  return JSON.parse(data);
}

// Đăng ký - đăng nhập cơ bản
app.post('/auth', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

  const user = users.find(u => u.username === username);
  if (user) {
    if (user.password !== password) return res.status(400).json({ error: 'Invalid password' });
    return res.json({ message: 'Logged in' });
  }

  users.push({ username, password });
  res.json({ message: 'Registered and logged in' });
});

// Upload file/folder preserving folder structure
app.post('/upload', async (req, res) => {
  if (!req.files || !req.files.uploadFile) return res.status(400).json({ error: 'No files uploaded' });
  if (!req.body.username) return res.status(400).json({ error: 'Missing username' });
  if (!req.body.accessMode) return res.status(400).json({ error: 'Missing accessMode' });

  const userDir = path.join(UPLOAD_DIR, req.body.username);
  if (!fsSync.existsSync(userDir)) fsSync.mkdirSync(userDir, { recursive: true });

  try {
    const mode = req.body.accessMode;
    const files = Array.isArray(req.files.uploadFile) ? req.files.uploadFile : [req.files.uploadFile];

    for (const file of files) {
      const filePath = path.join(userDir, file.name);
      // Ensure directory exists for nested folders
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await file.mv(filePath);
      // Save metadata with mode
      await saveMeta(filePath, { mode });
    }

    res.json({ message: 'Files uploaded' });
  } catch (e) {
    res.status(500).json({ error: 'Upload error' });
  }
});

// API lấy danh sách file/folder với meta ở đường dẫn (path tùy chọn)
app.get('/list/:username/:path(*)?', async (req, res) => {
  const username = req.params.username;
  const relPath = req.params.path || '';
  const basePath = path.join(UPLOAD_DIR, username, relPath);

  if (!fsSync.existsSync(basePath)) return res.status(404).json({ error: 'Directory not found' });

  try {
    const items = await fs.readdir(basePath, { withFileTypes: true });
    let result = [];
    for(const item of items) {
      if(item.name.endsWith('.meta.json')) continue;
      const fullPath = path.join(basePath, item.name);
      let meta = await readMeta(fullPath) || {mode: 'public'};
      result.push({
        name: item.name,
        type: item.isDirectory() ? 'folder' : 'file',
        mode: meta.mode || 'public',
      });
    }
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to read directory' });
  }
});

// Download file, kèm kiểm tra mode
app.get('/download/:username/:filename(*)', async (req, res) => {
  const { username, filename } = req.params;
  const filePath = path.join(UPLOAD_DIR, username, filename);
  if (!fsSync.existsSync(filePath)) return res.status(404).send('File not found');

  const meta = await readMeta(filePath);
  if (meta && meta.mode === 'private') return res.status(403).send('Download blocked: private file');
  if (meta && meta.mode === 'testing') return res.status(403).send('Download blocked: testing mode');

  res.download(filePath);
});

// View nội dung file text
app.get('/view/:username/:filename(*)', async (req,res) => {
  const { username, filename } = req.params;
  const filePath = path.join(UPLOAD_DIR, username, filename);
  if (!fsSync.existsSync(filePath)) return res.status(404).send('File not found');
  if (!filePath.match(/\.txt$|\.js$|\.json$|\.md$/i)) return res.status(403).send('File type not supported for viewing');

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    res.send(content);
  } catch {
    res.status(500).send('Error reading file');
  }
});

// Rename file/folder API
app.post('/rename', async (req, res) => {
  const { username, oldPath, newPath } = req.body;
  if (!username || !oldPath || !newPath) return res.status(400).json({error: 'Missing fields'});

  const basePath = path.join(UPLOAD_DIR, username);
  const oldFull = path.join(basePath, oldPath);
  const newFull = path.join(basePath, newPath);

  try {
    await fs.rename(oldFull, newFull);
    // Rename .meta.json file if exists
    const oldMeta = oldFull + '.meta.json';
    const newMeta = newFull + '.meta.json';
    if (fsSync.existsSync(oldMeta)) {
      await fs.rename(oldMeta, newMeta);
    }
    res.json({message: 'Rename success'});
  } catch {
    res.status(500).json({error: 'Rename failed'});
  }
});

// Delete file/folder API (xóa đệ quy)
async function deleteRecursive(fullPath) {
  if((await fs.lstat(fullPath)).isDirectory()) {
    const files = await fs.readdir(fullPath);
    for(const f of files) await deleteRecursive(path.join(fullPath,f));
    await fs.rmdir(fullPath);
  } else {
    await fs.unlink(fullPath);
  }
}
app.delete('/deletepath/:username/:path(*)', async (req,res) => {
  const { username, path: delPath } = req.params;
  if(!username || !delPath) return res.status(400).json({error: "Missing parameters"});
  const fullPath = path.join(UPLOAD_DIR, username, delPath);
  if(!fsSync.existsSync(fullPath)) return res.status(404).json({error:"File not found"});
  try {
    await deleteRecursive(fullPath);
    // Delete meta file if exists
    const metaPath = fullPath+'.meta.json';
    if(fsSync.existsSync(metaPath)) await fs.unlink(metaPath);
    res.json({message:"Delete successful"});
  } catch {
    res.status(500).json({error:"Delete failed"});
  }
});

// Move file/folder (đổi vị trí)
app.post('/move', async (req,res) => {
  const { username, oldPath, newPath } = req.body;
  if(!username || !oldPath || !newPath) return res.status(400).json({error:"Missing fields"});
  const basePath = path.join(UPLOAD_DIR, username);
  const oldFull = path.join(basePath, oldPath);
  const newFull = path.join(basePath, newPath);

  try {
    await fs.rename(oldFull, newFull);
    // Move meta file
    const oldMeta = oldFull+'.meta.json';
    const newMeta = newFull+'.meta.json';
    if(fsSync.existsSync(oldMeta)) await fs.rename(oldMeta, newMeta);
    res.json({message:"Move successful"});
  } catch {
    res.status(500).json({error:"Move failed"});
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
