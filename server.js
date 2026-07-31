const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;
const NEWSPAPERS_FILE = path.join(__dirname, 'newspapers.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/api/newspapers', (req, res) => {
  try {
    const data = fs.readFileSync(NEWSPAPERS_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read newspapers' });
  }
});

app.post('/api/newspapers', (req, res) => {
  const { name, url } = req.body;
  
  if (!name?.trim() || !url?.trim()) {
    return res.status(400).json({ error: 'name and url required' });
  }

  try {
    const papers = JSON.parse(fs.readFileSync(NEWSPAPERS_FILE, 'utf8'));
    papers[name.trim()] = url.trim();
    fs.writeFileSync(NEWSPAPERS_FILE, JSON.stringify(papers, null, 2));
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save newspaper' });
  }
});

const VALIDATED_FILE = path.join(__dirname, 'data', 'validated_news.json');

function readValidated() {
  try {
    return JSON.parse(fs.readFileSync(VALIDATED_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeValidated(data) {
  fs.writeFileSync(VALIDATED_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/validated-news', (req, res) => {
  res.json(readValidated());
});

app.post('/api/validated-news', (req, res) => {
  const entry = req.body;
  if (!entry || !entry.url) {
    return res.status(400).json({ error: 'Validation entry with url required' });
  }

  const list = readValidated();
  const idx = list.findIndex(e => e.url === entry.url);
  if (idx >= 0) {
    list[idx] = entry;
  } else {
    list.push(entry);
  }
  writeValidated(list);
  res.status(201).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});